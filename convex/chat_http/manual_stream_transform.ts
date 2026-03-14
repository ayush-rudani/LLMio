import type { FileUIPart, ReasoningUIPart, TextUIPart, UIMessageChunk } from "ai"

import { DelayedPromise } from "@/lib/delayed-promise"
import type { TextStreamPart, ToolSet } from "ai"
import type { GenericActionCtx } from "convex/server"
import type { Infer } from "convex/values"
import type { DataModel } from "../_generated/dataModel"
import { r2 } from "../attachments"
import type { ErrorUIPart } from "../schema/parts"

// Type for tool invocation parts we store (compatible with v4 structure for DB)
type ToolInvocationPart = {
    type: "tool-invocation"
    toolInvocation: {
        state: "partial-call" | "call" | "result"
        toolCallId: string
        toolName: string
        args?: unknown
        result?: unknown
    }
}

export const manualStreamTransform = (
    parts: Array<
        | TextUIPart
        | (ReasoningUIPart & { duration?: number })
        | ToolInvocationPart
        | FileUIPart
        | Infer<typeof ErrorUIPart>
    >,
    totalTokenUsage: {
        inputTokens: number
        outputTokens: number
        reasoningTokens: number
    },
    _assistantMessageId: string,
    uploadPromises: Promise<void>[],
    userId: string,
    actionCtx: GenericActionCtx<DataModel>
) => {
    let reasoningStartedAt = -1

    const appendTextPart = (text: string, type: "text" | "reasoning") => {
        if (parts.length > 0 && parts[parts.length - 1]?.type === type) {
            if (type === "text") {
                ;(parts[parts.length - 1] as TextUIPart).text += text
            } else if (type === "reasoning") {
                ;(parts[parts.length - 1] as ReasoningUIPart).text += text
                ;(
                    parts[parts.length - 1] as ReasoningUIPart & {
                        duration?: number
                    }
                ).duration = Date.now() - reasoningStartedAt
            }
        } else {
            if (type === "text") {
                parts.push({
                    type: "text",
                    text
                })
            } else if (type === "reasoning") {
                if (reasoningStartedAt === -1) {
                    reasoningStartedAt = Date.now()
                }
                parts.push({
                    type: "reasoning",
                    text: text
                })
            }
        }
    }

    return new TransformStream<TextStreamPart<ToolSet>, UIMessageChunk>({
        transform: async (chunk, controller) => {
            const chunkType = chunk.type
            switch (chunkType) {
                case "text-delta": {
                    controller.enqueue({
                        type: "text-delta",
                        delta: chunk.text,
                        id: chunk.id
                    })
                    appendTextPart(chunk.text, "text")
                    break
                }

                case "reasoning-delta": {
                    controller.enqueue({
                        type: "reasoning-delta",
                        delta: chunk.text,
                        id: chunk.id
                    })
                    appendTextPart(chunk.text, "reasoning")
                    break
                }

                case "file": {
                    const file = chunk.file
                    if (file.mediaType?.startsWith("image/")) {
                        const promise = new DelayedPromise<void>()
                        uploadPromises.push(promise.value)
                        const fileExtension = file.mediaType.split("/")[1] || "png"
                        const key = `generations/${userId}/${Date.now()}-${crypto.randomUUID()}-gen.${fileExtension}`

                        // Use the uint8Array from GeneratedFile
                        const uint8Array = file.uint8Array

                        const storedKey = await r2.store(actionCtx, uint8Array, {
                            authorId: userId,
                            key,
                            type: file.mediaType
                        })

                        console.log("Stored model-generated image to R2:", storedKey)

                        parts.push({
                            type: "file",
                            mediaType: file.mediaType,
                            url: storedKey
                        })

                        promise.resolve()

                        controller.enqueue({
                            type: "file",
                            mediaType: file.mediaType,
                            url: storedKey
                        })
                    } else {
                        // For non-image files, use base64 encoding
                        controller.enqueue({
                            type: "file",
                            mediaType: file.mediaType || "application/octet-stream",
                            url: `data:${file.mediaType};base64,${file.base64}`
                        })
                    }
                    break
                }

                case "source": {
                    // In v5, source is flattened - properties are directly on chunk
                    if (chunk.sourceType === "url") {
                        controller.enqueue({
                            type: "source-url",
                            sourceId: chunk.id,
                            url: chunk.url,
                            title: chunk.title
                        })
                    }
                    break
                }

                case "tool-input-start": {
                    controller.enqueue({
                        type: "tool-input-start",
                        toolCallId: chunk.id,
                        toolName: chunk.toolName
                    })
                    break
                }

                case "tool-input-delta": {
                    controller.enqueue({
                        type: "tool-input-delta",
                        toolCallId: chunk.id,
                        inputTextDelta: chunk.delta
                    })
                    break
                }

                case "tool-call": {
                    controller.enqueue({
                        type: "tool-input-available",
                        toolCallId: chunk.toolCallId,
                        toolName: chunk.toolName,
                        input: chunk.input
                    })

                    // Store in v4-compatible format for the database
                    parts.push({
                        type: "tool-invocation",
                        toolInvocation: {
                            state: "call",
                            args: chunk.input,
                            toolCallId: chunk.toolCallId,
                            toolName: chunk.toolName
                        }
                    })
                    break
                }

                case "tool-result": {
                    controller.enqueue({
                        type: "tool-output-available",
                        toolCallId: chunk.toolCallId,
                        output: chunk.output
                    })

                    const found = parts.findIndex(
                        (p) =>
                            p.type === "tool-invocation" &&
                            (p as ToolInvocationPart).toolInvocation.toolCallId === chunk.toolCallId
                    )
                    if (found !== -1) {
                        const _part = parts[found] as ToolInvocationPart
                        _part.toolInvocation.state = "result"
                        _part.toolInvocation.result = chunk.output
                    }

                    break
                }

                case "error": {
                    console.log("chunk.error", chunk.error)
                    console.error(`[cvx][chat][stream] Error: ${chunk.error}`)
                    let error_message = "An error occurred"
                    if (typeof chunk.error === "string") {
                        error_message = chunk.error
                    } else if (chunk.error instanceof Error) {
                        error_message = chunk.error.message
                    } else if (
                        chunk.error &&
                        typeof chunk.error === "object" &&
                        "error" in chunk.error
                    ) {
                        const err = chunk.error as { error: Error | { error: unknown } }
                        if (err.error instanceof Error) {
                            error_message = err.error.message
                        } else if (
                            typeof err.error === "object" &&
                            err.error !== null &&
                            "error" in err.error
                        ) {
                            error_message = String((err.error as { error: unknown }).error)
                        }
                    }

                    parts.push({
                        type: "error",
                        error: {
                            code: "unknown",
                            message: error_message
                        }
                    })
                    controller.enqueue({
                        type: "error",
                        errorText: error_message
                    })
                    break
                }

                case "start-step": {
                    controller.enqueue({
                        type: "start-step"
                    })
                    break
                }

                case "finish-step": {
                    controller.enqueue({
                        type: "finish-step"
                    })
                    totalTokenUsage.inputTokens += chunk.usage.inputTokens || 0
                    totalTokenUsage.outputTokens += chunk.usage.outputTokens || 0

                    console.log(
                        "chunk.providerMetadata",
                        chunk.providerMetadata,
                        "totalTokenUsage",
                        totalTokenUsage
                    )
                    if (
                        chunk.providerMetadata?.openai?.reasoningTokens &&
                        typeof chunk.providerMetadata.openai.reasoningTokens === "number"
                    ) {
                        totalTokenUsage.reasoningTokens +=
                            chunk.providerMetadata.openai.reasoningTokens
                    }
                    break
                }

                case "finish": {
                    break
                }

                // Handle new v5 stream events that we don't need to persist but should pass through
                case "text-start":
                case "text-end":
                case "reasoning-start":
                case "reasoning-end":
                case "tool-input-end": {
                    // Pass through lifecycle events
                    controller.enqueue(chunk as unknown as UIMessageChunk)
                    break
                }

                case "start":
                case "abort":
                case "raw":
                case "tool-error":
                case "tool-output-denied":
                case "tool-approval-request": {
                    // Log but don't process these
                    console.log(`[cvx][chat][stream] Received ${chunkType} event`)
                    break
                }

                default: {
                    // For any other chunk types, log them
                    console.log(
                        `[cvx][chat][stream] Unhandled chunk type: ${(chunk as { type: string }).type}`
                    )
                    break
                }
            }
        }
    })
}
