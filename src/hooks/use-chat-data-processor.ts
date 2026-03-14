import { useChatStore } from "@/lib/chat-store"
import type { UIMessage } from "@ai-sdk/react"
import { useEffect } from "react"

interface UseChatDataProcessorProps {
    messages: UIMessage[]
}

export function useChatDataProcessor({ messages }: UseChatDataProcessorProps) {
    const { setThreadId, setShouldUpdateQuery, setAttachedStreamId, threadId, setPendingStream } =
        useChatStore()

    useEffect(() => {
        // In AI SDK 5.0, data parts are in message parts
        // Process data parts from the latest assistant message
        const lastMessage = messages[messages.length - 1]
        if (!lastMessage || lastMessage.role !== "assistant") return

        // Extract data parts from message parts
        for (const part of lastMessage.parts) {
            if (part.type === "data-thread_id" && "data" in part) {
                const threadIdValue = part.data as string
                setThreadId(threadIdValue)
                if (typeof window !== "undefined") {
                    window.history.pushState({}, "", `/thread/${threadIdValue}`)
                }
                setShouldUpdateQuery(true)
                console.log("[CDP:thread_id]", { t: threadIdValue })
            }

            if (part.type === "data-stream_id" && "data" in part && threadId) {
                const streamId = part.data as string
                setAttachedStreamId(threadId, streamId)
                setPendingStream(threadId, false)
                console.log("[CDP:stream_id]", {
                    t: threadId,
                    sid: streamId.slice(0, 5)
                })
            }
        }
    }, [
        messages,
        setThreadId,
        setShouldUpdateQuery,
        setAttachedStreamId,
        threadId,
        setPendingStream
    ])
}
