import type {
    FileUIPart,
    ReasoningUIPart,
    TextUIPart,
    ToolInvocationUIPart
} from 'ai'
import { formatDataStreamPart, stepCountIs } from "ai";
import { nanoid } from "nanoid"

import { ChatError } from "@/lib/errors"
import type { ReasoningEffort } from "@/lib/model-store"
import type { AnthropicProviderOptions } from "@ai-sdk/anthropic"
import type { GoogleGenerativeAIProviderOptions } from "@ai-sdk/google"
import type { OpenAIResponsesProviderOptions } from "@ai-sdk/openai"
import { createUIMessageStream, smoothStream, streamText } from "ai"
import type { Infer } from "convex/values"
import { internal } from "../_generated/api"
import type { Id } from "../_generated/dataModel"
import { httpAction } from "../_generated/server"
import { dbMessagesToCore } from "../lib/db_to_core_messages"
import { getUserIdentity } from "../lib/identity"
import type { ImageSize } from "../lib/models"
import { getResumableStreamContext } from "../lib/resumable_stream_context"
import { type AbilityId, getToolkit } from "../lib/toolkit"
import type { HTTPAIMessage } from "../schema/message"
import type { ErrorUIPart } from "../schema/parts"
import { generateThreadName } from "./generate_thread_name"
import { getModel } from "./get_model"
import { generateAndStoreImage } from "./image_generation"
import { manualStreamTransform } from "./manual_stream_transform"
import { buildPrompt } from "./prompt"
import { RESPONSE_OPTS } from "./shared"

const buildGoogleProviderOptions = (
    modelId: string,
    reasoningEffort?: ReasoningEffort
): GoogleGenerativeAIProviderOptions => {
    const options: GoogleGenerativeAIProviderOptions = {}

    if (modelId === "gemini-2.0-flash-image-generation") {
        options.responseModalities = ["TEXT", "IMAGE"]
    }

    if (reasoningEffort !== "off" && ["2.5-flash", "2.5-pro"].some((m) => modelId.includes(m))) {
        options.thinkingConfig = {
            includeThoughts: true,
            thinkingBudget:
                reasoningEffort === "low" ? 1000 : reasoningEffort === "medium" ? 6000 : 12000
        }
    }

    return options
}

const buildOpenAIProviderOptions = (
    modelId: string,
    reasoningEffort?: ReasoningEffort
): OpenAIResponsesProviderOptions => {
    const options: OpenAIResponsesProviderOptions = {}

    if (["o1", "o3", "o4"].some((m) => modelId.includes(m)) && reasoningEffort !== "off") {
        options.reasoningEffort = reasoningEffort
        options.reasoningSummary = "detailed"
    }

    return options
}

const buildAnthropicProviderOptions = (
    modelId: string,
    reasoningEffort?: ReasoningEffort
): AnthropicProviderOptions => {
    const options: AnthropicProviderOptions = {}

    if (
        reasoningEffort !== "off" &&
        ["sonnet-4", "4-sonnet", "4-opus", "opus-4", "3.7"].some((m) => modelId.includes(m))
    ) {
        options.thinking = {
            type: "enabled",
            budgetTokens:
                reasoningEffort === "low" ? 1000 : reasoningEffort === "medium" ? 6000 : 12000
        }
    }

    return options
}

export const chatPOST = httpAction(async (ctx, req) => {
    const body: {
        id?: string
        message: Infer<typeof HTTPAIMessage>
        model: string
        proposedNewAssistantId: string
        enabledTools: AbilityId[]
        targetFromMessageId?: string
        targetMode?: "normal" | "edit" | "retry"
        imageSize?: ImageSize
        mcpOverrides?: Record<string, boolean>
        folderId?: Id<"projects">
        reasoningEffort?: ReasoningEffort
    } = await req.json()

    if (body.targetFromMessageId && !body.id) {
        return new ChatError("bad_request:chat").toResponse()
    }

    const user = await getUserIdentity(ctx.auth, { allowAnons: true })
    if ("error" in user) return new ChatError("unauthorized:chat").toResponse()

    const mutationResult = await ctx.runMutation(internal.threads.createThreadOrInsertMessages, {
        threadId: body.id as Id<"threads">,
        authorId: user.id,
        userMessage: "message" in body ? body.message : undefined,
        proposedNewAssistantId: body.proposedNewAssistantId,
        targetFromMessageId: body.targetFromMessageId,
        targetMode: body.targetMode,
        folderId: body.folderId
    })

    if (mutationResult instanceof ChatError) return mutationResult.toResponse()
    if (!mutationResult) return new ChatError("bad_request:chat").toResponse()

    const dbMessages = await ctx.runQuery(internal.messages.getMessagesByThreadId, {
        threadId: mutationResult.threadId
    })
    const streamId = await ctx.runMutation(internal.streams.appendStreamId, {
        threadId: mutationResult.threadId
    })

    const modelData = await getModel(ctx, body.model)
    if (modelData instanceof ChatError) return modelData.toResponse()
    const { model, modelName } = modelData

    const mapped_messages = await dbMessagesToCore(dbMessages, modelData.abilities)

    const streamStartTime = Date.now()

    const remoteCancel = new AbortController()
    const parts: Array<
        | TextUIPart
        | (ReasoningUIPart & { duration?: number })
        | ToolInvocationUIPart
        | FileUIPart
        | Infer<typeof ErrorUIPart>
    > = []

    const uploadPromises: Promise<void>[] = []
    const settings = await ctx.runQuery(internal.settings.getUserSettingsInternal, {
        userId: user.id
    })

    if (settings.mcpServers && settings.mcpServers.length > 0) {
        const enabledMcpServers = settings.mcpServers.filter((server) => {
            const overrideValue = body.mcpOverrides?.[server.name]
            if (overrideValue === undefined) return server.enabled
            return overrideValue !== false
        })

        if (enabledMcpServers.length > 0) {
            body.enabledTools.push("mcp")
        }
    }

    // Track token usage
    const totalTokenUsage = {
        inputTokens: 0,
        outputTokens: 0,
        reasoningTokens: 0
    }

    const stream = createUIMessageStream({
        execute: async (dataStream) => {
            await ctx.runMutation(internal.threads.updateThreadStreamingState, {
                threadId: mutationResult.threadId,
                isLive: true,
                streamStartedAt: streamStartTime,
                currentStreamId: streamId
            })

            let nameGenerationPromise: Promise<string | ChatError> | undefined
            if (!body.id) {
                nameGenerationPromise = generateThreadName(
                    ctx,
                    mutationResult.threadId,
                    mapped_messages,
                    user.id,
                    settings
                )
            }

            dataStream.write({
                'type': 'data',

                'value': [{
                    type: "thread_id",
                    content: mutationResult.threadId
                }]
            })

            dataStream.write({
                'type': 'data',

                'value': [{
                    type: "stream_id",
                    content: streamId
                }]
            })

            dataStream.write({
                'type': 'message-annotations',

                'value': [{
                    type: "model_name",
                    content: modelName
                }]
            })

            if (model.modelType === "image") {
                console.log("[cvx][chat][stream] Image generation mode detected")

                // Extract the prompt from the user message
                const userMessage = mapped_messages.find((m) => m.role === "user")

                const prompt =
                    typeof userMessage?.content === "string"
                        ? userMessage.content
                        : userMessage?.content
                              .map((t) => (t.type === "text" ? t.text : undefined))
                              .filter((t) => t !== undefined)
                              .join(" ")

                if (typeof prompt !== "string" || !prompt.trim()) {
                    console.error("[cvx][chat][stream] No valid prompt found for image generation")
                    parts.push({
                        type: "error",
                        error: {
                            code: "unknown",
                            message:
                                "No prompt provided for image generation. Please provide a description of the image you want to create."
                        }
                    })
                    dataStream.write(
                        formatDataStreamPart(
                            "error",
                            "No prompt provided for image generation. Please provide a description of the image you want to create."
                        )
                    )
                } else {
                    // Use the provided imageSize or fall back to default
                    const imageSize: ImageSize = (body.imageSize || "1:1") as ImageSize

                    // Create mock tool call for image generation
                    const mockToolCall: ToolInvocationUIPart = {
                        type: "tool-invocation",
                        toolInvocation: {
                            state: "call",
                            args: {
                                imageSize,
                                prompt
                            },
                            toolCallId: nanoid(),
                            toolName: "image_generation"
                        }
                    }

                    parts.push(mockToolCall)
                    dataStream.write(
                        formatDataStreamPart("tool_call", {
                            toolCallId: mockToolCall.toolInvocation.toolCallId,
                            toolName: mockToolCall.toolInvocation.toolName,
                            args: mockToolCall.toolInvocation.args
                        })
                    )

                    // Patch the message with the tool call first
                    await ctx.runMutation(internal.messages.patchMessage, {
                        threadId: mutationResult.threadId,
                        messageId: mutationResult.assistantMessageId,
                        parts: parts,
                        metadata: {
                            modelId: body.model,
                            modelName,
                            serverDurationMs: Date.now() - streamStartTime
                        }
                    })

                    try {
                        // Generate the image
                        const result = await generateAndStoreImage({
                            prompt,
                            imageSize,
                            imageModel: model,
                            modelId: body.model,
                            userId: user.id,
                            threadId: mutationResult.threadId,
                            actionCtx: ctx
                        })

                        // Send tool result
                        dataStream.write(
                            {
                                'type': 'tool-result',

                                'value': {
                                    toolCallId: mockToolCall.toolInvocation.toolCallId,
                                    result: {
                                        assets: result.assets,
                                        prompt: result.prompt,
                                        modelId: result.modelId
                                    }
                                }
                            }
                        )

                        // Update parts with successful result
                        parts[0] = {
                            type: "tool-invocation",
                            toolInvocation: {
                                state: "result",
                                args: mockToolCall.toolInvocation.args,
                                result: {
                                    assets: result.assets,
                                    prompt: result.prompt,
                                    modelId: result.modelId
                                },
                                toolCallId: mockToolCall.toolInvocation.toolCallId,
                                toolName: "image_generation"
                            }
                        } satisfies ToolInvocationUIPart
                    } catch (error) {
                        console.error("[cvx][chat][stream] Image generation failed:", error)

                        // Send error in tool result
                        const errorMessage =
                            error instanceof Error ? error.message : "Unknown error occurred"
                        dataStream.write(
                            {
                                'type': 'tool-result',

                                'value': {
                                    toolCallId: mockToolCall.toolInvocation.toolCallId,
                                    result: {
                                        error: errorMessage
                                    }
                                }
                            }
                        )

                        // Update parts with error
                        parts[0] = {
                            type: "tool-invocation",
                            toolInvocation: {
                                state: "result",
                                args: mockToolCall.toolInvocation.args,
                                result: {
                                    error: errorMessage
                                },
                                toolCallId: mockToolCall.toolInvocation.toolCallId,
                                toolName: "image_generation"
                            }
                        } satisfies ToolInvocationUIPart
                    }
                }
            } else {
                // Pass the filtered settings (with MCP overrides applied) to the toolkit
                const filteredSettings = {
                    ...settings,
                    mcpServers: settings.mcpServers?.filter((server) => {
                        if (server.enabled === false) return false
                        const overrideValue = body.mcpOverrides?.[server.name]
                        return overrideValue !== false
                    })
                }
                const result = streamText({
                    model: model,
                    stopWhen: stepCountIs(100),
                    abortSignal: remoteCancel.signal,
                    experimental_transform: smoothStream(),
                    toolCallStreaming: true,
                    temperature: 0.5,

                    tools: modelData.abilities.includes("function_calling")
                        ? await getToolkit(ctx, body.enabledTools, filteredSettings)
                        : undefined,

                    messages: [
                        ...(modelData.modelId !== "gemini-2.0-flash-image-generation"
                            ? [
                                  {
                                      role: "system",
                                      content: buildPrompt(body.enabledTools, settings)
                                  } as const
                              ]
                            : []),
                        ...mapped_messages
                    ],

                    providerOptions: {
                        google: buildGoogleProviderOptions(modelData.modelId, body.reasoningEffort),
                        openai: buildOpenAIProviderOptions(modelData.modelId, body.reasoningEffort),
                        anthropic: buildAnthropicProviderOptions(
                            modelData.modelId,
                            body.reasoningEffort
                        )
                    }
                })

                dataStream.merge(
                    result.fullStream.pipeThrough(
                        manualStreamTransform(
                            parts,
                            totalTokenUsage,
                            mutationResult.assistantMessageId,
                            uploadPromises,
                            user.id,
                            ctx
                        )
                    )
                )

                await result.consumeStream()
                await Promise.allSettled(uploadPromises)
                console.log("uploadPromises", uploadPromises)
                console.log("parts", parts)
            }
            remoteCancel.abort()
            console.log()

            await ctx.runMutation(internal.messages.patchMessage, {
                threadId: mutationResult.threadId,
                messageId: mutationResult.assistantMessageId,
                parts:
                    parts.length > 0
                        ? parts
                        : [
                              {
                                  type: "error",
                                  error: {
                                      code: "no-response",
                                      message:
                                          "The model did not generate a response. Please try again."
                                  }
                              }
                          ],
                metadata: {
                    modelId: body.model,
                    modelName,
                    inputTokens: totalTokenUsage.inputTokens,
                    outputTokens: totalTokenUsage.outputTokens,
                    reasoningTokens: totalTokenUsage.reasoningTokens,
                    serverDurationMs: Date.now() - streamStartTime
                }
            })

            if (nameGenerationPromise) {
                const res = await nameGenerationPromise
                if (res instanceof ChatError) res.toResponse()
            }

            await ctx
                .runMutation(internal.threads.updateThreadStreamingState, {
                    threadId: mutationResult.threadId,
                    isLive: false,
                    currentStreamId: undefined
                })
                .catch((err) => console.error("Failed to update thread state:", err))
        },
        onError: (error) => {
            console.error("[cvx][chat][stream] Fatal error:", error)
            // Mark thread as not live on error
            ctx.runMutation(internal.threads.updateThreadStreamingState, {
                threadId: mutationResult.threadId,
                isLive: false
            }).catch((err) => console.error("Failed to update thread state:", err))
            return "Stream error occurred"
        }
    })

    const streamContext = getResumableStreamContext()
    if (streamContext) {
        return new Response(
            (await streamContext.resumableStream(streamId, () => stream))?.pipeThrough(
                new TextEncoderStream()
            ),
            RESPONSE_OPTS
        )
    }

    return new Response(stream.pipeThrough(new TextEncoderStream()), RESPONSE_OPTS)
})
