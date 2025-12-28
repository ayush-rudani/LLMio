import type { UIMessage as AIUIMessage } from "ai"
import type { Infer } from "convex/values"
import type { Message } from "../schema"
import type { AIMessage } from "../schema/message"

// Custom type that extends UIMessage with metadata and createdAt
export type AIUIMessageWithParts = AIUIMessage & {
    metadata?: Infer<typeof AIMessage>["metadata"]
    createdAt?: Date
}

export const backendToUiMessages = (messages: Infer<typeof Message>[]): AIUIMessageWithParts[] => {
    if (!messages || messages.length === 0) {
        return []
    }

    const result = messages.map((message) => {
        const uiMessage: AIUIMessageWithParts = {
            metadata: message.metadata,
            id: message.messageId,
            role: message.role,
            createdAt: new Date(message.createdAt),
            parts: (message.parts as unknown as AIUIMessage["parts"]) ?? []
        }
        return uiMessage
    })

    return result
}
