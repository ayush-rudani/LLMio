import { R2 } from "@convex-dev/r2"
import type {
    AssistantContent,
    CoreAssistantMessage,
    CoreToolMessage,
    CoreUserMessage,
    ToolCallPart,
    ToolContent,
    UserContent
} from "ai"
import type { Infer } from "convex/values"
import { components } from "../_generated/api"
import type { Message } from "../schema/message"
import type { ModelAbility } from "../schema/settings"
import { getFileTypeInfo, isImageMimeType } from "./file_constants"

export type ModelMessage = (CoreAssistantMessage | CoreToolMessage | CoreUserMessage) & {
    messageId: string
}
const r2 = new R2(components.r2)

export const dbMessagesToCore = async (
    messages: Infer<typeof Message>[],
    modelAbilities: ModelAbility[]
): Promise<ModelMessage[]> => {
    const mapped_messages: ModelMessage[] = []
    for await (const message of messages) {
        const to_commit_messages: ((CoreAssistantMessage | CoreToolMessage | CoreUserMessage) & {
            messageId: string
        })[] = []
        if (message.role === "user") {
            const mapped_content: UserContent = []

            const failedFileFetch = (type: "image" | "text" | "pdf", filename: string) => {
                mapped_content.push({
                    type: "text",
                    text: `<internal-system-error>Failed to fetch ${type} file ${filename}. Maybe there was an issue or the file was deleted.</internal-system-error>`
                })
            }

            for (const p of message.parts) {
                if (p.type === "text") {
                    mapped_content.push({ type: "text", text: p.text })
                }
                if (p.type === "file") {
                    const _extract = p.file.data.startsWith("attachments/")
                        ? (p.file.data.split("/").pop() ?? "")
                        : ""
                    const extractedFileName = _extract.length > 51 ? _extract.slice(51) : _extract

                    const filename = p.filename || extractedFileName
                    const fileTypeInfo = getFileTypeInfo(filename, p.file.mediaType)

                    if (fileTypeInfo.isImage && isImageMimeType(p.file.mediaType || "")) {
                        // Handle image files
                        try {
                            const fileUrl = await r2.getUrl(p.file.data)
                            const data = await fetch(fileUrl)

                            if (data.ok) {
                                const blob = await data.blob()
                                mapped_content.push({
                                    type: "image",
                                    image: await blob.arrayBuffer()
                                })
                            } else {
                                console.warn(
                                    `[cvx][chat] Failed to fetch image file ${p.file.data}: ${data.status} ${data.statusText}`
                                )
                                failedFileFetch("image", filename)
                            }
                        } catch (error) {
                            console.warn(
                                `[cvx][chat] Error processing image file ${p.file.data}:`,
                                error
                            )
                            failedFileFetch("image", filename)
                        }
                    } else if (fileTypeInfo.isText && !fileTypeInfo.isImage) {
                        try {
                            const fileUrl = await r2.getUrl(p.file.data)
                            const data = await fetch(fileUrl)

                            if (data.ok) {
                                const text = await data.text()
                                mapped_content.push({
                                    type: "text",
                                    text: `<file name="${filename}">\n${text}\n</file>`
                                })
                            } else {
                                console.warn(
                                    `[cvx][chat] Failed to fetch text file ${p.file.data}: ${data.status} ${data.statusText}`
                                )
                                failedFileFetch("text", filename)
                            }
                        } catch (error) {
                            console.warn(`[cvx][chat] Error processing text file ${p.file.data}:`, error)
                            failedFileFetch("text", filename)
                        }
                    } else if (fileTypeInfo.isPdf && modelAbilities.includes("pdf")) {
                        try {
                            const fileUrl = await r2.getUrl(p.file.data)
                            const data = await fetch(fileUrl)

                            if (data.ok) {
                                const blob = await data.blob()
                                mapped_content.push({
                                    type: "file",

                                    file: {
                                        mediaType: "application/pdf",
                                        filename: filename,
                                        data: await blob.arrayBuffer()
                                    }
                                })
                            } else {
                                console.warn(
                                    `[cvx][chat] Failed to fetch text file ${p.file.data}: ${data.status} ${data.statusText}`
                                )
                                failedFileFetch("pdf", filename)
                            }
                        } catch (error) {
                            console.warn(`[cvx][chat] Error processing text file ${p.file.data}:`, error)
                            failedFileFetch("pdf", filename)
                        }
                    } else {
                        mapped_content.push({
                            type: "text",
                            text: fileTypeInfo.isPdf
                                ? "<internal-system-error>PDF files are not supported by this model. Please try again with a different model.</internal-system-error>"
                                : `<internal-system-error>Unsupported file type: ${filename} (${p.file.mediaType})</internal-system-error>`
                        })
                    }
                }
            }

            if (mapped_content.length === 0) {
                console.log(`[cvx][chat] Skipping message with no content: ${message.messageId}`)
                continue
            }

            const lastMessage = mapped_messages[mapped_messages.length - 1]
            if (
                lastMessage &&
                lastMessage.role === "user" &&
                typeof lastMessage.content === "object"
            ) {
                lastMessage.content.push(...mapped_content)
            } else {
                to_commit_messages.unshift({
                    role: "user",
                    messageId: message.messageId,
                    content: mapped_content
                })
            }
        } else if (message.role === "assistant") {
            const mapped_content: AssistantContent = []
            const tool_calls: ToolCallPart[] = []
            const tool_results: ToolContent = []

            // First pass: collect all content and tool results separately
            for (const p of message.parts) {
                if (p.type === "text") {
                    mapped_content.push({ type: "text", text: p.text })
                } else if (p.type === "file") {
                    if (p.file.mediaType?.startsWith("image/") && p.file.data.startsWith("generations/")) {
                        const fileUrl = await r2.getUrl(p.file.data)
                        const data = await fetch(fileUrl)
                        const blob = await data.blob()
                        mapped_content.push({
                            type: "file",

                            file: {
                                mediaType: p.file.mediaType || "image/png",
                                filename: p.filename || "",
                                data: await blob.arrayBuffer()
                            }
                        })
                    } else {
                        mapped_content.push({
                            type: "file",

                            file: {
                                mediaType: p.file.mediaType || "application/octet-stream",
                                filename: p.filename || "",
                                data: p.file.data || ""
                            }
                        })
                    }
                } else if (p.type === "tool-invocation") {
                    tool_calls.push({
                        type: "tool-call",
                        toolCallId: p.toolInvocation.toolCallId,
                        toolName: p.toolInvocation.toolName,
                        args: p.toolInvocation.args
                    })
                    // Collect tool results separately
                    tool_results.push({
                        type: "tool-result",
                        toolCallId: p.toolInvocation.toolCallId,
                        toolName: p.toolInvocation.toolName,
                        result: p.toolInvocation.result
                    })
                } else if (p.type === "reasoning") {
                    mapped_content.push({
                        type: "reasoning",
                        text: p.reasoningText
                    })
                }
            }

            if (mapped_content.length === 0) {
                continue
            }

            // Check if we should merge with the last assistant message
            const lastMessage = mapped_messages[mapped_messages.length - 1]

            if (
                lastMessage &&
                lastMessage.role === "assistant" &&
                tool_calls.length === 0 && // Don't merge if current message has tool results
                typeof lastMessage.content === "object"
            ) {
                // Merge with previous assistant message
                lastMessage.content.push(...mapped_content)
            } else {
                if (tool_calls.length > 0) {
                    to_commit_messages.unshift({
                        role: "assistant",
                        messageId: `${message.messageId}-tool-call`,
                        content: tool_calls
                    })
                    to_commit_messages.unshift({
                        role: "tool",
                        messageId: `${message.messageId}-tool-result`,
                        content: tool_results
                    })
                }

                // Create new assistant message
                to_commit_messages.unshift({
                    role: "assistant",
                    messageId: message.messageId,
                    content: mapped_content
                })
            }
        }

        mapped_messages.push(...to_commit_messages)
    }

    mapped_messages.reverse()

    // console.log("[cvx][chat] mapped_messages", mapped_messages.length)
    // for (let i = 0; i < mapped_messages.length; i++) {
    //     const m = mapped_messages[i]
    //     const roughContent =
    //         typeof m.content === "object"
    //             ? m.content
    //                   .map((c) => (c.type === "text" ? c.text.slice(0, 100) : `[${c.type}]`))
    //                   .join(",")
    //             : m.content
    //     console.log(` History[${i}](${m.role}) ${roughContent}`)
    // }
    return mapped_messages
}
