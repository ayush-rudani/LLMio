import { R2 } from "@convex-dev/r2"
import type { AssistantContent, ModelMessage, ToolCallPart, ToolContent, UserContent } from "ai"
import type { Infer } from "convex/values"
import { components } from "../_generated/api"
import type { MessageV2 } from "../schema/message"
import type { ModelAbility } from "../schema/settings"
import { getFileTypeInfo, isImageMimeType } from "./file_constants"

export type CoreMessage = ModelMessage & {
    messageId: string
}
const r2 = new R2(components.r2)

export const dbMessagesToCore = async (
    messages: Infer<typeof MessageV2>[],
    modelAbilities: ModelAbility[]
): Promise<CoreMessage[]> => {
    const mapped_messages: CoreMessage[] = []
    for await (const message of messages) {
        const to_commit_messages: CoreMessage[] = []
        if (message.role === "user") {
            const mapped_content: UserContent = []

            const failedFileFetch = (type: "image" | "text" | "pdf", filename: string) => {
                mapped_content.push({
                    type: "text",
                    text: `<internal-system-error>Failed to fetch ${type} file ${filename}. Maybe there was an issue or the file was deleted.</internal-system-error>`
                })
            }

            for (const p of message.parts) {
                if (p.type === "text" && "text" in p) {
                    mapped_content.push({ type: "text", text: p.text })
                }
                if (p.type === "file" && "mediaType" in p && "data" in p) {
                    const _extract = p.mediaType ? (p.url.split("/").pop() ?? "") : ""
                    const extractedFileName = _extract.length > 51 ? _extract.slice(51) : _extract

                    const filename = p.filename || extractedFileName
                    const fileTypeInfo = getFileTypeInfo(filename, p.mediaType)

                    if (fileTypeInfo.isImage && isImageMimeType(p.mediaType || "")) {
                        // Handle image files
                        try {
                            const fileUrl = await r2.getUrl(p.url)
                            const data = await fetch(fileUrl)

                            if (data.ok) {
                                const blob = await data.blob()
                                mapped_content.push({
                                    type: "image",
                                    image: await blob.arrayBuffer()
                                })
                            } else {
                                console.warn(
                                    `[cvx][chat] Failed to fetch image file ${p.data}: ${data.status} ${data.statusText}`
                                )
                                failedFileFetch("image", filename)
                            }
                        } catch (error) {
                            console.warn(
                                `[cvx][chat] Error processing image file ${p.data}:`,
                                error
                            )
                            failedFileFetch("image", filename)
                        }
                    } else if (fileTypeInfo.isText && !fileTypeInfo.isImage) {
                        try {
                            const fileUrl = await r2.getUrl(p.url)
                            const data = await fetch(fileUrl)

                            if (data.ok) {
                                const text = await data.text()
                                mapped_content.push({
                                    type: "text",
                                    text: `<file name="${filename}">\n${text}\n</file>`
                                })
                            } else {
                                console.warn(
                                    `[cvx][chat] Failed to fetch text file ${p.data}: ${data.status} ${data.statusText}`
                                )
                                failedFileFetch("text", filename)
                            }
                        } catch (error) {
                            console.warn(`[cvx][chat] Error processing text file ${p.data}:`, error)
                            failedFileFetch("text", filename)
                        }
                    } else if (fileTypeInfo.isPdf && modelAbilities.includes("pdf")) {
                        try {
                            const fileUrl = await r2.getUrl(p.url)
                            const data = await fetch(fileUrl)

                            if (data.ok) {
                                const blob = await data.blob()
                                mapped_content.push({
                                    type: "file",
                                    mediaType: "application/pdf",
                                    filename: filename,
                                    data: await blob.arrayBuffer()
                                })
                            } else {
                                console.warn(
                                    `[cvx][chat] Failed to fetch text file ${p.data}: ${data.status} ${data.statusText}`
                                )
                                failedFileFetch("pdf", filename)
                            }
                        } catch (error) {
                            console.warn(`[cvx][chat] Error processing text file ${p.data}:`, error)
                            failedFileFetch("pdf", filename)
                        }
                    } else {
                        mapped_content.push({
                            type: "text",
                            text: fileTypeInfo.isPdf
                                ? "<internal-system-error>PDF files are not supported by this model. Please try again with a different model.</internal-system-error>"
                                : `<internal-system-error>Unsupported file type: ${filename} (${p.mediaType})</internal-system-error>`
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
                if (p.type === "text" && "text" in p) {
                    mapped_content.push({ type: "text", text: p.text })
                } else if (p.type === "file" && "mediaType" in p && "url" in p) {
                    if (p.mediaType?.startsWith("image/") && p.url.startsWith("generations/")) {
                        const fileUrl = await r2.getUrl(p.url)
                        const data = await fetch(fileUrl)
                        const blob = await data.blob()
                        mapped_content.push({
                            type: "file",
                            mediaType: p.mediaType || "image/png",
                            filename: p.filename || "",
                            data: await blob.arrayBuffer()
                        })
                    } else {
                        mapped_content.push({
                            type: "file",
                            mediaType: p.mediaType || "application/octet-stream",
                            filename: p.filename || "",
                            data: p.url || ""
                        })
                    }
                } else if (
                    p.type.startsWith("tool-") &&
                    "toolCallId" in p &&
                    "toolName" in p &&
                    "input" in p
                ) {
                    tool_calls.push({
                        type: "tool-call",
                        toolCallId: p.toolCallId,
                        input: p.input,
                        toolName: p.toolName as string
                    })
                    // Collect tool results separately
                    tool_results.push({
                        type: "tool-result",
                        toolCallId: p.toolCallId,
                        toolName: p.toolName,
                        output: "output" in p ? p.output : undefined
                    })
                } else if (p.type === "reasoning" && "text" in p) {
                    mapped_content.push({
                        type: "reasoning",
                        text: p.text
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
