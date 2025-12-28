import { ABILITIES } from "@/convex/lib/toolkit"
import { z } from 'zod/v3';

const AIConfigSchema = z.object({
    selectedModel: z.string().nullable(),
    enabledTools: z
        .array(z.enum(ABILITIES as readonly ["web_search", "supermemory", "mcp"]))
        .default(["web_search"]),
    selectedImageSize: z.string().optional().default("1:1"),
    reasoningEffort: z.enum(["off", "low", "medium", "high"]).default("medium")
})

export type AIConfig = z.infer<typeof AIConfigSchema>

const AI_CONFIG_KEY = "ai-config"
const USER_INPUT_KEY = "user-input"

const safeRemoveItem = (key: string): void => {
    if (typeof window === "undefined") return
    try {
        localStorage.removeItem(key)
    } catch {}
}

export const loadAIConfig = (): AIConfig => {
    if (typeof window === "undefined")
        return {
            selectedModel: null,
            enabledTools: ["web_search"],
            selectedImageSize: "1:1",
            reasoningEffort: "medium"
        }
    const stored = localStorage.getItem(AI_CONFIG_KEY)
    if (!stored) {
        return {
            selectedModel: null,
            enabledTools: ["web_search"],
            selectedImageSize: "1:1",
            reasoningEffort: "medium"
        }
    }

    try {
        const parsed = JSON.parse(stored)

        // Validate enabled tools but let the UI handle invalid model IDs gracefully
        if (
            parsed.enabledTools.some(
                (tool: string) => !ABILITIES.includes(tool as (typeof ABILITIES)[number])
            )
        ) {
            parsed.enabledTools = ["web_search"]
        }

        return AIConfigSchema.parse(parsed)
    } catch {
        safeRemoveItem(AI_CONFIG_KEY)
        return {
            selectedModel: null,
            enabledTools: ["web_search"],
            selectedImageSize: "1:1",
            reasoningEffort: "medium"
        }
    }
}

export const loadUserInput = (): string => {
    if (typeof window === "undefined") return ""
    const stored = localStorage.getItem(USER_INPUT_KEY)
    return stored?.trim() ?? ""
}

export const saveAIConfig = (config: AIConfig): void => {
    if (typeof window === "undefined") return
    const validated = AIConfigSchema.parse(config)
    localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(validated))
}

export const saveUserInput = (input: string): void => {
    if (typeof window === "undefined") return
    if (input.trim()) localStorage.setItem(USER_INPUT_KEY, input)
    else localStorage.removeItem(USER_INPUT_KEY)
}
