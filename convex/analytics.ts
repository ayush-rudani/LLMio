import { v } from "convex/values"
import { query } from "./_generated/server"
import { getUserIdentity } from "./lib/identity"
import { MODELS_SHARED } from "./lib/models"

const getDaysSinceEpoch = (daysAgo: number) =>
    Math.floor(Date.now() / (24 * 60 * 60 * 1000)) - daysAgo

const getHoursSinceEpoch = (hoursAgo: number) =>
    Math.floor(Date.now() / (60 * 60 * 1000)) - hoursAgo

export const getMyUsageStats = query({
    args: {
        timeframe: v.union(v.literal("1d"), v.literal("7d"), v.literal("30d"))
    },
    handler: async (ctx, { timeframe }) => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) {
            return {
                modelStats: [],
                timeframe,
                totalRequests: 0,
                totalTokens: 0
            }
        }

        const days = timeframe === "1d" ? 1 : timeframe === "7d" ? 7 : 30
        const startDay = getDaysSinceEpoch(days)

        // Get user's events in time range - super efficient with the index
        const events = await ctx.db
            .query("usageEvents")
            .withIndex("byUserDay", (q) => q.eq("userId", user.id).gte("daysSinceEpoch", startDay))
            .collect()

        // Post-filter by model and aggregate
        const modelStats = MODELS_SHARED.map((model) => {
            const modelEvents = events.filter((e) => e.modelId === model.id)
            return {
                modelId: model.id,
                modelName: model.name,
                requests: modelEvents.length,
                inputTokens: modelEvents.reduce((sum, e) => sum + e.p, 0),
                outputTokens: modelEvents.reduce((sum, e) => sum + e.c, 0),
                reasoningTokens: modelEvents.reduce((sum, e) => sum + e.r, 0),
                totalTokens: modelEvents.reduce((sum, e) => sum + e.p + e.c + e.r, 0)
            }
        }).filter((stat) => stat.requests > 0)

        const totalRequests = events.length
        const totalTokens = events.reduce((sum, e) => sum + e.p + e.c + e.r, 0)

        return {
            modelStats,
            timeframe,
            totalRequests,
            totalTokens
        }
    }
})

export const getMyUsageChartData = query({
    args: {
        timeframe: v.union(v.literal("1d"), v.literal("7d"), v.literal("30d"))
    },
    handler: async (
        ctx,
        { timeframe }
    ): Promise<
        {
            daysSinceEpoch?: number
            hoursSinceEpoch?: number
            date: string
            totalRequests: number
            totalTokens: number
            models: Record<
                string,
                {
                    requests: number
                    tokens: number
                    inputTokens: number
                    outputTokens: number
                    reasoningTokens: number
                }
            >
        }[]
    > => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) return []

        // For 1d, we want hourly granularity
        if (timeframe === "1d") {
            const hours = 24
            const startTime = Date.now() - hours * 60 * 60 * 1000

            // Get user's events in the last 24 hours
            const events = await ctx.db
                .query("usageEvents")
                .withIndex("byUserDay", (q) => q.eq("userId", user.id))
                .filter((q) => q.gte(q.field("_creationTime"), startTime))
                .collect()

            // Group by hour
            type HourChartData = {
                hoursSinceEpoch: number
                date: string
                totalRequests: number
                totalTokens: number
                models: Record<
                    string,
                    {
                        requests: number
                        tokens: number
                        inputTokens: number
                        outputTokens: number
                        reasoningTokens: number
                    }
                >
            }
            const chartData: HourChartData[] = []
            for (let i = hours - 1; i >= 0; i--) {
                const hourStart = Date.now() - i * 60 * 60 * 1000
                const hourEnd = Date.now() - (i - 1) * 60 * 60 * 1000
                const hourEvents = events.filter(
                    (e) => e._creationTime >= hourStart && e._creationTime < hourEnd
                )

                const hourData = {
                    hoursSinceEpoch: Math.floor(hourStart / (60 * 60 * 1000)),
                    date: new Date(hourStart).toISOString(),
                    totalRequests: hourEvents.length,
                    totalTokens: hourEvents.reduce((sum, e) => sum + e.p + e.c + e.r, 0),
                    models: {} as Record<
                        string,
                        {
                            requests: number
                            tokens: number
                            inputTokens: number
                            outputTokens: number
                            reasoningTokens: number
                        }
                    >
                }

                // Post-filter by model for this hour
                MODELS_SHARED.forEach((model) => {
                    const modelEvents = hourEvents.filter((e) => e.modelId === model.id)
                    if (modelEvents.length > 0) {
                        hourData.models[model.id] = {
                            requests: modelEvents.length,
                            tokens: modelEvents.reduce((sum, e) => sum + e.p + e.c + e.r, 0),
                            inputTokens: modelEvents.reduce((sum, e) => sum + e.p, 0),
                            outputTokens: modelEvents.reduce((sum, e) => sum + e.c, 0),
                            reasoningTokens: modelEvents.reduce((sum, e) => sum + e.r, 0)
                        }
                    }
                })

                chartData.push(hourData)
            }

            return chartData
        }

        // Original daily logic for 7d and 30d
        const days = timeframe === "7d" ? 7 : 30
        const startDay = getDaysSinceEpoch(days)

        // Get user's events in time range
        const events = await ctx.db
            .query("usageEvents")
            .withIndex("byUserDay", (q) => q.eq("userId", user.id).gte("daysSinceEpoch", startDay))
            .collect()

        // Group by day
        type DayChartData = {
            daysSinceEpoch: number
            date: string
            totalRequests: number
            totalTokens: number
            models: Record<
                string,
                {
                    requests: number
                    tokens: number
                    inputTokens: number
                    outputTokens: number
                    reasoningTokens: number
                }
            >
        }
        const chartData: DayChartData[] = []
        for (let i = days - 1; i >= 0; i--) {
            const daysSince = getDaysSinceEpoch(i)
            const dayEvents = events.filter((e) => e.daysSinceEpoch === daysSince)

            const dayData = {
                daysSinceEpoch: daysSince,
                date: new Date(daysSince * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
                totalRequests: dayEvents.length,
                totalTokens: dayEvents.reduce((sum, e) => sum + e.p + e.c + e.r, 0),
                models: {} as Record<
                    string,
                    {
                        requests: number
                        tokens: number
                        inputTokens: number
                        outputTokens: number
                        reasoningTokens: number
                    }
                >
            }

            // Post-filter by model for this day
            MODELS_SHARED.forEach((model) => {
                const modelEvents = dayEvents.filter((e) => e.modelId === model.id)
                if (modelEvents.length > 0) {
                    dayData.models[model.id] = {
                        requests: modelEvents.length,
                        tokens: modelEvents.reduce((sum, e) => sum + e.p + e.c + e.r, 0),
                        inputTokens: modelEvents.reduce((sum, e) => sum + e.p, 0),
                        outputTokens: modelEvents.reduce((sum, e) => sum + e.c, 0),
                        reasoningTokens: modelEvents.reduce((sum, e) => sum + e.r, 0)
                    }
                }
            })

            chartData.push(dayData)
        }

        return chartData
    }
})

export const getMyModelUsage = query({
    args: {
        modelId: v.string(),
        timeframe: v.union(v.literal("1d"), v.literal("7d"), v.literal("30d"))
    },
    handler: async (ctx, { modelId, timeframe }) => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) {
            return {
                modelId,
                requests: 0,
                inputTokens: 0,
                outputTokens: 0,
                reasoningTokens: 0,
                totalTokens: 0
            }
        }

        const days = timeframe === "1d" ? 1 : timeframe === "7d" ? 7 : 30
        const startDay = getDaysSinceEpoch(days)

        // Get user's events, then filter by model
        const events = await ctx.db
            .query("usageEvents")
            .withIndex("byUserDay", (q) => q.eq("userId", user.id).gte("daysSinceEpoch", startDay))
            .filter((q) => q.eq(q.field("modelId"), modelId))
            .collect()

        return {
            modelId,
            requests: events.length,
            inputTokens: events.reduce((sum, e) => sum + e.p, 0),
            outputTokens: events.reduce((sum, e) => sum + e.c, 0),
            reasoningTokens: events.reduce((sum, e) => sum + e.r, 0),
            totalTokens: events.reduce((sum, e) => sum + e.p + e.c + e.r, 0),
            timeframe
        }
    }
})
