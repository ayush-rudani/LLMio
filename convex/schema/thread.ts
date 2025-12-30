import { v } from "convex/values"
import { AIMessageV2 } from "./message"

export const Thread = v.object({
    authorId: v.string(),
    title: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    streamStartedAt: v.optional(v.number()),
    isLive: v.optional(v.boolean()),
    currentStreamId: v.optional(v.string()),
    pinned: v.optional(v.boolean()),
    projectId: v.optional(v.id("projects"))
})

export const SharedThread = v.object({
    originalThreadId: v.id("threads"),
    authorId: v.string(),
    title: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    messages: v.array(AIMessageV2),
    includeAttachments: v.boolean()
})
