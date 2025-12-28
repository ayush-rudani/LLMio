import type { UIMessage as AIUIMessage } from "ai"
import type { Infer } from "convex/values"
import type { Message } from "../schema"
import type { AIMessage } from "../schema/message"

type AIUIMessageWithParts = Omit<undefined, "parts"> & {
    parts: NonNullable<undefined["parts"]>
    metadata?: Infer<typeof AIMessage>["metadata"]
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
            parts: (message.parts as unknown as NonNullable<undefined["parts"]>) ?? []
        }
        return uiMessage
    })

    return result
}
