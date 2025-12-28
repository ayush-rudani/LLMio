import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { backendToUiMessages } from "@/convex/lib/backend_to_ui_messages"
import type { SharedThread, Thread } from "@/convex/schema"
import { useToken } from "@/hooks/auth-hooks"
import { useAutoResume } from "@/hooks/use-auto-resume"
import { browserEnv } from "@/lib/browser-env"
import { useChatStore } from "@/lib/chat-store"
import { useModelStore } from "@/lib/model-store"
import { type UIMessage, useChat } from "@ai-sdk/react"
import { useQuery as useConvexQuery } from "convex-helpers/react/cache"
import type { Infer } from "convex/values"
import { nanoid } from "nanoid"
import { useCallback, useEffect, useMemo, useRef } from "react"

// Custom data types from our backend stream
type ThreadIdData = { type: "thread_id"; content: string }
type StreamIdData = { type: "stream_id"; content: string }

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
    const { rerenderTrigger, shouldUpdateQuery, setShouldUpdateQuery, triggerRerender } =
        useChatStore()
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

    // Track the current threadId for onData callback
    const currentThreadIdRef = useRef<string | undefined>(threadId)
    useEffect(() => {
        currentThreadIdRef.current = threadId
    }, [threadId])

    const chatHelpers = useChat({
        id: isShared
            ? `shared_${sharedThreadId}`
            : threadId === undefined
              ? `new_chat_${rerenderTrigger}`
              : threadId,
        experimental_throttle: 50,
        // @ts-expect-error -- Using experimental_prepareRequestBody even though not in type
        experimental_prepareRequestBody(body) {
            // Skip request preparation for shared threads since they're read-only
            if (isShared) return null

            if (threadId) {
                useChatStore.getState().setPendingStream(threadId, true)
            }
            const proposedNewAssistantId = nanoid()
            seededNextId.current = proposedNewAssistantId

            const messages = body.messages as UIMessage[]
            const message = messages[messages.length - 1]

            // Get effective MCP overrides (includes defaults for new chats)
            const mcpOverrides = getEffectiveMcpOverrides(threadId)

            return {
                ...body.requestBody,
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
        },
        // Cast to Message[] for compatibility - both types have the same runtime structure
        initialMessages: initialMessages as UIMessage[],
        onFinish: () => {
            if (!isShared && shouldUpdateQuery) {
                setShouldUpdateQuery(false)
                triggerRerender()
            }
        },
        // Handle custom data parts from backend stream (thread_id, stream_id)
        onData: (dataPart) => {
            const { setThreadId, setAttachedStreamId, setShouldUpdateQuery, setPendingStream } =
                useChatStore.getState()

            // Handle thread_id data part
            if (dataPart.type === "data-thread_id") {
                const data = dataPart.data as ThreadIdData
                setThreadId(data.content)
                if (typeof window !== "undefined") {
                    window.history.replaceState({}, "", `/thread/${data.content}`)
                }
                setShouldUpdateQuery(true)
                console.log("[UCI:onData:thread_id]", { t: data.content })
            }

            // Handle stream_id data part
            if (dataPart.type === "data-stream_id") {
                const data = dataPart.data as StreamIdData
                const currentThreadId =
                    currentThreadIdRef.current || useChatStore.getState().threadId
                if (currentThreadId) {
                    setAttachedStreamId(currentThreadId, data.content)
                    setPendingStream(currentThreadId, false)
                    console.log("[UCI:onData:stream_id]", {
                        t: currentThreadId,
                        sid: data.content.slice(0, 5)
                    })
                }
            }
        },
        api: isShared ? undefined : `${browserEnv("VITE_CONVEX_API_URL")}/chat`,
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
            chatHelpers.setMessages(initialMessages as UIMessage[])
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
