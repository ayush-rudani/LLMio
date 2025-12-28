import { Messages } from "@/components/messages"
import { Button } from "@/components/ui/button"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useChatIntegration } from "@/hooks/use-chat-integration"
import { authClient } from "@/lib/auth-client"
import { getChatWidthClass, useChatWidthStore } from "@/lib/chat-width-store"
import { cn } from "@/lib/utils"
import { useRouter } from "@tanstack/react-router"
import type { UIMessage } from "ai"
import { useMutation } from "convex/react"
import { ArrowRight, GitFork } from "lucide-react"
import { useStickToBottom } from "use-stick-to-bottom"
import { Skeleton } from "./ui/skeleton"

interface SharedChatProps {
    sharedThreadId: string
}

export function SharedChat({ sharedThreadId }: SharedChatProps) {
    const { chatWidthState } = useChatWidthStore()
    const router = useRouter()
    const { data: session } = authClient.useSession()
    const forkThread = useMutation(api.threads.forkSharedThread)
    const { contentRef, scrollRef } = useStickToBottom({
        initial: "instant",
        resize: "instant"
    })

    const { messages, thread } = useChatIntegration({
        sharedThreadId,
        isShared: true,
        threadId: undefined
    })

    const handleFork = async () => {
        if (!session?.user?.id) {
            // Redirect to login or show login modal
            router.navigate({ to: "/auth/$pathname", params: { pathname: "sign-in" } })
            return
        }

        try {
            const result = await forkThread({
                sharedThreadId: sharedThreadId as Id<"sharedThreads">
            })

            if ("error" in result) {
                console.error("Failed to fork thread:", result.error)
                return
            }

            // Navigate to the new forked thread
            router.navigate({
                to: "/thread/$threadId",
                params: { threadId: result.threadId.toString() }
            })
        } catch (error) {
            console.error("Error forking thread:", error)
        }
    }

    return (
        <div className="relative flex h-screen flex-col">
            <Messages
                messages={messages as UIMessage[]}
                status="ready"
                contentRef={contentRef}
                scrollRef={scrollRef}
            />
            <div className="absolute right-0 bottom-2 left-0">
                {/* Fork prompt instead of input */}
                <div className="border-t bg-background p-4">
                    <div
                        className={cn(
                            "container mx-auto",
                            getChatWidthClass(chatWidthState.chatWidth)
                        )}
                    >
                        <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-4">
                            <div className="flex-1">
                                {thread ? (
                                    <h3 className="font-semibold text-sm">{thread.title}</h3>
                                ) : (
                                    <Skeleton className="h-5 w-24" />
                                )}
                                <p className="text-muted-foreground text-sm">
                                    This is a shared conversation. Fork it to your account to
                                    continue the discussion.
                                </p>
                            </div>
                            <Button onClick={handleFork} className="ml-4">
                                <GitFork className="h-4 w-4" />
                                Fork Thread
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
