import type {
    DataStreamString,
    FileUIPart,
    ReasoningUIPart,
    TextUIPart,
    ToolInvocationUIPart
} from 'ai'

import { DelayedPromise } from "@/lib/delayed-promise"
import { type TextStreamPart, type ToolCall, formatDataStreamPart } from "ai"
import type { GenericActionCtx } from "convex/server"
import type { Infer } from "convex/values"
import type { DataModel } from "../_generated/dataModel"
import { r2 } from "../attachments"
import type { ErrorUIPart } from "../schema/parts"

export const manualStreamTransform = (
    parts: Array<
        | TextUIPart
        | (ReasoningUIPart & { duration?: number })
        | ToolInvocationUIPart
        | FileUIPart
        | Infer<typeof ErrorUIPart>
    >,
    totalTokenUsage: {
        promptTokens: number
        completionTokens: number
        reasoningTokens: number
    },
    assistantMessageId: string,
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
                ;(parts[parts.length - 1] as ReasoningUIPart).reasoningText += text
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
                    reasoningText: text,
                    details: []
                })
            }
        }
    }

    return new TransformStream<TextStreamPart<any>, DataStreamString>({
        transform: async (chunk, controller) => {
            const chunkType = chunk.type
            switch (chunkType) {
                case "text-delta": {
                    controller.enqueue(formatDataStreamPart("text", chunk.textDelta))
                    appendTextPart(chunk.textDelta, "text")
                    break
                }

                case "reasoning": {
                    controller.enqueue(formatDataStreamPart("reasoning", chunk.textDelta))
                    appendTextPart(chunk.textDelta, "reasoning")
                    break
                }

                case "redacted-reasoning": {
                    controller.enqueue(
                        formatDataStreamPart("redacted_reasoning", {
                            data: chunk.data
                        })
                    )
                    appendTextPart(chunk.data, "reasoning")
                    break
                }

                case "reasoning-signature": {
                    controller.enqueue(
                        formatDataStreamPart("reasoning_signature", {
                            signature: chunk.signature
                        })
                    )
                    break
                }

                case "file": {
                    if (chunk.mimeType.startsWith("image/")) {
                        const promise = new DelayedPromise<void>()
                        uploadPromises.push(promise.value)
                        const fileExtension = chunk.mimeType.split("/")[1] || "png"
                        const key = `generations/${userId}/${Date.now()}-${crypto.randomUUID()}-gen.${fileExtension}`
                        const uint8Array = Uint8Array.from(atob(chunk.base64), (c) =>
                            c.charCodeAt(0)
                        )

                        const storedKey = await r2.store(actionCtx, uint8Array, {
                            authorId: userId,
                            key,
                            type: chunk.mimeType
                        })

                        console.log("Stored model-generated image to R2:", storedKey)

                        parts.push({
                            type: "file",

                            file: {
                                mediaType: chunk.mimeType,
                                data: storedKey
                            }
                        })

                        promise.resolve()

                        controller.enqueue(
                            formatDataStreamPart("file", {
                                mimeType: chunk.mimeType,
                                data: storedKey
                            })
                        )
                    } else {
                        controller.enqueue(
                            formatDataStreamPart("file", {
                                mimeType: chunk.mimeType,
                                data: chunk.base64
                            })
                        )
                    }
                    break
                }

                case "source": {
                    controller.enqueue(formatDataStreamPart("source", chunk.source))
                    break
                }

                case "tool-call-streaming-start": {
                    controller.enqueue(
                        formatDataStreamPart("tool_call_streaming_start", {
                            toolCallId: chunk.toolCallId,
                            toolName: chunk.toolName
                        })
                    )
                    break
                }

                case "tool-call-delta": {
                    controller.enqueue(
                        formatDataStreamPart("tool_call_delta", {
                            toolCallId: chunk.toolCallId,
                            argsTextDelta: chunk.argsTextDelta
                        })
                    )
                    break
                }

                case "tool-call": {
                    controller.enqueue(
                        formatDataStreamPart("tool_call", {
                            toolCallId: chunk.toolCallId,
                            toolName: chunk.toolName,
                            args: chunk.args
                        } as ToolCall<string, any>)
                    )

                    parts.push({
                        type: "tool-invocation",
                        toolInvocation: {
                            state: "call",
                            args: chunk.args,
                            toolCallId: chunk.toolCallId,
                            toolName: chunk.toolName
                        }
                    })
                    break
                }

                case "tool-result": {
                    controller.enqueue(
                        {
                            'type': 'tool-result',

                            'value': {
                                toolCallId: chunk.toolCallId,
                                result: chunk.result
                            }
                        }
                    )

                    const found = parts.findIndex(
                        (p) =>
                            p.type === "tool-invocation" &&
                            p.toolInvocation.toolCallId === chunk.toolCallId
                    )
                    if (found !== -1) {
                        const _part = parts[found] as ToolInvocationUIPart
                        _part.toolInvocation.state = "result"
                        ;(_part.toolInvocation as any).result = chunk.result
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
                    } else if ("error" in (chunk.error as any)) {
                        if ((chunk.error as { error: Error }).error instanceof Error) {
                            error_message = (chunk.error as { error: Error }).error.message
                        } else {
                            error_message = (
                                chunk.error as { error: { error: any } }
                            ).error.error.toString()
                        }
                    }

                    parts.push({
                        type: "error",
                        error: {
                            code: "unknown",
                            message: error_message
                        }
                    })
                    controller.enqueue(formatDataStreamPart("error", error_message))
                    break
                }

                case "step-start": {
                    controller.enqueue(
                        formatDataStreamPart("start_step", {
                            messageId: assistantMessageId
                        })
                    )
                    break
                }

                case "step-finish": {
                    controller.enqueue(
                        formatDataStreamPart("finish_step", {
                            finishReason: chunk.finishReason,
                            usage: {
                                inputTokens: chunk.usage.inputTokens,
                                outputTokens: chunk.usage.outputTokens
                            },
                            isContinued: chunk.isContinued
                        })
                    )
                    totalTokenUsage.inputTokens += chunk.usage.inputTokens || 0
                    totalTokenUsage.outputTokens += chunk.usage.outputTokens || 0

                    console.log(
                        "chunk.providerMetadata",
                        chunk.providerOptions,
                        "totalTokenUsage",
                        totalTokenUsage
                    )
                    if (
                        chunk.providerOptions?.openai?.reasoningTokens &&
                        typeof chunk.providerOptions.openai.reasoningTokens === "number"
                    ) {
                        totalTokenUsage.reasoningTokens +=
                            chunk.providerOptions.openai.reasoningTokens
                    }
                    break
                }

                case "finish": {
                    break
                }

                default: {
                    const exhaustiveCheck: never = chunkType
                    throw new Error(`Unknown chunk type: ${exhaustiveCheck}`)
                }
            }
        }
    });
}
