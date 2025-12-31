import type { UIMessage as AIUIMessage } from "ai"
import type { Message as AIUIMessageV1 } from "ai-legacy"
import type { Infer } from "convex/values"
import type { Message, MessageV2 } from "../schema"
import type { AIMessage, AIMessageV2 } from "../schema/message"

type AIUIMessageWithParts = Omit<AIUIMessageV1, "parts"> & {
    parts: NonNullable<AIUIMessage["parts"]>
    metadata?: Infer<typeof AIMessage>["metadata"]
}

type AIUIMessageWithPartsV2 = Omit<AIUIMessage, "parts"> & {
    parts: NonNullable<AIUIMessage["parts"]>
    metadata?: Infer<typeof AIMessageV2>["metadata"]
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
            content: message.parts?.find((p) => p.type === "text")?.text || "",
            parts: (message.parts as unknown as NonNullable<AIUIMessage["parts"]>) ?? []
        }
        return uiMessage
    })

    return result
}

export const backendToUiMessagesV2 = (
    messages: Infer<typeof MessageV2>[]
): AIUIMessageWithPartsV2[] => {
    if (!messages || messages.length === 0) {
        return []
    }

    const result = messages.map((message) => {
        const uiMessage: AIUIMessageWithPartsV2 = {
            metadata: message.metadata,
            id: message.messageId,
            role: message.role,
            parts: message.parts as unknown as NonNullable<AIUIMessage["parts"]>
        }
        return uiMessage
    })

    return result
}
