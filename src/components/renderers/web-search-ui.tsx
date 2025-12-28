import { cn } from "@/lib/utils"
import { ChevronDown, ExternalLink, Globe, Loader2 } from "lucide-react"
import { memo, useEffect, useRef, useState } from "react"

// Tool invocation type for AI SDK v6
type ToolInvocationType = {
    toolCallId: string
    toolName: string
    state:
        | "partial-call"
        | "call"
        | "result"
        | "input-streaming"
        | "input-available"
        | "output-streaming"
        | "output-available"
        | "error"
    args?: { query?: string }
    input?: unknown
    result?: {
        results?: Array<{ title?: string; description?: string; snippet?: string; url?: string }>
    }
    output?: unknown
}

function getFaviconUrl(url: string): string {
    try {
        const domain = new URL(url).hostname
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
    } catch {
        return ""
    }
}

function getOpenGraphImage(url: string): string {
    try {
        const domain = new URL(url).hostname
        return `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true&meta=false&embed=screenshot.url`
    } catch {
        return ""
    }
}

const FaviconWithLoader = memo(({ url }: { url: string }) => {
    const [imageLoaded, setImageLoaded] = useState(false)

    return (
        <div className="relative flex aspect-square h-4 w-4 items-center justify-center rounded-full">
            {!imageLoaded && (
                <div className="absolute inset-0 animate-pulse bg-muted-foreground/10" />
            )}
            <img
                src={getFaviconUrl(url)}
                alt=""
                className={cn("h-4 w-4 rounded-full object-contain", !imageLoaded && "opacity-0")}
                onLoad={() => setImageLoaded(true)}
                onError={(e) => {
                    setImageLoaded(true)
                    const target = e.target as HTMLImageElement
                    target.src =
                        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cline x1='12' y1='8' x2='12' y2='16'/%3E%3Cline x1='8' y1='12' x2='16' y2='12'/%3E%3C/svg%3E"
                }}
            />
        </div>
    )
})

export const WebSearchToolRenderer = memo(
    ({ toolInvocation }: { toolInvocation: ToolInvocationType }) => {
        const [isExpanded, setIsExpanded] = useState(false)
        const contentRef = useRef<HTMLDivElement>(null)
        const innerRef = useRef<HTMLDivElement>(null)

        if (toolInvocation.toolName !== "web_search") return null

        const isLoading = toolInvocation.state === "partial-call" || toolInvocation.state === "call"
        const hasResults = toolInvocation.state === "result" && !!toolInvocation.result
        const resultCount = toolInvocation.result?.results?.length ?? 0

        useEffect(() => {
            if (!contentRef.current || !innerRef.current) return

            const observer = new ResizeObserver(() => {
                if (contentRef.current && innerRef.current && isExpanded) {
                    contentRef.current.style.maxHeight = `${innerRef.current.scrollHeight}px`
                }
            })

            observer.observe(innerRef.current)

            if (isExpanded) {
                contentRef.current.style.maxHeight = `${innerRef.current.scrollHeight}px`
            }

            return () => observer.disconnect()
        }, [isExpanded])

        return (
            <div className="w-full">
                <button
                    type="button"
                    className="flex w-full cursor-pointer flex-col gap-2 text-left md:flex-row md:items-center"
                    onClick={() => setIsExpanded(!isExpanded)}
                    disabled={isLoading}
                >
                    {/* Main row with icon, title, and chevron */}
                    <div className="flex flex-1 items-center gap-2">
                        {isLoading ? (
                            <Loader2 className="size-4 animate-spin text-primary" />
                        ) : (
                            <Globe className="size-4 text-primary" />
                        )}
                        <span className="font-medium text-primary">Web Search</span>

                        {/* Spacer to push chevron to the right on mobile */}
                        <div className="flex-1 md:hidden" />

                        {!isLoading && hasResults && (
                            <div
                                className={cn(
                                    "transform transition-transform md:hidden",
                                    isExpanded ? "rotate-180" : ""
                                )}
                            >
                                <ChevronDown className="size-4 text-foreground" />
                            </div>
                        )}
                    </div>

                    {/* Query and results info */}
                    {(toolInvocation.args?.query || hasResults) && (
                        <div className="flex items-center gap-2 md:ml-auto">
                            <div className="flex items-center gap-2 rounded-md bg-muted/50 px-2 py-1 text-muted-foreground text-sm">
                                {toolInvocation.args?.query && (
                                    <span className="max-w-32 truncate text-muted-foreground text-sm md:max-w-48">
                                        "{toolInvocation.args.query}"
                                    </span>
                                )}
                                {hasResults && (
                                    <span className="text-muted-foreground text-sm">
                                        <div className="flex items-center gap-2">
                                            <div className="size-1 rounded-full bg-primary" />
                                            <span className="truncate">{resultCount} results</span>
                                        </div>
                                    </span>
                                )}
                            </div>

                            {/* Desktop chevron */}
                            {!isLoading && hasResults && (
                                <div
                                    className={cn(
                                        "hidden transform transition-transform md:block",
                                        isExpanded ? "rotate-180" : ""
                                    )}
                                >
                                    <ChevronDown className="size-4 text-foreground" />
                                </div>
                            )}
                        </div>
                    )}
                </button>

                <div
                    ref={contentRef}
                    className={cn(
                        "overflow-hidden transition-[max-height] duration-150 ease-out",
                        "my-4 rounded-lg border bg-muted/50"
                    )}
                    style={{
                        maxHeight: isExpanded ? contentRef.current?.scrollHeight : "0px"
                    }}
                >
                    <div ref={innerRef} className="text-muted-foreground">
                        {hasResults && (
                            <div className="relative w-full">
                                <div className="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border flex gap-4 overflow-x-auto p-4">
                                    {toolInvocation.result?.results?.map(
                                        (result: any, index: number) => (
                                            <button
                                                key={index}
                                                type="button"
                                                className={cn(
                                                    "group relative flex-shrink-0 rounded-lg border bg-card text-left",
                                                    "transition-all duration-200 hover:border-primary/20 hover:shadow-lg",
                                                    "hover:border-primary/20 hover:bg-accent/50",
                                                    "w-64 min-w-64 overflow-hidden"
                                                )}
                                                onClick={() =>
                                                    result.url && window.open(result.url, "_blank")
                                                }
                                                aria-label={`Open ${result.title} in new tab`}
                                            >
                                                {result.url && (
                                                    <div className="relative h-32 overflow-hidden bg-muted/30">
                                                        <img
                                                            src={getOpenGraphImage(result.url)}
                                                            alt=""
                                                            className="aspect-video h-full w-full object-cover"
                                                            style={{
                                                                margin: "0 auto",
                                                                maxHeight: "100%"
                                                            }}
                                                            onError={(e) => {
                                                                const target =
                                                                    e.target as HTMLImageElement
                                                                target.style.display = "none"
                                                                const fallback =
                                                                    target.nextElementSibling as HTMLDivElement
                                                                if (fallback)
                                                                    fallback.style.display = "flex"
                                                            }}
                                                        />
                                                        <div
                                                            className="absolute inset-0 hidden items-center justify-center bg-muted/50"
                                                            style={{ display: "none" }}
                                                        >
                                                            <Globe className="size-8 text-muted-foreground/50" />
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="space-y-2 p-4">
                                                    <div className="flex items-center gap-2">
                                                        {result.url && (
                                                            <FaviconWithLoader url={result.url} />
                                                        )}

                                                        <h1 className="leading m-0 mb-0 truncate font-semibold text-base text-foreground">
                                                            {result.title}
                                                        </h1>
                                                    </div>
                                                    <p className="line-clamp-3 text-muted-foreground text-sm leading-relaxed">
                                                        {result.description || result.snippet}
                                                    </p>

                                                    {result.url && (
                                                        <div className="flex items-center gap-1.5 border-border/50 border-t pt-2">
                                                            <span className="flex-1 truncate text-muted-foreground/70 text-xs">
                                                                {
                                                                    result.url
                                                                        .replace(
                                                                            /^(https?:\/\/)/,
                                                                            ""
                                                                        )
                                                                        .split("/")[0]
                                                                }
                                                            </span>
                                                            <ExternalLink className="size-3 flex-shrink-0 text-muted-foreground/50" />
                                                        </div>
                                                    )}
                                                </div>
                                            </button>
                                        )
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )
    }
)

WebSearchToolRenderer.displayName = "WebSearchToolRenderer"
