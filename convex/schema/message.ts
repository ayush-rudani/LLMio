import { v } from "convex/values"
import { MessagePart } from "./parts"

export const HTTPAIMessage = v.object({
    messageId: v.optional(v.string()),
    role: v.union(
        v.literal("user"),
        v.literal("assistant"),
        v.literal("system")
        // v.literal("data")
    ),
    content: v.optional(v.string()),
    parts: v.array(MessagePart)
})

export const AIMessage = v.object({
    messageId: v.string(),
    role: v.union(
        v.literal("user"),
        v.literal("assistant"),
        v.literal("system")
        // v.literal("data")
    ),
    parts: v.array(MessagePart),
    createdAt: v.number(),
    updatedAt: v.number(),
    metadata: v.object({
        modelId: v.optional(v.string()),
        modelName: v.optional(v.string()),
        inputTokens: v.optional(v.number()),
        outputTokens: v.optional(v.number()),
        reasoningTokens: v.optional(v.number()),
        serverDurationMs: v.optional(v.number())
    })
})

export const Message = v.object({
    threadId: v.id("threads"),
    messageId: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    parts: v.array(MessagePart),
    createdAt: v.number(),
    updatedAt: v.number(),
    metadata: v.object({
        modelId: v.optional(v.string()),
        modelName: v.optional(v.string()),
        inputTokens: v.optional(v.number()),
        outputTokens: v.optional(v.number()),
        reasoningTokens: v.optional(v.number()),
        serverDurationMs: v.optional(v.number())
    })
})
