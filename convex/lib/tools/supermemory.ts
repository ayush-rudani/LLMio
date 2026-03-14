import { tool } from "ai"
import supermemory from "supermemory"
import { z } from 'zod/v3';
import { internal } from "../../_generated/api"
import type { ToolAdapter } from "../toolkit"

export const SupermemoryAdapter: ToolAdapter = async ({ ctx, enabledTools, userSettings }) => {
    if (!enabledTools.includes("supermemory")) return {}

    return {
        add_memory: tool({
            description: "Add content to supermemory for future recall and reference",
            inputSchema: z.object({
                content: z.string().describe("The content to store in memory"),
                metadata: z
                    .object({
                        title: z.union([
                            z.string().describe("A title for this memory. Optional."),
                            z.null()
                        ]),
                        category: z.union([
                            z.string().describe("Category to organize this memory. Optional."),
                            z.null()
                        ]),
                        tags: z.union([
                            z
                                .array(z.string())
                                .describe("Tags to help find this memory later. Optional."),
                            z.null()
                        ])
                    })
                    .describe("Optional metadata to organize the memory")
            }),
            execute: async ({ content, metadata }) => {
                try {
                    const apiKey = await ctx.runQuery(internal.settings.getSupermemoryKey, {
                        userId: userSettings.userId
                    })

                    if (!apiKey) {
                        return {
                            success: false,
                            error: "Supermemory is not configured. Please add your API key in settings."
                        }
                    }

                    const client = new supermemory({
                        apiKey
                    })

                    const containerTags = [userSettings.userId]
                    if (metadata?.category) {
                        containerTags.push(`category:${metadata.category}`)
                    }
                    if (metadata?.tags) {
                        containerTags.push(...metadata.tags.map((tag) => `tag:${tag}`))
                    }

                    const response = await client.memories.add({
                        content,
                        containerTags,
                        metadata: {
                            ...(metadata?.title && { title: metadata.title }),
                            ...(metadata?.category && { category: metadata.category }),
                            ...(metadata?.tags && { tags: metadata.tags.join(", ") }),
                            addedAt: new Date().toISOString()
                        }
                    })

                    return {
                        success: true,
                        memoryId: response.id,
                        message: `Memory added successfully${metadata?.title ? ` with title "${metadata.title}"` : ""}`
                    }
                } catch (error) {
                    console.error("Error adding memory:", error)
                    return {
                        success: false,
                        error: `Failed to add memory: ${error instanceof Error ? error.message : "Unknown error"}`
                    }
                }
            }
        }),

        search_memories: tool({
            description: "Search through stored memories to find relevant information",
            inputSchema: z.object({
                query: z.string().describe("The search query to find relevant memories"),
                limit: z
                    .number()
                    .min(1)
                    .max(10)
                    .default(5)
                    .describe("Maximum number of memories to return. Default is 5."),
                category: z.union([
                    z.string().describe("Filter by specific category. Optional."),
                    z.null()
                ]),
                tags: z.union([
                    z.array(z.string()).describe("Filter by specific tags. Optional."),
                    z.null()
                ])
            }),
            execute: async ({ query, limit = 5, category, tags }) => {
                try {
                    const apiKey = await ctx.runQuery(internal.settings.getSupermemoryKey, {
                        userId: userSettings.userId
                    })

                    if (!apiKey) {
                        return {
                            success: false,
                            error: "Supermemory is not configured. Please add your API key in settings."
                        }
                    }

                    const client = new supermemory({
                        apiKey
                    })

                    const containerTags = [userSettings.userId]
                    if (category) {
                        containerTags.push(`category:${category}`)
                    }
                    if (tags) {
                        containerTags.push(...tags.map((tag) => `tag:${tag}`))
                    }

                    const response = await client.search.execute({
                        q: query,
                        limit,
                        containerTags: containerTags.length > 1 ? containerTags : undefined
                    })

                    if (!response.results || response.results.length === 0) {
                        return {
                            success: true,
                            results: [],
                            message: "No memories found matching your search."
                        }
                    }

                    const memories = response.results.map((result: any) => ({
                        content: result.content,
                        score: result.score,
                        metadata: result.metadata,
                        memoryId: result.id,
                        createdAt: result.createdAt
                    }))

                    return {
                        success: true,
                        results: memories,
                        message: `Found ${memories.length} relevant ${memories.length === 1 ? "memory" : "memories"}`
                    }
                } catch (error) {
                    console.error("Error searching memories:", error)
                    return {
                        success: false,
                        error: `Failed to search memories: ${error instanceof Error ? error.message : "Unknown error"}`
                    }
                }
            }
        })
    };
}
