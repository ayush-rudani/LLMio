import { ChatError } from "@/lib/errors"
import { type ModelMessage, generateText } from "ai"
import type { GenericActionCtx } from "convex/server"
import type { Infer } from "convex/values"
import { internal } from "../_generated/api"
import type { DataModel, Id } from "../_generated/dataModel"
import type { UserSettings } from "../schema"
import { getModel } from "./get_model"

const contentToText = (content: ModelMessage["content"]): string => {
    if (typeof content === "string") {
        return content
    }

    if (Array.isArray(content)) {
        return content
            .map((part) => {
                if (part.type === "text") {
                    return part.text
                }
                if (part.type === "image") {
                    return "[image]"
                }
                if (part.type === "file") {
                    return `[file: ${part.filename || "unknown"}]`
                }
                if (part.type === "tool-call") {
                    return `[tool: ${part.toolName}]`
                }
                if (part.type === "tool-result") {
                    return `[tool result: ${part.toolName}]`
                }
                if (part.type === "reasoning") {
                    return `[reasoning: ${part.text}]`
                }
                return ""
            })
            .join(" ")
    }

    return ""
}

export const generateThreadName = async (
    ctx: GenericActionCtx<DataModel>,
    threadId: Id<"threads">,
    messages: ModelMessage[],
    userId: string,
    settings: Infer<typeof UserSettings>
) => {
    const relevant_messages = messages.filter((message) => message.role !== "system").slice(0, 5)

    const modelData = await getModel(ctx, settings.titleGenerationModel)
    if (modelData instanceof ChatError) return modelData
    const { model } = modelData
    if (model.modelType === "image")
        return new ChatError(
            "bad_request:api",
            "Why is your title generation model an image model?"
        )

    const result = await generateText({
        model,
        messages: [
            {
                role: "system",
                content: `
You are tasked with generating a concise, descriptive title for a chat conversation based on the initial messages. The title should:

1. Be 2-6 words long
2. Capture the main topic or question being discussed
3. Be clear and specific
4. Use title case (capitalize first letter of each major word)
5. Not include quotation marks or special characters
6. Be professional and appropriate

Examples of good titles:
- "Python Data Analysis Help"
- "React Component Design"
- "Travel Planning Italy"
- "Budget Spreadsheet Formula"
- "Career Change Advice"

Generate a title that accurately represents what this conversation is about based on the messages provided.`
            },
            {
                role: "user",
                content: `Conversation excerpt:

${relevant_messages
    .map((message) => {
        const text = contentToText(message.content)
        return `${message.role}: ${text.slice(0, 600)}${text.length > 600 ? "..." : ""}`
    })
    .join("\n")}

Generate a title that accurately represents what this conversation is about based on the messages provided.`
            }
        ]
    })

    await ctx.runMutation(internal.threads.updateThreadName, {
        threadId,
        name: result.text
    })

    return result.text
}
