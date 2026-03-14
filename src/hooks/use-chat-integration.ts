import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { backendToUiMessagesV2 } from "@/convex/lib/backend_to_ui_messages"
import type { SharedThread, Thread } from "@/convex/schema"
import { useToken } from "@/hooks/auth-hooks"
import { useAutoResume } from "@/hooks/use-auto-resume"
import { browserEnv } from "@/lib/browser-env"
import { useChatStore } from "@/lib/chat-store"
import { useModelStore } from "@/lib/model-store"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { useQuery as useConvexQuery } from "convex-helpers/react/cache"
import type { Infer } from "convex/values"
import { nanoid } from "nanoid"
import { useCallback, useMemo, useRef } from "react"

export function useChatIntegration<IsShared extends boolean>({
    threadId,
    sharedThreadId,
    isShared,
    folderId
}: {
    threadId: string | undefined
    sharedThreadId?: string | undefined
    isShared?: IsShared
    folderId?: Id<"projects">
}) {
    const tokenData = useToken()

    const {
        selectedModel,
        enabledTools,
        selectedImageSize,
        reasoningEffort,
        getEffectiveMcpOverrides
    } = useModelStore()
    const {
        rerenderTrigger,
        shouldUpdateQuery,
        setShouldUpdateQuery,
        triggerRerender,
        setThreadId,
        setAttachedStreamId,
        setPendingStream
    } = useChatStore()
    const seededNextId = useRef<string | null>(null)

    // For regular threads, use getThreadMessages
    const threadMessages = useConvexQuery(
        api.threads.getThreadMessages,
        !isShared && threadId ? { threadId: threadId as Id<"threads"> } : "skip"
    )

    // For shared threads, get the shared thread data
    const sharedThread = useConvexQuery(
        api.threads.getSharedThread,
        isShared && sharedThreadId
            ? { sharedThreadId: sharedThreadId as Id<"sharedThreads"> }
            : "skip"
    )

    const thread = useConvexQuery(
        api.threads.getThread,
        !isShared && threadId ? { threadId: threadId as Id<"threads"> } : "skip"
    )

    const initialMessages = useMemo(() => {
        if (isShared) {
            if (!sharedThread?.messages) return []
            // Shared thread messages need threadId for compatibility
            return backendToUiMessagesV2(
                sharedThread.messages.map((msg) => ({
                    ...msg,
                    threadId: sharedThreadId as Id<"threads">
                }))
            )
        }

        if (!threadMessages || "error" in threadMessages) return []
        return backendToUiMessagesV2(threadMessages)
    }, [threadMessages, sharedThread, isShared, sharedThreadId])

    const tokenRef = useRef(tokenData.token)
    tokenRef.current = tokenData.token

    const chatHelpers = useChat({
        id: isShared
            ? `shared_${sharedThreadId}`
            : threadId === undefined
              ? `new_chat_${rerenderTrigger}`
              : threadId,
        experimental_throttle: 50,
        messages: initialMessages,
        transport: new DefaultChatTransport({
            api: `${browserEnv("VITE_CONVEX_API_URL")}/chat`,
            headers: (): Record<string, string> => {
                if (tokenRef.current) {
                    return { authorization: `Bearer ${tokenRef.current}` }
                }
                return {} // Empty object, but typed correctly
            },
            prepareSendMessagesRequest({ messages: requestMessages, id: requestId }) {
                if (threadId) {
                    useChatStore.getState().setPendingStream(threadId, true)
                }
                const proposedNewAssistantId = nanoid()
                seededNextId.current = proposedNewAssistantId

                const message = requestMessages[requestMessages.length - 1]

                // Get effective MCP overrides (includes defaults for new chats)
                const mcpOverrides = getEffectiveMcpOverrides(threadId)

                // Read targetMode and targetFromMessageId from store
                const { targetMode, targetFromMessageId } = useChatStore.getState()

                return {
                    body: {
                        id: threadId,
                        proposedNewAssistantId,
                        model: selectedModel,
                        message: {
                            parts: message?.parts,
                            role: message?.role,
                            messageId: message?.id
                        },
                        enabledTools,
                        imageSize: selectedImageSize,
                        folderId,
                        reasoningEffort,
                        mcpOverrides,
                        ...(targetFromMessageId && { targetFromMessageId }),
                        ...(targetMode && targetMode !== "normal" && { targetMode })
                    }
                }
            },
            prepareReconnectToStreamRequest: ({ id }) => {
                return {
                    api: `${browserEnv("VITE_CONVEX_API_URL")}/chat?chatId=${id}`
                }
            }
        }),
        // Handle custom data parts (thread_id, stream_id) from the server
        onData: (dataPart) => {
            console.log("[UCI:data_part]", { dataPart })
            // if (isShared) return
            // if (dataPart.type === "data-thread_id" && typeof dataPart.data === "string") {
            //     setThreadId(dataPart.data)
            //     if (typeof window !== "undefined") {
            //         window.history.replaceState({}, "", `/thread/${dataPart.data}`)
            //     }
            //     setShouldUpdateQuery(true)
            //     console.log("[UCI:onData:thread_id]", { t: dataPart.data })
            // }
            // if (
            //     dataPart.type === "data-stream_id" &&
            //     typeof dataPart.data === "string" &&
            //     threadId
            // ) {
            //     const currentThreadId = useChatStore.getState().threadId
            //     if (currentThreadId) {
            //         setAttachedStreamId(currentThreadId, dataPart.data)
            //         setPendingStream(currentThreadId, false)
            //         console.log("[UCI:onData:stream_id]", {
            //             t: currentThreadId,
            //             sid: dataPart.data.slice(0, 5)
            //         })
            //     }
            // }
        },
        onFinish: () => {
            if (!isShared && shouldUpdateQuery) {
                setShouldUpdateQuery(false)
                triggerRerender()
            }
        },
        generateId: () => {
            if (seededNextId.current) {
                const id = seededNextId.current
                seededNextId.current = null
                return id
            }
            return nanoid()
        }
    })

    const customResume = useCallback(() => {
        console.log("[UCI:custom_resume]", {
            threadId: threadId?.slice(0, 8),
            backendMsgs: threadMessages && !("error" in threadMessages) ? threadMessages.length : 0,
            currentUIMsgs: chatHelpers.messages.length,
            initialMsgs: initialMessages.length
        })

        if (initialMessages.length > 0) {
            chatHelpers.setMessages(initialMessages)
            console.log("[UCI:messages_restored]", { count: initialMessages.length })
        }

        chatHelpers.resumeStream()
    }, [
        chatHelpers.setMessages,
        chatHelpers.resumeStream,
        initialMessages,
        threadMessages,
        threadId,
        chatHelpers.messages.length
    ])

    useAutoResume({
        autoResume: !isShared, // Skip auto resume for shared threads
        thread: thread || undefined,
        threadId,
        experimental_resume: customResume,
        status: chatHelpers.status,
        threadMessages
    })

    return {
        ...chatHelpers,
        seededNextId,
        thread: (thread || sharedThread) as unknown as IsShared extends true
            ? Infer<typeof SharedThread>
            : Infer<typeof Thread>
    }
}
