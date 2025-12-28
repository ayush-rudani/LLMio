import { tool } from "ai"
import { z } from "zod"
import { internal } from "../../_generated/api"
import type { ToolAdapter } from "../toolkit"
import { SearchProvider } from "./adapters"

const webSearchInputSchema = z.object({
    query: z.string().describe("The search query"),
    scrapeContent: z.boolean().describe("Whether to scrape and include content from search results")
})

export const WebSearchAdapter: ToolAdapter = async (params) => {
    if (!params.enabledTools.includes("web_search")) return {}

    const { userSettings, ctx } = params
    const searchProviderId = userSettings.searchProvider

    // Get the API key for the selected provider
    // User-provided key takes precedence over server key
    const byokProvider = userSettings.generalProviders?.[searchProviderId]
    let apiKey: string | undefined

    if (byokProvider?.enabled && byokProvider.encryptedKey) {
        const decryptedKey = await ctx.runQuery(internal.settings.getDecryptedGeneralProviderKey, {
            providerId: searchProviderId,
            userId: userSettings.userId
        })
        if (decryptedKey) {
            apiKey = decryptedKey
        }
    }

    return {
        web_search: tool({
            description:
                "Search the web for information. Optionally scrape content from results for detailed information.",
            inputSchema: webSearchInputSchema,
            execute: async (params) => {
                const { query, scrapeContent } = params
                // Use the user's default setting if scrapeContent is not provided
                const shouldScrapeContent =
                    scrapeContent ?? userSettings.searchIncludeSourcesByDefault
                try {
                    const searchProvider = new SearchProvider({
                        provider: userSettings.searchProvider,
                        apiKey: apiKey // Pass the retrieved API key
                    })

                    console.log(
                        `Searching for ${query} with provider ${userSettings.searchProvider}...`
                    )

                    const results = await searchProvider.search(query, {
                        limit: 5,
                        scrapeContent: shouldScrapeContent,
                        formats: shouldScrapeContent ? ["markdown", "links"] : []
                    })

                    return {
                        success: true,
                        query,
                        results: results.map((result) => ({
                            title: result.title,
                            url: result.url,
                            description: result.description,
                            ...(result.content && { content: result.content }),
                            ...(result.markdown && { markdown: result.markdown })
                        })),
                        count: results.length
                    }
                } catch (error) {
                    console.error("Web search error:", error)
                    return {
                        success: false,
                        error: error instanceof Error ? error.message : "Unknown error occurred",
                        query,
                        results: []
                    }
                }
            }
        })
    }
}
