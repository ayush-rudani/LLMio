import type { SharedModel } from "./models"

export const MODELS_SHARED_LEGACY: SharedModel[] = [
    {
        id: "o3-mini",
        name: "o3 mini",
        adapters: ["openai:o3-mini", "openrouter:openai/o3-mini"],
        abilities: ["reasoning", "function_calling", "effort_control"]
    },
    {
        id: "o3",
        name: "o3",
        adapters: ["openai:o3", "openrouter:openai/o3"],
        abilities: ["reasoning", "vision", "function_calling", "pdf", "effort_control"]
    },
    {
        id: "gpt-4.1-mini",
        name: "GPT 4.1 mini",
        shortName: "4.1 mini",
        adapters: [
            "i3-openai:gpt-4.1-mini",
            "openai:gpt-4.1-mini",
            "openrouter:openai/gpt-4.1-mini"
        ],
        abilities: ["vision", "function_calling", "pdf"]
    },
    {
        id: "gpt-4.1-nano",
        name: "GPT 4.1 nano",
        shortName: "4.1 nano",
        adapters: [
            "i3-openai:gpt-4.1-nano",
            "openai:gpt-4.1-nano",
            "openrouter:openai/gpt-4.1-nano"
        ],
        abilities: ["vision", "function_calling", "pdf"]
    },
    {
        id: "claude-3-5-sonnet",
        name: "Claude Sonnet 3.5",
        shortName: "Sonnet 3.5",
        adapters: ["anthropic:claude-3-5-sonnet", "openrouter:anthropic/claude-3.5-sonnet"],
        abilities: ["vision", "function_calling", "pdf"]
    },
    {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        shortName: "2.0 Flash",
        adapters: [
            "i3-google:gemini-2.0-flash",
            "google:gemini-2.0-flash",
            "openrouter:google/gemini-2.0-flash-001"
        ],
        abilities: ["vision", "function_calling", "pdf"]
    },
    {
        id: "llama-4-scout-17b-16e-instruct",
        name: "Llama 4 Scout 17B 16E",
        shortName: "Llama 4 Scout 17B",
        adapters: [
            "i3-groq:meta-llama/llama-4-scout-17b-16e-instruct",
            "groq:meta-llama/llama-4-scout-17b-16e-instruct"
        ],
        abilities: ["vision"],
        customIcon: "meta"
    },
    {
        id: "llama-4-maverick-17b-128e-instruct",
        name: "Llama 4 Maverick 17B 128E Instruct",
        shortName: "Llama 4 Maverick 17B",
        adapters: ["groq:meta-llama/llama-4-maverick-17b-128e-instruct"],
        abilities: ["vision"],
        customIcon: "meta"
    }
] as const
