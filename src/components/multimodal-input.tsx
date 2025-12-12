import { ModelSelector } from "@/components/model-selector"
import {
    PromptInput,
    PromptInputAction,
    PromptInputActions,
    type PromptInputRef,
    PromptInputTextarea
} from "@/components/prompt-kit/prompt-input"
import { ToolSelectorPopover } from "@/components/tool-selector-popover"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select"
import { VoiceRecorder } from "@/components/voice-recorder"
import { api } from "@/convex/_generated/api"
import { type ImageSize, MODELS_SHARED } from "@/convex/lib/models"
import { DefaultSettings } from "@/convex/settings"
import { useSession, useToken } from "@/hooks/auth-hooks"
import { useVoiceRecorder } from "@/hooks/use-voice-recorder"
import { browserEnv } from "@/lib/browser-env"
import { type UploadedFile, useChatStore } from "@/lib/chat-store"
import { getChatWidthClass, useChatWidthStore } from "@/lib/chat-width-store"
import { useDiskCachedQuery } from "@/lib/convex-cached-query"
import {
    MAX_FILE_SIZE,
    MAX_TOKENS_PER_FILE,
    estimateTokenCount,
    getFileAcceptAttribute,
    getFileTypeInfo,
    isImageMimeType,
    isSupportedFile,
    isTextMimeType
} from "@/lib/file_constants"
import { type ReasoningEffort, useModelStore } from "@/lib/model-store"
import { cn } from "@/lib/utils"
import type { useChat } from "@ai-sdk/react"
import { useLocation } from "@tanstack/react-router"
import { useConvexAuth } from "convex/react"
import {
    ArrowUp,
    Brain,
    Code,
    FileType,
    Image as ImageIcon,
    Loader2,
    Mic,
    Paperclip,
    Square,
    Upload,
    X,
    Zap
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

interface ExtendedUploadedFile extends UploadedFile {
    file?: File
}

const AspectRatioSelector = ({ selectedModel }: { selectedModel: string | null }) => {
    const { selectedImageSize, setSelectedImageSize } = useModelStore()

    const supportedImageSizes = useMemo(() => {
        if (!selectedModel) return []
        const model = MODELS_SHARED.find((m) => m.id === selectedModel)
        return model?.supportedImageSizes || []
    }, [selectedModel])

    // Auto-select a valid image size when the model changes
    useEffect(() => {
        if (supportedImageSizes.length > 0) {
            // Check if current selection is supported
            if (!supportedImageSizes.includes(selectedImageSize)) {
                // Try "1:1" first, otherwise pick the first supported size
                const defaultSize = supportedImageSizes.includes("1:1" as ImageSize)
                    ? ("1:1" as ImageSize)
                    : supportedImageSizes[0]
                setSelectedImageSize(defaultSize)
            }
        }
    }, [supportedImageSizes, selectedImageSize, setSelectedImageSize])

    const formatImageSizeForDisplay = (size: string) => {
        // Convert resolution format (1024x1024) to aspect ratio (1:1)
        if (size.includes("x")) {
            const [width, height] = size.split("x").map(Number)
            const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
            const divisor = gcd(width, height)
            return `${width / divisor}:${height / divisor}`
        }

        // Handle HD variants
        if (size.endsWith("-hd")) {
            return size.replace("-hd", " (HD)")
        }

        return size
    }

    if (supportedImageSizes.length === 0) return null

    return (
        <PromptInputAction tooltip="Select aspect ratio">
            <Select value={selectedImageSize} onValueChange={setSelectedImageSize}>
                <SelectTrigger className="!h-8 w-auto min-w-[80px] border bg-secondary/70 font-normal text-xs backdrop-blur-lg hover:bg-secondary/80 sm:text-sm">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {supportedImageSizes.map((size) => (
                        <SelectItem key={size} value={size} className="text-xs sm:text-sm">
                            {formatImageSizeForDisplay(size)}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </PromptInputAction>
    )
}

const ReasoningEffortSelector = ({ selectedModel }: { selectedModel: string | null }) => {
    const { reasoningEffort, setReasoningEffort } = useModelStore()

    const [modelSupportsEffortControl, modelSupportsDisablingReasoning] = useMemo(() => {
        if (!selectedModel) return [false, false]
        const model = MODELS_SHARED.find((m) => m.id === selectedModel)
        return [
            model?.abilities.includes("effort_control") ?? false,
            model?.supportsDisablingReasoning ?? false
        ]
    }, [selectedModel])

    if (!modelSupportsEffortControl) return null

    const formatEffortForDisplay = (effort: ReasoningEffort) => {
        return effort.charAt(0).toUpperCase() + effort.slice(1)
    }

    return (
        <PromptInputAction tooltip="Select reasoning effort">
            <Select value={reasoningEffort} onValueChange={setReasoningEffort}>
                <SelectTrigger className="!h-8 w-auto gap-0.5 border-0 bg-secondary/70 px-1.5 font-normal text-xs backdrop-blur-lg transition-colors hover:bg-accent sm:text-sm">
                    <div className="hidden items-center gap-1.5 sm:flex">
                        <Brain className="size-4" />
                        <SelectValue />
                    </div>
                    <Zap className="size-4 sm:hidden" />
                </SelectTrigger>
                <SelectContent>
                    {modelSupportsDisablingReasoning && (
                        <SelectItem value="off" className="text-xs sm:text-sm">
                            {formatEffortForDisplay("off")}
                        </SelectItem>
                    )}
                    <SelectItem value="low" className="text-xs sm:text-sm">
                        {formatEffortForDisplay("low")}
                    </SelectItem>
                    <SelectItem value="medium" className="text-xs sm:text-sm">
                        {formatEffortForDisplay("medium")}
                    </SelectItem>
                    <SelectItem value="high" className="text-xs sm:text-sm">
                        {formatEffortForDisplay("high")}
                    </SelectItem>
                </SelectContent>
            </Select>
        </PromptInputAction>
    )
}

export function MultimodalInput({
    onSubmit,
    status
}: {
    onSubmit: (input?: string, files?: UploadedFile[]) => void
    status: ReturnType<typeof useChat>["status"]
}) {
    const { token } = useToken()
    const location = useLocation()
    const session = useSession()
    const auth = useConvexAuth()
    // Extract threadId from URL
    const threadId = location.pathname.includes("/thread/")
        ? location.pathname.split("/thread/")[1]?.split("/")[0]
        : undefined

    const { selectedModel, setSelectedModel, enabledTools, setEnabledTools } = useModelStore()
    const { uploadedFiles, addUploadedFile, removeUploadedFile, uploading, setUploading } =
        useChatStore()
    const { chatWidthState } = useChatWidthStore()

    const isLoading = status === "streaming"
    const uploadInputRef = useRef<HTMLInputElement>(null)
    const promptInputRef = useRef<PromptInputRef>(null)
    const [dragActive, setDragActive] = useState(false)
    const [fileContents, setFileContents] = useState<Record<string, string>>({})
    const [dialogFile, setDialogFile] = useState<{
        content: string
        fileName: string
        fileType: string
    } | null>(null)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [extendedFiles, setExtendedFiles] = useState<ExtendedUploadedFile[]>([])
    const userSettings = useDiskCachedQuery(
        api.settings.getUserSettings,
        {
            key: "user-settings",
            default: DefaultSettings(session.user?.id ?? "CACHE"),
            forceCache: true
        },
        session.user?.id && !auth.isLoading ? {} : "skip"
    )

    // Voice recording state
    const {
        state: voiceState,
        startRecording,
        stopRecording
    } = useVoiceRecorder({
        onTranscript: (text: string) => {
            // Insert transcribed text into the input
            console.log("🎤", promptInputRef.current)
            if (promptInputRef.current) {
                const currentValue = promptInputRef.current.getValue()
                const newValue = currentValue ? `${currentValue} ${text}` : text
                promptInputRef.current.setValue(newValue)
                // Save to localStorage like the existing system does
                localStorage.setItem("user-input", newValue)
                promptInputRef.current.focus()
                // Update our input value state
                setInputValue(newValue)
            }
        }
    })

    // Check if current model supports vision and is image model
    const [
        modelSupportsVision,
        modelSupportsFunctionCalling,
        _modelSupportsReasoning,
        isImageModel
    ] = useMemo(() => {
        if (!selectedModel) return [false, false, false, false]
        const model = MODELS_SHARED.find((m) => m.id === selectedModel)
        return [
            model?.abilities.includes("vision") ?? false,
            model?.abilities.includes("function_calling") ?? false,
            model?.abilities.includes("reasoning") ?? false,
            model?.mode === "image"
        ]
    }, [selectedModel])

    useEffect(() => {
        setExtendedFiles(uploadedFiles.map((file) => ({ ...file })))
    }, [uploadedFiles])

    useEffect(() => {
        if (!modelSupportsFunctionCalling && enabledTools.includes("web_search")) {
            setEnabledTools(enabledTools.filter((tool) => tool !== "web_search"))
        }
    }, [modelSupportsFunctionCalling, enabledTools, setEnabledTools])

    const handleSubmit = async () => {
        const inputValue = promptInputRef.current?.getValue() || ""

        if (!inputValue.trim()) {
            promptInputRef.current?.focus()
            return
        }

        promptInputRef.current?.clear()
        localStorage.removeItem("user-input")
        setInputValue("") // Update our state too
        onSubmit(inputValue, uploadedFiles)
    }

    // Check if input is empty for mic button display
    const [inputValue, setInputValue] = useState("")
    const isInputEmpty = !inputValue.trim()

    // Listen to input changes by checking the prompt input value periodically
    // This is simpler and avoids accessing internal refs
    useEffect(() => {
        const checkInputValue = () => {
            const value = promptInputRef.current?.getValue() || ""
            setInputValue(value)
        }

        // Check initial value from localStorage
        const initialValue = localStorage.getItem("user-input") || ""
        setInputValue(initialValue)

        // Check periodically for changes
        const interval = setInterval(checkInputValue, 200)
        return () => clearInterval(interval)
    }, [])

    const handleVoiceButtonClick = () => {
        if (voiceState.isRecording) {
            stopRecording()
        } else if (isInputEmpty && !isLoading) {
            startRecording()
        } else {
            handleSubmit()
        }
    }

    const readFileContent = useCallback(async (file: File): Promise<string> => {
        return new Promise((resolve) => {
            const reader = new FileReader()
            reader.onload = (e) => {
                const result = e.target?.result as string
                resolve(result)
            }
            reader.onerror = () => resolve("Error reading file")

            if (isImageMimeType(file.type)) {
                reader.readAsDataURL(file)
            } else if (isTextMimeType(file.type) || getFileTypeInfo(file.name, file.type).isText) {
                reader.readAsText(file)
            } else {
                resolve(`Binary file: ${file.name}`)
            }
        })
    }, [])

    const uploadFile = useCallback(
        async (file: File): Promise<ExtendedUploadedFile> => {
            const formData = new FormData()
            formData.append("file", file)
            formData.append("fileName", file.name)

            const response = await fetch(`${browserEnv("VITE_CONVEX_API_URL")}/upload`, {
                method: "POST",
                body: formData,
                headers: {
                    Authorization: `Bearer ${token}`
                }
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || "Upload failed")
            }

            const result = await response.json()
            return {
                ...result,
                file
            }
        },
        [token]
    )

    const handleFileUpload = useCallback(
        async (filesToUpload: File[]) => {
            if (filesToUpload.length === 0) return

            // Validate files before uploading
            const validFiles: File[] = []
            const errors: string[] = []

            for (const file of filesToUpload) {
                // Check file size
                if (file.size > MAX_FILE_SIZE) {
                    errors.push(`${file.name}: File size exceeds 5MB limit`)
                    continue
                }

                // Check if file type is supported
                if (!isSupportedFile(file.name, file.type)) {
                    errors.push(`${file.name}: Unsupported file type`)
                    continue
                }

                const fileTypeInfo = getFileTypeInfo(file.name, file.type)

                // If file is an image but model doesn't support vision, reject it
                if (fileTypeInfo.isImage && !modelSupportsVision) {
                    errors.push(`${file.name}: Current model doesn't support image files`)
                    continue
                }

                // For text files, check token count
                if (fileTypeInfo.isText && !fileTypeInfo.isImage) {
                    try {
                        const content = await readFileContent(file)
                        const tokenCount = estimateTokenCount(content)
                        if (tokenCount > MAX_TOKENS_PER_FILE) {
                            errors.push(
                                `${file.name}: File exceeds ${MAX_TOKENS_PER_FILE.toLocaleString()} token limit`
                            )
                            continue
                        }
                    } catch (error) {
                        errors.push(`${file.name}: Error reading file content`)
                        continue
                    }
                }

                validFiles.push(file)
            }

            // Show validation errors
            if (errors.length > 0) {
                toast.error(`File validation failed:\n${errors.join("\n")}`)
                if (validFiles.length === 0) return
            }

            setUploading(true)
            try {
                const uploadPromises = validFiles.map((file) => uploadFile(file))
                const uploadedResults = await Promise.all(uploadPromises)

                for (const result of uploadedResults) {
                    addUploadedFile(result)

                    if (result.file) {
                        const content = await readFileContent(result.file)
                        setFileContents((prev) => ({
                            ...prev,
                            [result.key]: content
                        }))
                    }
                }

                if (uploadInputRef.current) {
                    uploadInputRef.current.value = ""
                }
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "Upload failed")
            } finally {
                setUploading(false)
            }
        },
        [uploadFile, addUploadedFile, setUploading, readFileContent, modelSupportsVision]
    )

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            const newFiles = Array.from(event.target.files)
            handleFileUpload(newFiles)
        }
    }

    const handleRemoveFile = (key: string) => {
        removeUploadedFile(key)
        setFileContents((prev) => {
            const newContents = { ...prev }
            delete newContents[key]
            return newContents
        })
    }

    const handlePaste = useCallback(
        async (e: ClipboardEvent) => {
            const items = Array.from(e.clipboardData?.items || [])
            const files: File[] = []
            let hasText = false

            for (const item of items) {
                if (item.kind === "file") {
                    const file = item.getAsFile()
                    if (file) {
                        files.push(file)
                        e.preventDefault()
                    }
                } else if (item.kind === "string" && item.type === "text/plain") {
                    hasText = true
                }
            }

            if (files.length > 0) {
                await handleFileUpload(files)
            }

            if (!hasText && files.length === 0) {
                e.preventDefault()
            }
        },
        [handleFileUpload]
    )

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault()
            e.stopPropagation()
            setDragActive(false)

            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                const newFiles = Array.from(e.dataTransfer.files)
                handleFileUpload(newFiles)
            }
        },
        [handleFileUpload]
    )

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setDragActive(true)
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setDragActive(false)
    }, [])

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return "0 Bytes"
        const k = 1024
        const sizes = ["Bytes", "KB", "MB", "GB"]
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
    }

    const getFileType = (
        uploadedFile: ExtendedUploadedFile
    ): { isImage: boolean; isCode: boolean; isText: boolean } => {
        const fileType = uploadedFile.file?.type || uploadedFile.fileType
        return getFileTypeInfo(uploadedFile.fileName, fileType)
    }

    const getFileIcon = (uploadedFile: ExtendedUploadedFile) => {
        const { isImage, isCode } = getFileType(uploadedFile)

        if (isImage) return <ImageIcon className="size-4 text-blue-500" />
        if (isCode) return <Code className="size-4 text-green-500" />
        return <FileType className="size-4 text-gray-500" />
    }

    const renderFilePreview = (uploadedFile: ExtendedUploadedFile) => {
        const content = fileContents[uploadedFile.key]
        const { isImage, isText } = getFileType(uploadedFile)

        return (
            <div key={uploadedFile.key} className="group relative">
                <button
                    type="button"
                    onClick={() => {
                        setDialogFile({
                            content,
                            fileName: uploadedFile.fileName,
                            fileType: uploadedFile.fileType
                        })
                        setDialogOpen(true)
                    }}
                    className={cn(
                        "relative flex h-12 items-center justify-center overflow-hidden rounded-lg border-2 border-border bg-secondary/50 transition-colors hover:bg-secondary/80",
                        isImage && "w-12"
                    )}
                >
                    {content && isImage ? (
                        <img
                            src={content}
                            alt=""
                            className="h-full w-full rounded-md object-cover"
                        />
                    ) : (
                        <div className="flex items-center justify-center gap-2 px-2 font-medium text-sm">
                            {getFileIcon(uploadedFile)}
                            <div className="flex flex-col items-start">
                                <span className="truncate text-ellipsis">
                                    {uploadedFile.fileName}
                                </span>
                                <span className="text-muted-foreground text-xs">
                                    {formatFileSize(uploadedFile.fileSize)}
                                </span>
                            </div>
                        </div>
                    )}
                </button>

                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                        e.stopPropagation()
                        handleRemoveFile(uploadedFile.key)
                    }}
                    className="-top-2 -right-2 absolute h-5 w-5 rounded-full bg-destructive p-0 text-destructive-foreground opacity-0 transition-opacity hover:bg-destructive/80 group-hover:opacity-100"
                >
                    <X className="size-3" />
                </Button>
            </div>
        )
    }

    const renderDialogContent = () => {
        if (!dialogFile) return null

        const fileTypeInfo = getFileTypeInfo(dialogFile.fileName, dialogFile.fileType)
        const isImage = fileTypeInfo.isImage
        const isText = fileTypeInfo.isText

        return (
            <div className="max-h-[70dvh] w-full overflow-auto">
                {isImage ? (
                    <img
                        src={dialogFile.content}
                        alt={dialogFile.fileName}
                        className="h-auto w-full rounded object-contain"
                    />
                ) : isText ? (
                    <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded bg-muted p-4 text-sm">
                        {dialogFile.content}
                    </pre>
                ) : (
                    <div className="flex items-center justify-center p-8 text-muted-foreground">
                        <div className="text-center">
                            <FileType className="mx-auto mb-2 size-12" />
                            <p>Binary file: {dialogFile.fileName}</p>
                            <p className="mt-1 text-xs">Preview not available</p>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    const [isClient, setIsClient] = useState(false)

    useEffect(() => {
        setIsClient(true)
    }, [])

    useEffect(() => {
        const handleGlobalPaste = (e: ClipboardEvent) => {
            if (
                document.activeElement?.tagName === "TEXTAREA" ||
                document.activeElement?.tagName === "INPUT"
            ) {
                handlePaste(e)
            }
        }

        document.addEventListener("paste", handleGlobalPaste)
        return () => document.removeEventListener("paste", handleGlobalPaste)
    }, [handlePaste])

    useEffect(() => {
        if (location.pathname.includes("/thread/")) {
            const timer = setTimeout(() => {
                promptInputRef.current?.focus()
            }, 100)
            return () => clearTimeout(timer)
        }
    }, [location.pathname])

    if (!isClient) return null

    return (
        <>
            {(voiceState.isRecording || voiceState.isTranscribing) && (
                <div className="@container w-full md:px-2">
                    <VoiceRecorder
                        state={voiceState}
                        onStop={stopRecording}
                        className={cn(
                            "mx-auto w-full",
                            getChatWidthClass(chatWidthState.chatWidth)
                        )}
                    />
                </div>
            )}

            <div
                className={cn(
                    "@container w-full px-1",
                    (voiceState.isRecording || voiceState.isTranscribing) && "hidden"
                )}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
            >
                <PromptInput
                    ref={promptInputRef}
                    onSubmit={handleSubmit}
                    className={cn(
                        "mx-auto w-full",
                        getChatWidthClass(chatWidthState.chatWidth),
                        dragActive && "rounded-lg ring-2 ring-primary ring-offset-2"
                    )}
                >
                    {extendedFiles.length > 0 && (
                        <div className="flex flex-wrap gap-2 pb-3">
                            {extendedFiles.map(renderFilePreview)}
                        </div>
                    )}
                    <PromptInputTextarea
                        autoFocus
                        placeholder={
                            isImageModel
                                ? "Describe the image you want to generate..."
                                : "Ask me anything..."
                        }
                    />

                    <PromptInputActions className="flex items-center justify-between gap-2 pt-2">
                        <div className="flex items-center gap-2">
                            {dragActive && (
                                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg border-2 border-primary border-dashed bg-primary/5">
                                    <div className="text-center">
                                        <Upload className="mx-auto mb-2 h-8 w-8 text-foreground" />
                                        <p className="font-medium text-foreground text-sm">
                                            Drop files here to upload
                                        </p>
                                    </div>
                                </div>
                            )}
                            <ModelSelector
                                selectedModel={selectedModel || ""}
                                onModelChange={setSelectedModel}
                            />

                            {isImageModel ? (
                                <AspectRatioSelector selectedModel={selectedModel} />
                            ) : (
                                <>
                                    <PromptInputAction tooltip="Attach files">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            onClick={() => uploadInputRef.current?.click()}
                                            className={cn(
                                                "flex size-8 cursor-pointer items-center justify-center gap-1 rounded-md bg-secondary/70 text-foreground backdrop-blur-lg hover:bg-secondary/80"
                                            )}
                                        >
                                            <input
                                                type="file"
                                                multiple
                                                onChange={handleFileChange}
                                                className="hidden"
                                                ref={uploadInputRef}
                                                accept={getFileAcceptAttribute(modelSupportsVision)}
                                            />
                                            {uploading ? (
                                                <Loader2 className="size-4 animate-spin" />
                                            ) : (
                                                <Paperclip className="-rotate-45 size-4 hover:text-primary" />
                                            )}
                                        </Button>
                                    </PromptInputAction>

                                    <PromptInputAction tooltip="Tools">
                                        <ToolSelectorPopover
                                            threadId={threadId}
                                            enabledTools={enabledTools}
                                            onEnabledToolsChange={setEnabledTools}
                                            modelSupportsFunctionCalling={
                                                modelSupportsFunctionCalling
                                            }
                                        />
                                    </PromptInputAction>

                                    <ReasoningEffortSelector selectedModel={selectedModel} />
                                </>
                            )}
                        </div>

                        <PromptInputAction
                            tooltip={
                                isInputEmpty && !isLoading
                                    ? "Voice input"
                                    : isLoading
                                      ? "Stop generation"
                                      : "Send message"
                            }
                        >
                            <Button
                                variant="default"
                                size="icon"
                                className="size-8 shrink-0 rounded-md"
                                disabled={status === "submitted" || uploading}
                                onClick={handleVoiceButtonClick}
                                type="submit"
                            >
                                {isLoading ? (
                                    <Square className="size-5 fill-current" />
                                ) : status === "submitted" ? (
                                    <Loader2 className="size-5 animate-spin" />
                                ) : isInputEmpty ? (
                                    <Mic className="size-5" />
                                ) : (
                                    <ArrowUp className="size-5" />
                                )}
                            </Button>
                        </PromptInputAction>
                    </PromptInputActions>
                </PromptInput>
            </div>

            <Dialog
                open={dialogOpen}
                onOpenChange={(open) => {
                    setDialogOpen(open)
                    if (!open) {
                        setTimeout(() => setDialogFile(null), 150)
                    }
                }}
            >
                <DialogContent className="md:!max-w-[min(90vw,60rem)] max-h-[90dvh] max-w-full">
                    {dialogFile && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    {getFileIcon({
                                        fileName: dialogFile.fileName,
                                        fileType: dialogFile.fileType
                                    } as ExtendedUploadedFile)}
                                    {dialogFile.fileName}
                                </DialogTitle>
                            </DialogHeader>
                            {renderDialogContent()}
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </>
    )
}
