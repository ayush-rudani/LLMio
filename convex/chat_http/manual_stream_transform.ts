import type { ToolInvocationUIPart } from "@ai-sdk/ui-utils"

import { DelayedPromise } from "@/lib/delayed-promise"
import type { TextStreamPart, ToolSet, UIMessageChunk } from "ai"
import type { GenericActionCtx } from "convex/server"
import type { Infer } from "convex/values"
import { nanoid } from "nanoid"
import type { DataModel } from "../_generated/dataModel"
import { r2 } from "../attachments"
import type { ErrorUIPart, FilePart, ReasoningPart, TextPart } from "../schema/parts"

// Custom data types for our app
type AppDataTypes = {
    thread_id: { type: "thread_id"; content: string }
    stream_id: { type: "stream_id"; content: string }
    model_name: { type: "model_name"; content: string }
}

export type AppUIMessageChunk = UIMessageChunk<unknown, AppDataTypes>

// Database-compatible part types (matches Convex schema)
export type DbPart =
    | Infer<typeof TextPart>
    | Infer<typeof ReasoningPart>
    | ToolInvocationUIPart
    | Infer<typeof FilePart>
    | Infer<typeof ErrorUIPart>

export const manualStreamTransform = (
    parts: Array<DbPart>,
    totalTokenUsage: {
        promptTokens: number
        completionTokens: number
        reasoningTokens: number
    },
    _assistantMessageId: string,
    uploadPromises: Promise<void>[],
    userId: string,
    actionCtx: GenericActionCtx<DataModel>
) => {
    let reasoningStartedAt = -1
    let currentTextId: string | null = null
    let currentReasoningId: string | null = null

    const appendTextPart = (text: string, type: "text" | "reasoning") => {
        if (parts.length > 0 && parts[parts.length - 1]?.type === type) {
            if (type === "text") {
                // Database schema uses 'text' property
                ;(parts[parts.length - 1] as Infer<typeof TextPart>).text += text
            } else if (type === "reasoning") {
                // Database schema uses 'reasoning' property (not 'text')
                ;(parts[parts.length - 1] as Infer<typeof ReasoningPart>).reasoning += text
                ;(parts[parts.length - 1] as Infer<typeof ReasoningPart>).duration =
                    Date.now() - reasoningStartedAt
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
                // Database schema uses 'reasoning' property
                parts.push({
                    type: "reasoning",
                    reasoning: text,
                    duration: 0
                })
            }
        }
    }

    return new TransformStream<TextStreamPart<ToolSet>, AppUIMessageChunk>({
        transform: async (chunk, controller) => {
            const chunkType = chunk.type
            switch (chunkType) {
                case "text-start": {
                    currentTextId = nanoid()
                    controller.enqueue({
                        type: "text-start",
                        id: currentTextId
                    })
                    break
                }

                case "text-delta": {
                    if (!currentTextId) {
                        currentTextId = nanoid()
                        controller.enqueue({
                            type: "text-start",
                            id: currentTextId
                        })
                    }
                    controller.enqueue({
                        type: "text-delta",
                        id: currentTextId,
                        delta: chunk.text
                    })
                    appendTextPart(chunk.text, "text")
                    break
                }

                case "text-end": {
                    if (currentTextId) {
                        controller.enqueue({
                            type: "text-end",
                            id: currentTextId
                        })
                        currentTextId = null
                    }
                    break
                }

                case "reasoning-start": {
                    if (reasoningStartedAt === -1) {
                        reasoningStartedAt = Date.now()
                    }
                    currentReasoningId = nanoid()
                    controller.enqueue({
                        type: "reasoning-start",
                        id: currentReasoningId
                    })
                    break
                }

                case "reasoning-delta": {
                    if (!currentReasoningId) {
                        currentReasoningId = nanoid()
                        if (reasoningStartedAt === -1) {
                            reasoningStartedAt = Date.now()
                        }
                        controller.enqueue({
                            type: "reasoning-start",
                            id: currentReasoningId
                        })
                    }
                    controller.enqueue({
                        type: "reasoning-delta",
                        id: currentReasoningId,
                        delta: chunk.text
                    })
                    appendTextPart(chunk.text, "reasoning")
                    break
                }

                case "reasoning-end": {
                    if (currentReasoningId) {
                        controller.enqueue({
                            type: "reasoning-end",
                            id: currentReasoningId
                        })
                        currentReasoningId = null
                    }
                    break
                }

                case "file": {
                    const file = chunk.file
                    if (file.mediaType.startsWith("image/")) {
                        const promise = new DelayedPromise<void>()
                        uploadPromises.push(promise.value)
                        const fileExtension = file.mediaType.split("/")[1] || "png"
                        const key = `generations/${userId}/${Date.now()}-${crypto.randomUUID()}-gen.${fileExtension}`

                        const storedKey = await r2.store(actionCtx, file.uint8Array, {
                            authorId: userId,
                            key,
                            type: file.mediaType
                        })

                        console.log("Stored model-generated image to R2:", storedKey)

                        // Database schema uses 'data' and 'mimeType' for FilePart
                        parts.push({
                            type: "file",
                            data: storedKey,
                            mimeType: file.mediaType
                        })

                        promise.resolve()

                        // Stream uses v6 format with 'url' and 'mediaType'
                        controller.enqueue({
                            type: "file",
                            mediaType: file.mediaType,
                            url: storedKey
                        })
                    } else {
                        controller.enqueue({
                            type: "file",
                            mediaType: file.mediaType,
                            url: file.base64
                        })
                    }
                    break
                }

                case "source": {
                    // In v6, source chunk has sourceType property
                    if (chunk.sourceType === "url") {
                        controller.enqueue({
                            type: "source-url",
                            sourceId: chunk.id,
                            url: chunk.url,
                            title: chunk.title
                        })
                    } else if (chunk.sourceType === "document") {
                        controller.enqueue({
                            type: "source-document",
                            sourceId: chunk.id,
                            mediaType: chunk.mediaType,
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

                case "tool-input-end": {
                    // End of tool input streaming - no specific chunk type needed
                    break
                }

                case "tool-call": {
                    // In v6, tool calls use 'input' instead of 'args'
                    const toolInput = chunk.input

                    controller.enqueue({
                        type: "tool-input-available",
                        toolCallId: chunk.toolCallId,
                        toolName: chunk.toolName,
                        input: toolInput
                    })

                    parts.push({
                        type: "tool-invocation",
                        toolInvocation: {
                            state: "call",
                            args: toolInput,
                            toolCallId: chunk.toolCallId,
                            toolName: chunk.toolName
                        }
                    })
                    break
                }

                case "tool-result": {
                    // In v6, tool results use 'output' instead of 'result'
                    const toolOutput = chunk.output

                    controller.enqueue({
                        type: "tool-output-available",
                        toolCallId: chunk.toolCallId,
                        output: toolOutput
                    })

                    const found = parts.findIndex(
                        (p) =>
                            p.type === "tool-invocation" &&
                            p.toolInvocation.toolCallId === chunk.toolCallId
                    )
                    if (found !== -1) {
                        const _part = parts[found] as ToolInvocationUIPart
                        _part.toolInvocation.state = "result"
                        ;(
                            _part.toolInvocation as ToolInvocationUIPart["toolInvocation"] & {
                                result: unknown
                            }
                        ).result = toolOutput
                    }

                    break
                }

                case "tool-error": {
                    // Handle tool execution errors
                    const errorChunk = chunk as { toolCallId: string; error: unknown }
                    console.error(`[cvx][chat][stream] Tool error: ${errorChunk.error}`)

                    controller.enqueue({
                        type: "tool-output-error",
                        toolCallId: errorChunk.toolCallId,
                        errorText:
                            typeof errorChunk.error === "string"
                                ? errorChunk.error
                                : String(errorChunk.error)
                    })
                    break
                }

                case "tool-output-denied": {
                    // Handle tool output denied
                    const deniedChunk = chunk as { toolCallId: string }
                    console.log("[cvx][chat][stream] Tool output denied")
                    controller.enqueue({
                        type: "tool-output-denied",
                        toolCallId: deniedChunk.toolCallId
                    })
                    break
                }

                case "tool-approval-request": {
                    // Handle tool approval requests
                    console.log("[cvx][chat][stream] Tool approval request")
                    controller.enqueue({
                        type: "tool-approval-request",
                        approvalId: chunk.approvalId || nanoid(),
                        toolCallId: chunk.toolCall.toolCallId
                    })
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
                        if ((chunk.error as { error: Error }).error instanceof Error) {
                            error_message = (chunk.error as { error: Error }).error.message
                        } else {
                            error_message = String((chunk.error as { error: unknown }).error)
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
                    totalTokenUsage.promptTokens += chunk.usage.inputTokens || 0
                    totalTokenUsage.completionTokens += chunk.usage.outputTokens || 0

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

                case "start":
                case "finish":
                case "abort": {
                    // Stream lifecycle events, no action needed
                    break
                }

                case "raw": {
                    // Raw provider values, usually for debugging
                    break
                }

                default: {
                    // Handle any unknown chunk types gracefully
                    const unknownChunk = chunk as { type: string }
                    console.warn(`[cvx][chat][stream] Unhandled chunk type: ${unknownChunk.type}`)
                }
            }
        }
    })
}
