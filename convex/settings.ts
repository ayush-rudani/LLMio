import { ChatError } from "@/lib/errors"
import { type Infer, v } from "convex/values"
import type { Id } from "./_generated/dataModel"
import { type QueryCtx, internalQuery, mutation, query } from "./_generated/server"
import { decryptKey, encryptKey } from "./lib/encryption"
import { getUserIdentity } from "./lib/identity"
import { MODELS_SHARED, type RegistryKey, type SharedModel } from "./lib/models"
import type { UserSettings } from "./schema"
import { NonSensitiveUserSettings } from "./schema/settings"

export const DefaultSettings = (userId: string) =>
    ({
        userId,
        searchProvider: "firecrawl",
        searchIncludeSourcesByDefault: false,
        coreAIProviders: {},
        customAIProviders: {},
        customModels: {},
        titleGenerationModel: "gpt-oss-20b",
        customThemes: [],
        mcpServers: [],
        generalProviders: {
            supermemory: undefined,
            firecrawl: undefined,
            tavily: undefined,
            brave: undefined,
            serper: undefined
        },
        customization: undefined,
        onboardingCompleted: false
    }) satisfies Infer<typeof UserSettings>

const getSettings = async (
    ctx: QueryCtx,
    userId: string
): Promise<Infer<typeof UserSettings> & { _id?: Id<"settings"> }> => {
    const settings = await ctx.db
        .query("settings")
        .withIndex("byUser", (q) => q.eq("userId", userId))
        .first()

    if (!settings) {
        return DefaultSettings(userId)
    }
    return settings
}
export const getUserSettingsInternal = internalQuery({
    args: {
        userId: v.string()
    },
    handler: async (ctx, args): Promise<Infer<typeof UserSettings>> => {
        return await getSettings(ctx, args.userId)
    }
})

export const getUserSettings = query({
    args: {},
    handler: async (ctx): Promise<Infer<typeof UserSettings> | { error: string }> => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) return { error: "unauthorized:api" }
        return await getSettings(ctx, user.id)
    }
})

export const getUserRegistryInternal = internalQuery({
    args: {
        userId: v.string()
    },
    handler: async (ctx, args) => {
        const settings = await getSettings(ctx, args.userId)

        const providers: Record<string, { key: string; endpoint?: string; name?: string }> = {}
        for (const [providerId, provider] of Object.entries(settings.coreAIProviders)) {
            if (!provider.enabled) continue
            providers[providerId] = {
                key: await decryptKey(provider.encryptedKey),
                name: providerId
            }
        }

        for (const [providerId, provider] of Object.entries(settings.customAIProviders)) {
            if (!provider.enabled) continue
            providers[providerId] = {
                key: await decryptKey(provider.encryptedKey),
                endpoint: provider.endpoint,
                name: provider.name
            }
        }

        const models: Record<string, SharedModel & { customProviderId?: string }> = {}
        for (const model of MODELS_SHARED) {
            const available_adapters: RegistryKey[] = []
            for (const adapter of model.adapters) {
                const provider = adapter.split(":")[0]
                if (provider in providers || provider.startsWith("i3-")) {
                    available_adapters.push(adapter)
                }
            }
            models[model.id] = {
                id: model.id,
                name: model.name,
                adapters: available_adapters,
                abilities: model.abilities,
                mode: model.mode,
                supportedImageSizes: model.supportedImageSizes
            }
        }

        for (const [modelId, model] of Object.entries(settings.customModels)) {
            if (!model.enabled) continue
            models[modelId] = {
                id: model.modelId,
                name: model.name ?? model.modelId,
                adapters: [`${model.providerId}:${model.modelId}`],
                abilities: model.abilities,
                contextLength: model.contextLength,
                maxOutputTokens: model.maxOutputTokens,
                customProviderId: model.providerId
            }
        }

        return { providers, models, settings }
    }
})

export const updateUserSettings = mutation({
    args: {
        userId: v.string(),
        baseSettings: NonSensitiveUserSettings,
        coreProviders: v.record(
            v.string(),
            v.object({
                enabled: v.boolean(),
                newKey: v.optional(v.string())
            })
        ),
        customProviders: v.record(
            v.string(),
            v.object({
                name: v.string(),
                enabled: v.boolean(),
                endpoint: v.string(),
                newKey: v.optional(v.string())
            })
        ),
        generalProviders: v.optional(
            v.object({
                supermemory: v.optional(
                    v.object({
                        enabled: v.boolean(),
                        newKey: v.optional(v.string())
                    })
                ),
                firecrawl: v.optional(
                    v.object({
                        enabled: v.boolean(),
                        newKey: v.optional(v.string())
                    })
                ),
                tavily: v.optional(
                    v.object({
                        enabled: v.boolean(),
                        newKey: v.optional(v.string())
                    })
                ),
                brave: v.optional(
                    v.object({
                        enabled: v.boolean(),
                        newKey: v.optional(v.string()),
                        country: v.optional(v.string()),
                        searchLang: v.optional(v.string()),
                        safesearch: v.optional(
                            v.union(v.literal("off"), v.literal("moderate"), v.literal("strict"))
                        )
                    })
                ),
                serper: v.optional(
                    v.object({
                        enabled: v.boolean(),
                        newKey: v.optional(v.string()),
                        language: v.optional(v.string()),
                        country: v.optional(v.string())
                    })
                )
            })
        ),
        // Keeping backward compatibility
        supermemory: v.optional(
            v.object({
                enabled: v.boolean(),
                newKey: v.optional(v.string())
            })
        ),
        mcpServers: v.optional(
            v.array(
                v.object({
                    name: v.string(),
                    url: v.string(),
                    type: v.union(v.literal("sse"), v.literal("http")),
                    enabled: v.optional(v.boolean()),
                    headers: v.optional(
                        v.array(
                            v.object({
                                key: v.string(),
                                value: v.string()
                            })
                        )
                    )
                })
            )
        )
    },
    handler: async (ctx, args) => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) throw new ChatError("unauthorized:api")
        if (user.id !== args.userId) {
            throw new ChatError("unauthorized:api")
        }

        const settings = await getSettings(ctx, args.userId)

        const newSettings: Infer<typeof UserSettings> = {
            ...args.baseSettings,
            coreAIProviders: {},
            customAIProviders: {},
            generalProviders: {
                supermemory: settings.generalProviders?.supermemory,
                firecrawl: settings.generalProviders?.firecrawl,
                tavily: settings.generalProviders?.tavily,
                brave: settings.generalProviders?.brave,
                serper: settings.generalProviders?.serper
            }
        }

        // Handle core AI providers
        for (const [providerId, provider] of Object.entries(args.coreProviders)) {
            newSettings.coreAIProviders[providerId] = {
                enabled: provider.enabled,
                encryptedKey: provider.newKey
                    ? await encryptKey(provider.newKey)
                    : settings.coreAIProviders[providerId]?.encryptedKey || ""
            }
        }

        // Handle custom AI providers
        for (const [providerId, provider] of Object.entries(args.customProviders)) {
            newSettings.customAIProviders[providerId] = {
                enabled: provider.enabled,
                endpoint: provider.endpoint,
                name: provider.name,
                encryptedKey: provider.newKey
                    ? await encryptKey(provider.newKey)
                    : settings.customAIProviders[providerId].encryptedKey
            }
        }

        // Handle general providers (new structure)
        if (args.generalProviders) {
            for (const [providerId, providerData] of Object.entries(args.generalProviders)) {
                if (providerData) {
                    const existingProvider =
                        settings.generalProviders?.[
                            providerId as keyof typeof settings.generalProviders
                        ]

                    if (providerId === "brave") {
                        newSettings.generalProviders.brave = {
                            enabled: providerData.enabled,
                            encryptedKey: providerData.newKey
                                ? await encryptKey(providerData.newKey)
                                : existingProvider?.encryptedKey || "",
                            country: (providerData as any).country,
                            searchLang: (providerData as any).searchLang,
                            safesearch: (providerData as any).safesearch
                        }
                    } else if (providerId === "serper") {
                        newSettings.generalProviders.serper = {
                            enabled: providerData.enabled,
                            encryptedKey: providerData.newKey
                                ? await encryptKey(providerData.newKey)
                                : existingProvider?.encryptedKey || "",
                            language: (providerData as any).language,
                            country: (providerData as any).country
                        }
                    } else {
                        ;(newSettings.generalProviders as any)[providerId] = {
                            enabled: providerData.enabled,
                            encryptedKey: providerData.newKey
                                ? await encryptKey(providerData.newKey)
                                : existingProvider?.encryptedKey || ""
                        }
                    }
                }
            }
        }

        // Handle backward compatibility for supermemory
        if (args.supermemory) {
            newSettings.generalProviders.supermemory = {
                enabled: args.supermemory.enabled,
                encryptedKey: args.supermemory.newKey
                    ? await encryptKey(args.supermemory.newKey)
                    : settings.generalProviders?.supermemory?.encryptedKey || ""
            }
        }

        if (settings._id) {
            await ctx.db.patch(settings._id, newSettings)
        } else {
            await ctx.db.insert("settings", newSettings)
        }
    }
})

export const addUserTheme = mutation({
    args: {
        url: v.string()
    },
    handler: async (ctx, args) => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) throw new Error("Unauthorized")
        const settings = await getSettings(ctx, user.id)
        const existingThemes = settings.customThemes ?? []

        if (existingThemes.includes(args.url)) return
        if (existingThemes.length >= 5) throw new Error("Maximum number of themes reached")

        const newSettings: Infer<typeof UserSettings> = {
            ...settings,
            customThemes: [...existingThemes, args.url]
        }

        if (settings._id) {
            await ctx.db.patch(settings._id, newSettings)
        } else {
            await ctx.db.insert("settings", newSettings)
        }
    }
})

export const deleteUserTheme = mutation({
    args: {
        url: v.string()
    },
    handler: async (ctx, args) => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) throw new Error("Unauthorized")
        const settings = await getSettings(ctx, user.id)

        const existingThemes = settings.customThemes ?? []
        const updatedThemes = existingThemes.filter((t) => t !== args.url)

        const newSettings: Infer<typeof UserSettings> = {
            ...settings,
            customThemes: updatedThemes
        }

        if (settings._id) {
            await ctx.db.patch(settings._id, newSettings)
        } else {
            await ctx.db.insert("settings", newSettings)
        }
    }
})

export const getSupermemoryKey = internalQuery({
    args: {
        userId: v.string()
    },
    handler: async (ctx, args): Promise<string | null> => {
        const settings = await getSettings(ctx, args.userId)

        if (
            !settings.generalProviders?.supermemory?.enabled ||
            !settings.generalProviders?.supermemory.encryptedKey
        ) {
            return null
        }

        try {
            return await decryptKey(settings.generalProviders?.supermemory.encryptedKey)
        } catch (error) {
            console.error("Failed to decrypt supermemory key:", error)
            return null
        }
    }
})

export const getDecryptedGeneralProviderKey = internalQuery({
    args: {
        providerId: v.string(),
        userId: v.string()
    },
    handler: async (ctx, args): Promise<string | null> => {
        const settings = await getSettings(ctx, args.userId)

        const providerConfig =
            settings.generalProviders?.[args.providerId as keyof typeof settings.generalProviders]

        if (!providerConfig?.enabled || !providerConfig.encryptedKey) {
            return null
        }

        try {
            return await decryptKey(providerConfig.encryptedKey)
        } catch (error) {
            console.error(`Failed to decrypt ${args.providerId} key:`, error)
            return null
        }
    }
})

export const updateUserSettingsPartial = mutation({
    args: {
        // Base settings (partial)
        searchProvider: v.optional(
            v.union(
                v.literal("firecrawl"),
                v.literal("brave"),
                v.literal("tavily"),
                v.literal("serper")
            )
        ),
        searchIncludeSourcesByDefault: v.optional(v.boolean()),
        titleGenerationModel: v.optional(v.string()),
        customization: v.optional(
            v.object({
                name: v.optional(v.string()),
                aiPersonality: v.optional(v.string()),
                additionalContext: v.optional(v.string())
            })
        ),

        // Provider updates (only pass what's changing)
        coreProviderUpdates: v.optional(
            v.record(
                v.string(),
                v.object({
                    enabled: v.boolean(),
                    newKey: v.optional(v.string())
                })
            )
        ),
        customProviderUpdates: v.optional(
            v.record(
                v.string(),
                v.union(
                    // Update existing provider
                    v.object({
                        name: v.string(),
                        enabled: v.boolean(),
                        endpoint: v.string(),
                        newKey: v.optional(v.string())
                    }),
                    // Delete provider (null value)
                    v.null()
                )
            )
        ),
        generalProviderUpdates: v.optional(
            v.record(
                v.string(),
                v.union(
                    // Supermemory, firecrawl, tavily
                    v.object({
                        enabled: v.boolean(),
                        newKey: v.optional(v.string())
                    }),
                    // Brave with additional fields
                    v.object({
                        enabled: v.boolean(),
                        newKey: v.optional(v.string()),
                        country: v.optional(v.string()),
                        searchLang: v.optional(v.string()),
                        safesearch: v.optional(
                            v.union(v.literal("off"), v.literal("moderate"), v.literal("strict"))
                        )
                    }),
                    // Serper with additional fields
                    v.object({
                        enabled: v.boolean(),
                        newKey: v.optional(v.string()),
                        language: v.optional(v.string()),
                        country: v.optional(v.string())
                    })
                )
            )
        ),

        // Custom models
        customModelUpdates: v.optional(
            v.record(
                v.string(),
                v.union(
                    v.object({
                        enabled: v.boolean(),
                        name: v.optional(v.string()),
                        modelId: v.string(),
                        providerId: v.string(),
                        contextLength: v.number(),
                        maxOutputTokens: v.number(),
                        abilities: v.array(
                            v.union(
                                v.literal("reasoning"),
                                v.literal("vision"),
                                v.literal("function_calling"),
                                v.literal("pdf"),
                                v.literal("effort_control")
                            )
                        )
                    }),
                    v.null() // Delete model
                )
            )
        ),

        // MCP Servers
        mcpServers: v.optional(
            v.array(
                v.object({
                    name: v.string(),
                    url: v.string(),
                    type: v.union(v.literal("sse"), v.literal("http")),
                    enabled: v.optional(v.boolean()),
                    headers: v.optional(
                        v.array(
                            v.object({
                                key: v.string(),
                                value: v.string()
                            })
                        )
                    )
                })
            )
        ),

        // Custom themes
        addTheme: v.optional(v.string()),
        removeTheme: v.optional(v.string())
    },
    handler: async (ctx, args) => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) throw new ChatError("unauthorized:api")

        const settings = await getSettings(ctx, user.id)
        const newSettings: Infer<typeof UserSettings> = { ...settings }

        // Update base settings
        if (args.searchProvider !== undefined) {
            newSettings.searchProvider = args.searchProvider
        }
        if (args.searchIncludeSourcesByDefault !== undefined) {
            newSettings.searchIncludeSourcesByDefault = args.searchIncludeSourcesByDefault
        }
        if (args.titleGenerationModel !== undefined) {
            newSettings.titleGenerationModel = args.titleGenerationModel
        }
        if (args.customization !== undefined) {
            newSettings.customization = {
                ...newSettings.customization,
                ...args.customization
            }
        }

        // Update core AI providers
        if (args.coreProviderUpdates) {
            for (const [providerId, update] of Object.entries(args.coreProviderUpdates)) {
                newSettings.coreAIProviders[providerId] = {
                    enabled: update.enabled,
                    encryptedKey: update.newKey
                        ? await encryptKey(update.newKey)
                        : settings.coreAIProviders[providerId]?.encryptedKey || ""
                }
            }
        }

        // Update custom AI providers
        if (args.customProviderUpdates) {
            for (const [providerId, update] of Object.entries(args.customProviderUpdates)) {
                if (update === null) {
                    // Delete provider
                    delete newSettings.customAIProviders[providerId]
                } else {
                    // Update provider
                    newSettings.customAIProviders[providerId] = {
                        name: update.name,
                        enabled: update.enabled,
                        endpoint: update.endpoint,
                        encryptedKey: update.newKey
                            ? await encryptKey(update.newKey)
                            : settings.customAIProviders[providerId]?.encryptedKey || ""
                    }
                }
            }
        }

        // Update general providers (search, memory)
        if (args.generalProviderUpdates) {
            // Ensure generalProviders exists
            if (!newSettings.generalProviders) {
                newSettings.generalProviders = {
                    supermemory: undefined,
                    firecrawl: undefined,
                    tavily: undefined,
                    brave: undefined,
                    serper: undefined
                }
            }

            for (const [providerId, update] of Object.entries(args.generalProviderUpdates)) {
                const existingProvider =
                    settings.generalProviders?.[
                        providerId as keyof typeof settings.generalProviders
                    ]

                if (providerId === "brave") {
                    newSettings.generalProviders.brave = {
                        enabled: update.enabled,
                        encryptedKey: update.newKey
                            ? await encryptKey(update.newKey)
                            : existingProvider?.encryptedKey || "",
                        country: (update as any).country,
                        searchLang: (update as any).searchLang,
                        safesearch: (update as any).safesearch
                    }
                } else if (providerId === "serper") {
                    newSettings.generalProviders.serper = {
                        enabled: update.enabled,
                        encryptedKey: update.newKey
                            ? await encryptKey(update.newKey)
                            : existingProvider?.encryptedKey || "",
                        language: (update as any).language,
                        country: (update as any).country
                    }
                } else {
                    // supermemory, firecrawl, tavily
                    ;(newSettings.generalProviders as any)[providerId] = {
                        enabled: update.enabled,
                        encryptedKey: update.newKey
                            ? await encryptKey(update.newKey)
                            : existingProvider?.encryptedKey || ""
                    }
                }
            }
        }

        // Update custom models
        if (args.customModelUpdates) {
            for (const [modelId, update] of Object.entries(args.customModelUpdates)) {
                if (update === null) {
                    // Delete model
                    delete newSettings.customModels[modelId]
                } else {
                    // Update model
                    newSettings.customModels[modelId] = update
                }
            }
        }

        // Update MCP servers
        if (args.mcpServers !== undefined) {
            newSettings.mcpServers = args.mcpServers
        }

        // Handle theme updates
        if (args.addTheme) {
            const existingThemes = newSettings.customThemes || []
            if (!existingThemes.includes(args.addTheme) && existingThemes.length < 5) {
                newSettings.customThemes = [...existingThemes, args.addTheme]
            }
        }
        if (args.removeTheme) {
            const existingThemes = newSettings.customThemes || []
            newSettings.customThemes = existingThemes.filter((t) => t !== args.removeTheme)
        }

        // Save settings
        if (settings._id) {
            await ctx.db.patch(settings._id, newSettings)
        } else {
            await ctx.db.insert("settings", newSettings)
        }
    }
})

export const getOnboardingStatus = query({
    args: {},
    handler: async (ctx): Promise<{ shouldShowOnboarding: boolean } | { error: string }> => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) return { error: "unauthorized:api" }

        const settings = await getSettings(ctx, user.id)

        // Show onboarding if onboardingCompleted is false or undefined
        return { shouldShowOnboarding: !settings.onboardingCompleted }
    }
})

export const completeOnboarding = mutation({
    args: {},
    handler: async (ctx) => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) throw new ChatError("unauthorized:api")

        const settings = await getSettings(ctx, user.id)

        const newSettings: Infer<typeof UserSettings> = {
            ...settings,
            onboardingCompleted: true
        }

        if (settings._id) {
            await ctx.db.patch(settings._id, newSettings)
        } else {
            await ctx.db.insert("settings", newSettings)
        }
    }
})
