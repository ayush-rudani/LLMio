import { Messages } from "@/components/messages"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { MODELS_SHARED } from "@/convex/lib/models"
import { useSession } from "@/hooks/auth-hooks"
import { useChatActions } from "@/hooks/use-chat-actions"
import { useChatDataProcessor } from "@/hooks/use-chat-data-processor"
import { useChatIntegration } from "@/hooks/use-chat-integration"
import { useDynamicTitle } from "@/hooks/use-dynamic-title"
import { useThreadSync } from "@/hooks/use-thread-sync"
import type { UploadedFile } from "@/lib/chat-store"
import { useDiskCachedQuery } from "@/lib/convex-cached-query"
import { useModelStore } from "@/lib/model-store"
import { useThemeStore } from "@/lib/theme-store"
import { AnimatePresence, motion } from "motion/react"
import { useEffect, useMemo } from "react"
import { useStickToBottom } from "use-stick-to-bottom"
import { Logo } from "./logo"
import { MultimodalInput } from "./multimodal-input"
import { SignupMessagePrompt } from "./signup-message-prompt"
import { StickToBottomButton } from "./stick-to-bottom-button"

interface ChatProps {
    threadId: string | undefined
    folderId?: Id<"projects">
}

const ChatContent = ({ threadId: routeThreadId, folderId }: ChatProps) => {
    const { selectedModel, setSelectedModel } = useModelStore()
    const { threadId } = useThreadSync({ routeThreadId })
    const { scrollToBottom, isAtBottom, contentRef, scrollRef } = useStickToBottom({
        initial: "instant",
        resize: "instant"
    })
    const { themeState } = useThemeStore()
    const mode = themeState.currentMode
    const { data: session, isPending } = useSession()

    useDynamicTitle({ threadId })

    useMemo(() => {
        if (!selectedModel && MODELS_SHARED.length > 0) {
            // Set gemini-2.5-flash as the default model for new users (built-in, no API key required)
            const defaultModel = MODELS_SHARED.find((m) => m.id === "gemini-2.5-flash")
            setSelectedModel(defaultModel ? defaultModel.id : MODELS_SHARED[0].id)
        }
    }, [selectedModel, setSelectedModel])

    const projects = useDiskCachedQuery(
        api.folders.getUserProjects,
        {
            key: "projects",
            default: []
        },
        session?.user?.id ? {} : "skip"
    )
    const project =
        "error" in projects ? null : projects?.find((project) => project._id === folderId)

    const { status, data, messages, ...chatHelpers } = useChatIntegration({
        threadId,
        folderId
    })

    const { handleInputSubmit, handleRetry, handleEditAndRetry } = useChatActions({
        threadId,
        folderId
    })

    useChatDataProcessor({ data, messages })

    const handleInputSubmitWithScroll = (inputValue?: string, fileValues?: UploadedFile[]) => {
        handleInputSubmit(inputValue, fileValues)
        scrollToBottom({ animation: "smooth" })
    }

    const isEmpty = messages.length === 0 && !threadId

    const userName =
        session?.user?.name ?? (isPending ? localStorage.getItem("DISK_CACHE:user-name") : null)

    useEffect(() => {
        if (!session?.user?.name || isPending) return
        localStorage.setItem("DISK_CACHE:user-name", session.user.name)
    }, [session?.user?.name, isPending])

    // const { resetChat } = useChatStore()

    // const resetAll = () => {
    //     console.log("[chat] resetAll")
    //     chatHelpers.setData([])
    //     chatHelpers.setMessages([])
    //     resetChat()
    // }

    // useEffect(() => {
    //     document.addEventListener("new_chat", resetAll)
    //     return () => {
    //         document.removeEventListener("new_chat", resetAll)
    //     }
    // }, [threadId])

    if (!session?.user && !isPending) {
        return (
            <div className="relative flex h-[calc(100dvh-64px)] items-center justify-center">
                <SignupMessagePrompt />
            </div>
        )
    }

    return (
        <div className="relative flex h-[calc(100dvh-64px)] flex-col">
            <Messages
                messages={messages}
                onRetry={handleRetry}
                onEditAndRetry={handleEditAndRetry}
                status={status}
                contentRef={contentRef}
                scrollRef={scrollRef}
            />

            <AnimatePresence mode="sync">
                {isEmpty ? (
                    <motion.div
                        key="centered-input"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="absolute inset-0 flex flex-col items-center justify-center"
                    >
                        <div className="mb-6 size-16 rounded-full border-2 opacity-80">
                            <Logo />
                        </div>
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2 }}
                            className="mb-8 text-center"
                        >
                            <h1 className="px-4 font-medium text-3xl text-foreground">
                                {userName
                                    ? `What do you want to explore, ${userName?.split(" ")[0]}?`
                                    : "What do you want to explore?"}
                            </h1>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.2 }}
                            className="w-full max-w-4xl px-4"
                        >
                            <MultimodalInput
                                onSubmit={handleInputSubmitWithScroll}
                                status={status}
                            />
                        </motion.div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="bottom-input"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="-bottom-[3.875rem] md:-bottom-10 absolute inset-x-0 z-[10] flex flex-col items-center justify-center gap-2"
                    >
                        <StickToBottomButton
                            isAtBottom={isAtBottom}
                            scrollToBottom={scrollToBottom}
                        />
                        <MultimodalInput onSubmit={handleInputSubmitWithScroll} status={status} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

export const Chat = ({ threadId, folderId }: ChatProps) => {
    return <ChatContent threadId={threadId} folderId={folderId} />
}
