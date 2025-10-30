import type { useChatIntegration } from "@/hooks/use-chat-integration"
import { browserEnv } from "@/lib/browser-env"
import { useChatStore } from "@/lib/chat-store"
import { getChatWidthClass, useChatWidthStore } from "@/lib/chat-width-store"
import { getFileTypeInfo } from "@/lib/file_constants"
import { cn } from "@/lib/utils"
import type { UIMessage } from "ai"
import { Code, FileType, FileType2, Image as ImageIcon, RotateCcw } from "lucide-react"
import { memo, useState } from "react"
import type { useStickToBottom } from "use-stick-to-bottom"
import { ChatActions } from "./chat-actions"
import { MemoizedMarkdown } from "./memoized-markdown"
import { Reasoning, ReasoningContent, ReasoningTrigger } from "./reasoning"
import { GenericToolRenderer } from "./renderers/generic-tool"
import { ImageGenerationToolRenderer } from "./renderers/image-generation-ui"
import { WebSearchToolRenderer } from "./renderers/web-search-ui"
import { Button } from "./ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog"
import { Loader } from "./ui/loader"
import { Textarea } from "./ui/textarea"

const extractFileName = (data: string) => {
    const _extract = data.startsWith("attachments/") ? (data.split("/").pop() ?? "") : ""
    return _extract.length > 51 ? _extract.slice(51) : _extract
}

const getFileIcon = (part: { data: string; filename?: string; mimeType?: string }) => {
    const { isImage, isCode, isPdf } = getFileTypeInfo(extractFileName(part.data), part.mimeType)

    if (isImage) return <ImageIcon className="size-4 text-blue-500" />
    if (isCode) return <Code className="size-4 text-green-500" />
    if (isPdf) return <FileType2 className="size-4 text-gray-500" />
    return <FileType className="size-4 text-gray-500" />
}

const FileAttachment = memo(
    ({
        part,
        onPreview
    }: {
        part: { data: string; filename?: string; mimeType?: string }
        onPreview?: () => void
    }) => {
        const { isImage } = getFileTypeInfo(extractFileName(part.data), part.mimeType)

        const extractedFileName = extractFileName(part.data)

        const fileName = part.filename || extractedFileName
        const [imageError, setImageError] = useState(false)

        const handleInteraction = () => {
            if (onPreview) {
                onPreview()
            }
        }

        const handleKeyDown = (e: React.KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                handleInteraction()
            }
        }

        const handleImageError = () => {
            setImageError(true)
        }

        if (isImage) {
            if (imageError) {
                return (
                    <div className="group relative flex w-full max-w-md items-center justify-center rounded-lg border border-destructive/50 bg-destructive/10 p-8 transition-colors">
                        <div className="text-center">
                            <ImageIcon className="mx-auto mb-2 h-12 w-12 text-destructive/70" />
                            <p className="font-medium text-destructive text-sm">
                                Image unavailable
                            </p>
                            <p className="mt-1 text-muted-foreground text-xs">
                                File may have been deleted
                            </p>
                            {fileName !== "Unknown file" && (
                                <p className="mt-1 text-muted-foreground text-xs">{fileName}</p>
                            )}
                        </div>
                    </div>
                )
            }

            return (
                <img
                    src={`${browserEnv("VITE_CONVEX_API_URL")}/r2?key=${part.data}`}
                    alt={fileName}
                    className="w-full max-w-2xl cursor-pointer rounded-lg object-contain transition-opacity hover:opacity-90"
                    onClick={handleInteraction}
                    onKeyDown={handleKeyDown}
                    onError={handleImageError}
                    tabIndex={onPreview ? 0 : -1}
                    role={onPreview ? "button" : undefined}
                />
            )
        }

        return (
            <div
                className="group relative inline-flex cursor-pointer items-center gap-2 rounded-lg border bg-secondary/50 p-3 transition-colors hover:bg-secondary/80"
                onClick={handleInteraction}
                onKeyDown={handleKeyDown}
                tabIndex={onPreview ? 0 : -1}
                role={onPreview ? "button" : undefined}
            >
                <div className="flex items-center gap-2">
                    {getFileIcon(part)}
                    <div className="flex flex-col">
                        <span className="font-medium text-sm">{fileName}</span>
                        <span className="text-muted-foreground text-xs">File</span>
                    </div>
                </div>
            </div>
        )
    }
)
FileAttachment.displayName = "FileAttachment"

const PartsRenderer = memo(
    ({
        part,
        markdown,
        id,
        onFilePreview,
        isStreaming
    }: {
        part: UIMessage["parts"][number]
        markdown: boolean
        id: string
        onFilePreview?: (part: { data: string; filename?: string; mimeType?: string }) => void
        isStreaming?: boolean
    }) => {
        switch (part.type) {
            case "text":
                return markdown ? (
                    <MemoizedMarkdown content={part.text} id={id} />
                ) : (
                    <div>
                        {part.text.split("\n").map((line, index) => (
                            <div key={index}>{line}</div>
                        ))}
                    </div>
                )
            case "reasoning": {
                const hasReasoningContent = part.reasoning && part.reasoning.trim() !== ""
                const isReasoningStreaming =
                    isStreaming && (!hasReasoningContent || part.reasoning.endsWith(""))

                return (
                    <Reasoning className="mb-6" isStreaming={isReasoningStreaming}>
                        <ReasoningTrigger className="mb-4">Reasoning</ReasoningTrigger>
                        <ReasoningContent
                            markdown={markdown}
                            className="rounded-lg border bg-muted/50"
                            contentClassName="prose prose-p:my-0 prose-pre:my-2 prose-ul:my-2 prose-li:mt-1 prose-li:mb-0 max-w-none prose-pre:bg-transparent p-4 prose-pre:p-0 font-claude-message prose-headings:font-semibold prose-strong:font-medium prose-pre:text-foreground leading-[1.65rem] [&>div>div>:is(p,blockquote,h1,h2,h3,h4,h5,h6)]:pl-2 [&>div>div>:is(p,blockquote,ul,ol,h1,h2,h3,h4,h5,h6)]:pr-8 [&_.ignore-pre-bg>div]:bg-transparent [&_pre>div]:border-0.5 [&_pre>div]:border-border [&_pre>div]:bg-background"
                        >
                            {hasReasoningContent ? part.reasoning : ""}
                        </ReasoningContent>
                    </Reasoning>
                )
            }
            case "tool-invocation":
                if (part.toolInvocation.toolName === "web_search")
                    return <WebSearchToolRenderer toolInvocation={part.toolInvocation} />

                if (part.toolInvocation.toolName === "image_generation")
                    return <ImageGenerationToolRenderer toolInvocation={part.toolInvocation} />

                return <GenericToolRenderer toolInvocation={part.toolInvocation} />
            case "file":
                return <FileAttachment part={part} onPreview={() => onFilePreview?.(part)} />
        }
    }
)
PartsRenderer.displayName = "PartsRenderer"

const EditableMessage = memo(
    ({
        message,
        onSave,
        onCancel
    }: {
        message: UIMessage
        onSave: (newContent: string) => void
        onCancel: () => void
    }) => {
        const textContent = message.parts
            .filter((part) => part.type === "text")
            .map((part) => part.text)
            .join("\n")

        const [editedContent, setEditedContent] = useState(textContent)

        const handleSave = () => {
            onSave(editedContent)
        }

        const handleKeyDown = (e: React.KeyboardEvent) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                handleSave()
            }
            if (e.key === "Escape") {
                onCancel()
            }
        }

        return (
            <div className="mt-12 flex flex-col gap-3 rounded-lg border border-input bg-background/80 p-3 shadow-xs backdrop-blur-lg dark:bg-input/70">
                <Textarea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="min-h-[160px] w-full resize-none border-none bg-transparent text-foreground shadow-none outline-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
                    autoFocus
                />
                <div className="flex justify-end gap-2 px-4 pb-3">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onCancel}
                        className="rounded-md text-muted-foreground hover:text-foreground"
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleSave}
                        className="rounded-md"
                    >
                        Send
                    </Button>
                </div>
            </div>
        )
    }
)
EditableMessage.displayName = "EditableMessage"

export function Messages({
    messages,
    onRetry,
    onEditAndRetry,
    status,
    contentRef,
    scrollRef
}: {
    messages: UIMessage[]
    onRetry?: (message: UIMessage) => void
    onEditAndRetry?: (messageId: string, newContent: string) => void
    status: ReturnType<typeof useChatIntegration>["status"]
    contentRef: ReturnType<typeof useStickToBottom>["contentRef"]
    scrollRef: ReturnType<typeof useStickToBottom>["scrollRef"]
}) {
    const { setTargetFromMessageId, targetFromMessageId, setTargetMode, targetMode } =
        useChatStore()
    const { chatWidthState } = useChatWidthStore()

    const [previewDialogOpen, setPreviewDialogOpen] = useState(false)
    const [previewFile, setPreviewFile] = useState<{
        data: string
        filename?: string
        mimeType?: string
    } | null>(null)

    const handleEdit = (message: UIMessage) => {
        setTargetFromMessageId(message.id)
        setTargetMode("edit")
    }

    const handleSaveEdit = (newContent: string) => {
        if (targetFromMessageId && onEditAndRetry) {
            onEditAndRetry(targetFromMessageId, newContent)
        }
        setTargetFromMessageId(undefined)
        setTargetMode("normal")
    }

    const handleCancelEdit = () => {
        setTargetFromMessageId(undefined)
        setTargetMode("normal")
    }

    const handleFilePreview = (part: { data: string; filename?: string; mimeType?: string }) => {
        setPreviewFile(part)
        setPreviewDialogOpen(true)
    }

    const fileName = previewFile?.filename || extractFileName(previewFile?.data || "")

    const renderFilePreview = () => {
        if (!previewFile) return null

        const { isImage, isText, isPdf } = getFileTypeInfo(fileName, previewFile.mimeType)

        return (
            <div className="max-h-full overflow-auto">
                {isImage && (
                    <img
                        src={`${browserEnv("VITE_CONVEX_API_URL")}/r2?key=${previewFile.data}`}
                        alt={fileName}
                        className="h-auto w-full rounded object-contain"
                        onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.style.display = "none"
                            const errorDiv = target.nextElementSibling as HTMLElement
                            if (errorDiv) errorDiv.style.display = "flex"
                        }}
                    />
                )}

                {(isText || isPdf) && (
                    <iframe
                        src={`${browserEnv("VITE_CONVEX_API_URL")}/r2?key=${previewFile.data}`}
                        className="h-[69dvh] w-full rounded border-0"
                        title={fileName}
                    />
                )}
            </div>
        )
    }

    const lastMessage = messages[messages.length - 1]
    const isStreamingWithoutContent =
        status === "streaming" &&
        lastMessage?.role === "assistant" &&
        (!lastMessage.parts ||
            lastMessage.parts.length === 0 ||
            lastMessage.parts.every(
                (part) =>
                    (part.type === "text" && (!part.text || part.text.trim() === "")) ||
                    (part.type === "reasoning" && (!part.reasoning || part.reasoning.trim() === ""))
            ))

    const showTypingLoader = status === "submitted" || isStreamingWithoutContent

    const lastUserMessage = [...messages].reverse().find((message) => message.role === "user")

    return (
        <>
            <div className="min-h-[90dvh] overflow-y-auto p-4 pt-0" ref={scrollRef}>
                <div
                    ref={contentRef}
                    className={cn(
                        "mx-auto space-y-3 pb-16",
                        getChatWidthClass(chatWidthState.chatWidth)
                    )}
                >
                    {messages.map((message) => (
                        <div
                            key={message.id}
                            className={cn(
                                "prose relative prose-ol:my-2 prose-p:my-0 prose-pre:my-2 prose-ul:my-2 prose-li:mt-1 prose-li:mb-0 max-w-none prose-pre:bg-transparent prose-pre:p-0 font-claude-message prose-headings:font-semibold prose-strong:font-medium prose-pre:text-foreground leading-[1.65rem] [&>div>div>:is(p,blockquote,h1,h2,h3,h4,h5,h6)]:pl-2 [&>div>div>:is(p,blockquote,ul,ol,h1,h2,h3,h4,h5,h6)]:pr-8 [&_.ignore-pre-bg>div]:bg-transparent [&_pre>div]:border-0.5 [&_pre>div]:border-border [&_pre>div]:bg-background",
                                "group prose-img:mx-auto prose-img:my-4 prose-pre:grid prose-code:before:hidden prose-code:after:hidden",
                                "mb-8",
                                message.role === "user" &&
                                    targetFromMessageId !== message.id &&
                                    "my-12 ml-auto w-fit max-w-2xl rounded-md border border-border bg-secondary/50 px-4 py-2 text-foreground"
                            )}
                        >
                            {targetFromMessageId === message.id && targetMode === "edit" ? (
                                <EditableMessage
                                    message={message}
                                    onSave={handleSaveEdit}
                                    onCancel={handleCancelEdit}
                                />
                            ) : (
                                <>
                                    <div className="prose-p:not-last:mb-4 max-w-[calc(100vw-2rem)] overflow-hidden">
                                        {message.parts
                                            .filter((part) => part.type !== "file")
                                            .map((part, index) => (
                                                <PartsRenderer
                                                    key={`${message.id}-text-${index}`}
                                                    part={part}
                                                    markdown={message.role === "assistant"}
                                                    id={`${message.id}-text-${index}`}
                                                    onFilePreview={handleFilePreview}
                                                    isStreaming={
                                                        status === "streaming" &&
                                                        message === lastMessage
                                                    }
                                                />
                                            ))}
                                    </div>

                                    {message.parts.some((part) => part.type === "file") && (
                                        <div className="not-prose mt-3 flex flex-col justify-start space-y-3">
                                            {message.parts
                                                .filter((part) => part.type === "file")
                                                .map((part, index) => (
                                                    <PartsRenderer
                                                        key={`${message.id}-file-${index}`}
                                                        part={part}
                                                        markdown={message.role === "assistant"}
                                                        id={`${message.id}-file-${index}`}
                                                        onFilePreview={handleFilePreview}
                                                        isStreaming={
                                                            status === "streaming" &&
                                                            message === lastMessage
                                                        }
                                                    />
                                                ))}
                                        </div>
                                    )}

                                    {!targetFromMessageId && message.role === "user" ? (
                                        <ChatActions
                                            role={message.role}
                                            message={message}
                                            onRetry={onRetry}
                                            onEdit={
                                                message.parts.some((part) => part.type === "file")
                                                    ? undefined
                                                    : handleEdit
                                            }
                                        />
                                    ) : !targetFromMessageId && message.role === "assistant" ? (
                                        <ChatActions
                                            role={message.role}
                                            message={message}
                                            onRetry={undefined}
                                            onEdit={undefined}
                                        />
                                    ) : null}
                                </>
                            )}
                        </div>
                    ))}

                    {status === "error" && (
                        <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive p-4">
                            <div className="flex w-full items-center justify-between">
                                <p className="text-destructive-foreground">
                                    Oops! Something went wrong.
                                </p>
                                {lastUserMessage && (
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => onRetry?.(lastUserMessage)}
                                        className="text-destructive-foreground hover:text-destructive-foreground/80"
                                    >
                                        <RotateCcw />
                                        Retry
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="flex min-h-[3rem] items-center gap-2 py-4">
                        {showTypingLoader && <Loader variant="typing" size="md" />}
                    </div>
                </div>
            </div>

            <Dialog
                open={previewDialogOpen}
                onOpenChange={(open) => {
                    setPreviewDialogOpen(open)
                    if (!open) {
                        setTimeout(() => setPreviewFile(null), 100)
                    }
                }}
            >
                <DialogContent className="md:!max-w-[min(90vw,60rem)] max-h-[90dvh]">
                    {previewFile && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    {getFileIcon(previewFile)}
                                    {fileName || "Unknown file"}
                                </DialogTitle>
                            </DialogHeader>
                            {renderFilePreview()}
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </>
    )
}
