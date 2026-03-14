import { v } from "convex/values"
import type { Id } from "./_generated/dataModel"
import { internalMutation, internalQuery } from "./_generated/server"
import { MessagePartV2 } from "./schema/parts"

export const getMessagesByThreadId = internalQuery({
    args: { threadId: v.id("threads") },
    handler: async ({ db }, { threadId }) => {
        return await db
            .query("messages")
            .withIndex("byThreadId", (q) => q.eq("threadId", threadId))
            .order("desc")
            .collect()
    }
})

export const patchMessage = internalMutation({
    args: {
        threadId: v.id("threads"),
        messageId: v.string(),
        parts: v.array(MessagePartV2),
        metadata: v.optional(
            v.object({
                modelId: v.optional(v.string()),
                modelName: v.optional(v.string()),
                promptTokens: v.optional(v.number()),
                completionTokens: v.optional(v.number()),
                reasoningTokens: v.optional(v.number()),
                serverDurationMs: v.optional(v.number())
            })
        )
    },
    handler: async ({ db }, { threadId, messageId, parts, metadata }) => {
        const msgs = await db
            .query("messages")
            .withIndex("byMessageId", (q) => q.eq("messageId", messageId))
            .collect()
        const msg = msgs[0]
        if (!msg) return

        await db.patch(msg._id as Id<"messages">, {
            parts: parts,
            metadata: {
                ...msg.metadata,
                ...metadata
            },
            updatedAt: Date.now()
        })

        // Create usage event for analytics
        if (metadata?.modelId) {
            const thread = await db.get(threadId)
            if (thread) {
                await db.insert("usageEvents", {
                    userId: thread.authorId,
                    modelId: metadata.modelId,
                    p: metadata.promptTokens ?? 0,
                    c: metadata.completionTokens ?? 0,
                    r: metadata.reasoningTokens ?? 0,
                    daysSinceEpoch: Math.floor(Date.now() / (24 * 60 * 60 * 1000))
                })
            }
        }

        return { success: true, _id: msg._id }
    }
})
