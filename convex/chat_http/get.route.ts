import { ChatError } from "@/lib/errors"
import { createUIMessageStream } from "ai"
import type { Infer } from "convex/values"
import { differenceInSeconds } from "date-fns"
import { internal } from "../_generated/api"
import type { Id } from "../_generated/dataModel"
import { httpAction } from "../_generated/server"
import { getUserIdentity } from "../lib/identity"
import { getResumableStreamContext } from "../lib/resumable_stream_context"
import type { Thread } from "../schema"
import { RESPONSE_OPTS } from "./shared"

export const chatGET = httpAction(async (ctx, req) => {
    const streamContext = getResumableStreamContext()
    const resumeRequestedAt = new Date()

    if (!streamContext) {
        return new Response(null, { status: 204 })
    }

    const { searchParams } = new URL(req.url)
    const threadId = searchParams.get("chatId")
    if (!threadId) return new ChatError("bad_request:api").toResponse()

    const session = await getUserIdentity(ctx.auth, { allowAnons: false })

    if ("error" in session) return new ChatError("unauthorized:chat").toResponse()

    let chat: Infer<typeof Thread> | null

    try {
        chat = await ctx.runQuery(internal.threads.getThreadById, {
            threadId: threadId as Id<"threads">
        })
    } catch {
        return new ChatError("not_found:chat").toResponse()
    }

    if (!chat) return new ChatError("not_found:chat").toResponse()

    if (chat.authorId !== session.id) return new ChatError("forbidden:chat").toResponse()

    const streams = await ctx.runQuery(internal.streams.getStreamsByThreadId, {
        threadId: threadId as Id<"threads">
    })

    if (!streams.length) return new ChatError("not_found:stream").toResponse()

    const recentStreamId = streams.at(-1)

    if (!recentStreamId) return new ChatError("not_found:stream").toResponse()

    const emptyDataStream = createUIMessageStream({
        execute: () => {}
    })

    const stream = await streamContext.resumableStream(recentStreamId._id, () => emptyDataStream)

    /*
     * For when the generation is streaming during SSR
     * but the resumable stream has concluded at this point.
     */
    if (!stream) {
        const messages = await ctx.runQuery(internal.messages.getMessagesByThreadId, {
            threadId: threadId as Id<"threads">
        })
        const mostRecentMessage = messages.at(-1)

        if (!mostRecentMessage) {
            return new Response(emptyDataStream.pipeThrough(new TextEncoderStream()), RESPONSE_OPTS)
        }

        if (mostRecentMessage.role !== "assistant") {
            return new Response(emptyDataStream.pipeThrough(new TextEncoderStream()), RESPONSE_OPTS)
        }

        const messageCreatedAt = new Date(mostRecentMessage.createdAt)

        if (differenceInSeconds(resumeRequestedAt, messageCreatedAt) > 15) {
            return new Response(emptyDataStream.pipeThrough(new TextEncoderStream()), RESPONSE_OPTS)
        }

        const restoredStream = createUIMessageStream({
            execute: (buffer) => {
                buffer.write({
                    'type': 'data',

                    'value': [{
                        type: "append-message",
                        message: JSON.stringify(mostRecentMessage)
                    }]
                })
            }
        })

        return new Response(restoredStream.pipeThrough(new TextEncoderStream()), RESPONSE_OPTS)
    }

    return new Response(stream.pipeThrough(new TextEncoderStream()), RESPONSE_OPTS)
})
