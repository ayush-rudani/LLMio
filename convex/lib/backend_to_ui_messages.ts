import type { UIMessage } from "ai"
import type { Infer } from "convex/values"
import type { Message } from "../schema"
import type { AIMessage } from "../schema/message"

// Extended UIMessage with metadata from our database schema
// Also includes 'content' for compatibility with useChat's Message type
type AIUIMessageWithParts = UIMessage & {
    metadata?: Infer<typeof AIMessage>["metadata"]
    content: string
}

export const backendToUiMessages = (messages: Infer<typeof Message>[]): AIUIMessageWithParts[] => {
    if (!messages || messages.length === 0) {
        return []
    }

    const result = messages.map((message) => {
        // Extract text content from parts for compatibility with useChat Message type
        const parts = (message.parts as unknown as UIMessage["parts"]) ?? []
        const textContent = parts
            .filter((part): part is { type: "text"; text: string } => part.type === "text")
            .map((part) => part.text)
            .join("")

        const uiMessage: AIUIMessageWithParts = {
            metadata: message.metadata,
            id: message.messageId,
            role: message.role,
            parts,
            content: textContent
        }
        return uiMessage
    })

    return result
}
