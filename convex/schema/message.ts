import { v } from "convex/values"
import { MessagePart, MessagePartV2 } from "./parts"

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

export const HTTPAIMessageV2 = v.object({
    messageId: v.optional(v.string()),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    content: v.optional(v.string()),
    parts: v.array(MessagePartV2)
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
        promptTokens: v.optional(v.number()),
        completionTokens: v.optional(v.number()),
        reasoningTokens: v.optional(v.number()),
        serverDurationMs: v.optional(v.number())
    })
})

export const AIMessageV2 = v.object({
    messageId: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    parts: v.array(MessagePartV2),
    createdAt: v.number(),
    updatedAt: v.number(),
    metadata: v.object({
        modelId: v.optional(v.string()),
        modelName: v.optional(v.string()),
        promptTokens: v.optional(v.number()),
        completionTokens: v.optional(v.number()),
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
        promptTokens: v.optional(v.number()),
        completionTokens: v.optional(v.number()),
        reasoningTokens: v.optional(v.number()),
        serverDurationMs: v.optional(v.number())
    })
})

export const MessageV2 = v.object({
    threadId: v.id("threads"),
    messageId: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    parts: v.array(MessagePartV2),
    createdAt: v.number(),
    updatedAt: v.number(),
    metadata: v.object({
        modelId: v.optional(v.string()),
        modelName: v.optional(v.string()),
        promptTokens: v.optional(v.number()),
        completionTokens: v.optional(v.number()),
        reasoningTokens: v.optional(v.number()),
        serverDurationMs: v.optional(v.number())
    })
})
