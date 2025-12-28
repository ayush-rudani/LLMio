import type { Id } from "@/convex/_generated/dataModel"
import { type UploadedFile, useChatStore } from "@/lib/chat-store"
import type { FileUIPart } from "ai"
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

            // Convert uploaded files to v6 FileUIPart format
            const fileParts: FileUIPart[] = finalFiles.map((file) => ({
                type: "file",
                url: file.key,
                mediaType: file.fileType
            }))

            // Use v6 sendMessage API with text + files
            sendMessage({
                text: inputValue,
                files: fileParts.length > 0 ? fileParts : undefined
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
            setTargetFromMessageId(undefined)
            setTargetMode("normal")
            // Use v6 regenerate API
            regenerate({
                messageId: message.id,
                body: {
                    targetMode: "retry",
                    targetFromMessageId: message.id
                }
            })
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
                content: newContent,
                parts: [{ type: "text" as const, text: newContent }]
            }

            console.log("alarm:handleEditAndRetry", {
                messagesUpToEdit: messagesUpToEdit.length,
                messageIndex,
                messageId
            })
            setMessages([...messagesUpToEdit, updatedEditedMessage])
            setTargetFromMessageId(undefined)
            setTargetMode("normal")
            // Use v6 regenerate API
            regenerate({
                messageId,
                body: {
                    targetMode: "edit",
                    targetFromMessageId: messageId
                }
            })
        },
        [messages, setMessages, setTargetFromMessageId, regenerate, setTargetMode]
    )

    return {
        handleInputSubmit,
        handleRetry,
        handleEditAndRetry
    }
}
