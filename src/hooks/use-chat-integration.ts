import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { backendToUiMessages } from "@/convex/lib/backend_to_ui_messages"
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
import { useCallback, useEffect, useMemo, useRef } from "react"

// Define custom data types for our stream
type CustomDataTypes = {
    thread_id: string
    stream_id: string
    model_name: string
}

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
            return backendToUiMessages(
                sharedThread.messages.map((msg) => ({
                    ...msg,
                    threadId: sharedThreadId as Id<"threads">
                }))
            )
        }

        if (!threadMessages || "error" in threadMessages) return []
        return backendToUiMessages(threadMessages)
    }, [threadMessages, sharedThread, isShared, sharedThreadId])

    const chatHelpers = useChat({
        id: isShared
            ? `shared_${sharedThreadId}`
            : threadId === undefined
              ? `new_chat_${rerenderTrigger}`
              : threadId,

        experimental_throttle: 50,

        messages: initialMessages,

        onFinish: () => {
            if (!isShared && shouldUpdateQuery) {
                setShouldUpdateQuery(false)
                triggerRerender()
            }
        },

        // Handle custom data parts (thread_id, stream_id) from the server
        onData: (dataPart) => {
            if (isShared) return

            // dataPart.type is like "data-thread_id", we need to extract the key
            const dataType = dataPart.type.replace("data-", "")

            if (dataType === "thread_id" && typeof dataPart.data === "string") {
                setThreadId(dataPart.data)
                if (typeof window !== "undefined") {
                    window.history.replaceState({}, "", `/thread/${dataPart.data}`)
                }
                setShouldUpdateQuery(true)
                console.log("[UCI:onData:thread_id]", { t: dataPart.data })
            }

            if (dataType === "stream_id" && typeof dataPart.data === "string") {
                const currentThreadId = useChatStore.getState().threadId
                if (currentThreadId) {
                    setAttachedStreamId(currentThreadId, dataPart.data)
                    setPendingStream(currentThreadId, false)
                    console.log("[UCI:onData:stream_id]", {
                        t: currentThreadId,
                        sid: dataPart.data.slice(0, 5)
                    })
                }
            }
        },

        generateId: () => {
            if (seededNextId.current) {
                const id = seededNextId.current
                seededNextId.current = null
                return id
            }
            return nanoid()
        },

        transport: new DefaultChatTransport({
            api: isShared ? undefined : `${browserEnv("VITE_CONVEX_API_URL")}/chat`,
            headers: isShared
                ? {}
                : {
                      authorization: `Bearer ${tokenData.token}`
                  },
            prepareSendMessagesRequest({ messages: requestMessages, id: requestId }) {
                // Skip request preparation for shared threads since they're read-only
                if (isShared) return { body: {} }

                if (threadId) {
                    useChatStore.getState().setPendingStream(threadId, true)
                }
                const proposedNewAssistantId = nanoid()
                seededNextId.current = proposedNewAssistantId

                const message = requestMessages[requestMessages.length - 1]

                // Get effective MCP overrides (includes defaults for new chats)
                const mcpOverrides = getEffectiveMcpOverrides(threadId)

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
                        mcpOverrides
                    }
                }
            }
        })
    })

    // Sync messages when navigating to a different thread or when backend messages load
    // In AI SDK v5, the `messages` prop is only used as the initial value - we must
    // call setMessages to update the internal state when the thread changes
    useEffect(() => {
        // Skip for new chats (no threadId means new chat)
        if (!threadId && !sharedThreadId) return

        // Skip if messages haven't loaded yet
        if (initialMessages.length === 0) return

        // Skip if we're currently streaming (don't interrupt active generation)
        if (chatHelpers.status === "streaming" || chatHelpers.status === "submitted") return

        // Sync messages from backend to UI
        // This handles: navigating to existing threads, page refresh, shared threads
        console.log("[UCI:sync_messages]", {
            threadId: threadId?.slice(0, 8) || sharedThreadId?.slice(0, 8),
            initialMsgs: initialMessages.length,
            currentUIMsgs: chatHelpers.messages.length
        })
        chatHelpers.setMessages(initialMessages)
    }, [
        threadId,
        sharedThreadId,
        initialMessages,
        chatHelpers.status
        // Note: intentionally not including chatHelpers.setMessages or chatHelpers.messages
        // to avoid infinite loops - setMessages is stable, messages would cause loops
    ])

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

        // In AI SDK v5, experimental_resume was renamed to resumeStream
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
