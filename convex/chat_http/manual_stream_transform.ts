import type { DynamicToolUIPart, FileUIPart, ReasoningUIPart, TextUIPart, ToolUIPart } from "ai"

import { DelayedPromise } from "@/lib/delayed-promise"
import type { TextStreamPart, UIMessageChunk } from "ai"
import type { GenericActionCtx } from "convex/server"
import type { Infer } from "convex/values"
import type { DataModel } from "../_generated/dataModel"
import { r2 } from "../attachments"
import type { ErrorUIPartV2 } from "../schema/parts"

export const manualStreamTransform = (
    parts: Array<
        | TextUIPart
        | ReasoningUIPart
        | DynamicToolUIPart
        | ToolUIPart
        | FileUIPart
        | Infer<typeof ErrorUIPartV2>
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
                ;(parts[parts.length - 1] as ReasoningUIPart).text += text
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

    return new TransformStream<TextStreamPart<any>, UIMessageChunk>({
        transform: async (chunk, controller) => {
            const chunkType = chunk.type
            switch (chunkType) {
                case "text-delta": {
                    const uiChunk: UIMessageChunk = {
                        type: "text-delta",
                        id: chunk.id,
                        delta: chunk.text
                    }
                    controller.enqueue(uiChunk)
                    appendTextPart(chunk.text, "text")
                    break
                }

                case "reasoning-delta": {
                    const uiChunk: UIMessageChunk = {
                        type: "reasoning-delta",
                        id: chunk.id,
                        delta: chunk.text
                    }
                    controller.enqueue(uiChunk)
                    appendTextPart(chunk.text, "reasoning")
                    break
                }

                case "reasoning-start": {
                    if (reasoningStartedAt === -1) {
                        reasoningStartedAt = Date.now()
                    }
                    // No need to enqueue anything, just track the start
                    break
                }

                case "reasoning-end": {
                    // // Finalize reasoning block - update duration if we have a part
                    // const lastPart = parts[parts.length - 1]
                    // if (lastPart?.type === "reasoning" && reasoningStartedAt !== -1) {
                    //     (lastPart as ReasoningUIPart & { duration?: number }).duration = Date.now() - reasoningStartedAt
                    // }
                    reasoningStartedAt = -1
                    break
                }

                case "text-start": {
                    // Initialize text block - just a signal, no action needed
                    break
                }

                case "text-end": {
                    // Finalize text block - just a signal, no action needed
                    break
                }

                case "file": {
                    const fileExtension = chunk.file.mediaType.split("/")[1]
                    const key = `generations/${userId}/${Date.now()}-${crypto.randomUUID()}-gen.${fileExtension}`
                    const uint8Array = Uint8Array.from(atob(chunk.file.base64), (c) =>
                        c.charCodeAt(0)
                    )
                    const storedKey = await r2.store(actionCtx, uint8Array, {
                        authorId: userId,
                        key,
                        type: chunk.file.mediaType
                    })
                    if (chunk.file.mediaType.startsWith("image/")) {
                        const promise = new DelayedPromise<void>()
                        uploadPromises.push(promise.value)

                        console.log("Stored model-generated image to R2:", storedKey)

                        parts.push({
                            type: "file",
                            mediaType: chunk.file.mediaType,
                            url: storedKey
                        })

                        promise.resolve()

                        const uiChunk: UIMessageChunk = {
                            type: "file",
                            mediaType: chunk.file.mediaType,
                            url: storedKey
                        }
                        controller.enqueue(uiChunk)
                    } else {
                        const uiChunk: UIMessageChunk = {
                            type: "file",
                            mediaType: chunk.file.mediaType,
                            url: storedKey
                        }
                        controller.enqueue(uiChunk)
                    }
                    break
                }

                case "source": {
                    const uiChunk: UIMessageChunk = {
                        type: "source-url",
                        sourceId: chunk.id,
                        url: chunk.sourceType === "url" ? chunk.url : "",
                        title: chunk.title
                    }
                    controller.enqueue(uiChunk)
                    break
                }

                case "tool-input-start": {
                    const uiChunk: UIMessageChunk = {
                        type: "tool-input-start",
                        toolCallId: chunk.id,
                        toolName: chunk.toolName
                    }
                    controller.enqueue(uiChunk)
                    break
                }

                case "tool-input-delta": {
                    const uiChunk: UIMessageChunk = {
                        type: "tool-input-delta",
                        toolCallId: chunk.id,
                        inputTextDelta: chunk.delta
                    }
                    controller.enqueue(uiChunk)
                    break
                }

                case "tool-call": {
                    const uiChunk: UIMessageChunk = {
                        type: "tool-input-available",
                        toolCallId: chunk.toolCallId,
                        toolName: chunk.toolName,
                        input: chunk.input
                    }
                    controller.enqueue(uiChunk)

                    parts.push({
                        type: "dynamic-tool",
                        state: "input-available",
                        toolCallId: chunk.toolCallId,
                        toolName: chunk.toolName,
                        input: chunk.input
                    })
                    break
                }

                case "tool-result": {
                    const uiChunk: UIMessageChunk = {
                        type: "tool-output-available",
                        toolCallId: chunk.toolCallId,
                        output: chunk.output
                    }
                    controller.enqueue(uiChunk)

                    const found = parts.findIndex(
                        (p) =>
                            p.type.startsWith("tool-") ||
                            (p.type === "dynamic-tool" && p.toolCallId === chunk.toolCallId)
                    )
                    if (found !== -1) {
                        const _part = parts[found] as DynamicToolUIPart
                        _part.state = "output-available"
                        ;(_part as any).result = chunk.output
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
                        errorText: error_message
                    })

                    const uiChunk: UIMessageChunk = {
                        type: "error",
                        errorText: error_message
                    }
                    controller.enqueue(uiChunk)
                    break
                }

                case "start-step": {
                    const uiChunk: UIMessageChunk = {
                        type: "start-step"
                    }
                    controller.enqueue(uiChunk)
                    break
                }

                case "finish-step": {
                    const uiChunk: UIMessageChunk = {
                        type: "finish-step"
                    }
                    controller.enqueue(uiChunk)

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

                case "finish": {
                    break
                }

                case "start": {
                    // Generic start chunk - just a signal that the stream has started
                    // No action needed, just continue
                    break
                }

                default: {
                    const exhaustiveCheck = chunkType
                    throw new Error(`Unknown chunk type: ${exhaustiveCheck}`)
                }
            }
        }
    })
}
