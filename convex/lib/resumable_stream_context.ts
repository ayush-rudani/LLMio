import { Redis } from "@upstash/redis"
import {
    type ResumableStreamContext,
    type Subscriber,
    createResumableStreamContext
} from "resumable-stream"

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!
})

if (!process.env.UPSTASH_REDIS_REST_URL) {
    console.log(" > Resumable streams are disabled due to missing UPSTASH_REDIS_REST_URL")
}
if (!process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.log(" > Resumable streams are disabled due to missing UPSTASH_REDIS_REST_TOKEN")
}

const debugMode = false as boolean

const globalUnsubscribers: Record<string, () => void> = {}
let globalStreamContext: ResumableStreamContext | null = null
export const getResumableStreamContext = () => {
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
        return null
    }
    if (!globalStreamContext) {
        try {
            globalStreamContext = createResumableStreamContext({
                waitUntil: (promise) => promise,
                subscriber: {
                    connect: async () => {},
                    subscribe: (async (channel: string, callback: (message: string) => void) => {
                        console.debug(`[Redis] Subscribing to channel: ${channel}`)
                        const subscriber = redis.subscribe(channel)
                        subscriber.on("message", (message) => {
                            if (debugMode) {
                                console.debug(
                                    `[Redis] Message received: raw_type=${typeof message.message} raw=${message.message}`
                                )
                            }
                            const reEncoded =
                                typeof message.message === "string"
                                    ? message.message
                                    : JSON.stringify(message.message)
                            if (debugMode) {
                                console.debug(`[Redis] Message received: re-encoded=${reEncoded}`)
                            }
                            callback(reEncoded)
                        })

                        subscriber.on("pmessage", (message) => {
                            if (debugMode) {
                                console.debug(
                                    `[Redis] Pattern message received: raw_type=${typeof message.message} raw=${message.message}`
                                )
                            }
                            const reEncoded =
                                typeof message.message === "string"
                                    ? message.message
                                    : JSON.stringify(message.message)
                            if (debugMode) {
                                console.debug(
                                    `[Redis] Pattern message received: re-encoded=${reEncoded}`
                                )
                            }
                            callback(reEncoded)
                        })

                        subscriber.on("error", (error) => {
                            console.error(`[Redis] Subscriber Error: ${error}`)
                        })

                        subscriber.on("subscribe", (channel) => {
                            if (debugMode) {
                                console.debug(`[Redis] SUBSCRIBE<- to channel: ${channel}`)
                            }
                        })

                        globalUnsubscribers[channel] = () => {
                            subscriber.unsubscribe()
                        }
                        return
                    }) satisfies Subscriber["subscribe"],
                    unsubscribe: (async (channel: string) => {
                        if (debugMode)
                            console.debug(`[Redis] Unsubscribing from channel: ${channel}`)
                        globalUnsubscribers[channel]?.()
                        delete globalUnsubscribers[channel]
                        return undefined as unknown
                    }) satisfies Subscriber["unsubscribe"]
                },
                publisher: {
                    connect: async () => {},
                    publish: async (channel: string, message: string) => {
                        if (debugMode)
                            console.debug(`[Redis] Publishing to channel: ${channel} ${message}`)
                        return await redis.publish(channel, message)
                    },
                    set: async (key: string, value: string, options?: { EX?: number }) => {
                        if (debugMode) console.debug(`[Redis] SET ${key} ${value} ${options?.EX}`)
                        if (options?.EX) {
                            return await redis.set(key, value, { ex: options.EX })
                        }
                        return await redis.set(key, value)
                    },
                    get: async (key: string) => {
                        if (debugMode) console.debug(`[Redis] GET ${key}`)
                        return (await redis.get(key)) as string | number | null
                    },
                    incr: async (key: string) => {
                        if (debugMode) console.debug(`[Redis] INCR ${key}`)

                        return await redis.incr(key)
                    }
                }
            })
        } catch (error: unknown) {
            if (error instanceof Error && error.message.includes("REDIS_URL")) {
                console.log(" > Resumable streams are disabled due to missing REDIS_URL")
            } else {
                console.error(error)
            }
        }
    }

    return globalStreamContext
}
