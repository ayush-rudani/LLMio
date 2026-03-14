import type { Id } from "@/convex/_generated/dataModel"
import { type UploadedFile, useChatStore } from "@/lib/chat-store"
import type { FileUIPart } from "ai" // Changed from "@ai-sdk/ui-utils"
import type { UIMessage } from "ai"
import { useCallback } from "react"
import { useChatIntegration } from "./use-chat-integration"

export function useChatActions({
    threadId,
    folderId
}: {
    threadId: string | undefined
    folderId?: Id<"projects">
}) {
    const { uploadedFiles, setUploadedFiles, setTargetFromMessageId, setTargetMode } =
        useChatStore()
    // Changed: append → sendMessage, reload → regenerate
    const { status, sendMessage, stop, messages, setMessages, regenerate } = useChatIntegration({
        threadId,
        folderId
    })

    const handleInputSubmit = useCallback(
        (inputValue?: string, fileValues?: UploadedFile[]) => {
            if (status === "streaming") {
                stop()
                return
            }

            if (status === "submitted") {
                return
            }

            if (!inputValue || !inputValue.trim()) {
                return
            }

            const finalInput = inputValue
            const finalFiles = fileValues ?? uploadedFiles

            if (!finalInput?.trim() && finalFiles && finalFiles.length === 0) {
                return
            }

            // V5: Use sendMessage instead of append, remove content property
            sendMessage({
                // V5: Don't include id, role, createdAt - these are handled by useChat
                parts: [
                    ...finalFiles.map((file) => {
                        return {
                            type: "file" as const,
                            url: file.key, // Changed: data → url
                            mediaType: file.fileType // Changed: mimeType → mediaType
                        } satisfies FileUIPart
                    }),
                    { type: "text" as const, text: finalInput }
                ]
            })

            setUploadedFiles([])
        },
        [sendMessage, stop, status, uploadedFiles, setUploadedFiles]
    )

    const handleRetry = useCallback(
        (message: UIMessage) => {
            const messageIndex = messages.findIndex((m) => m.id === message.id)
            if (messageIndex === -1) return

            const messagesUpToRetry = messages.slice(0, messageIndex + 1)
            console.log("[CA:handleRetry]", {
                messages,
                messagesUpToRetry: messagesUpToRetry.length,
                messageIndex,
                messageId: message.id
            })
            setMessages(messagesUpToRetry)
            setTargetFromMessageId(message.id)
            setTargetMode("retry")
            // V5: regenerate takes messageId as parameter, body is passed as second argument
            regenerate({ messageId: message.id })
        },
        [messages, setMessages, regenerate, setTargetFromMessageId, setTargetMode]
    )

    const handleEditAndRetry = useCallback(
        (messageId: string, newContent: string) => {
            const messageIndex = messages.findIndex((m) => m.id === messageId)
            if (messageIndex === -1) return

            // Truncate messages and update the edited message
            const messagesUpToEdit = messages.slice(0, messageIndex)
            const updatedEditedMessage = {
                ...messages[messageIndex],
                // V5: Remove content property, only use parts
                parts: [{ type: "text" as const, text: newContent }]
            }

            console.log("alarm:handleEditAndRetry", {
                messagesUpToEdit: messagesUpToEdit.length,
                messageIndex,
                messageId
            })
            setMessages([...messagesUpToEdit, updatedEditedMessage])
            setTargetFromMessageId(messageId)
            setTargetMode("edit")
            // V5: regenerate takes messageId as parameter, body is passed as second argument
            regenerate({ messageId })
        },
        [messages, setMessages, setTargetFromMessageId, setTargetMode, regenerate]
    )

    return {
        handleInputSubmit,
        handleRetry,
        handleEditAndRetry
    }
}
