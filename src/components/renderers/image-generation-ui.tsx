import { ImageSkeleton } from "@/components/ui/image-skeleton"
import { MODELS_SHARED } from "@/convex/lib/models"
import { browserEnv } from "@/lib/browser-env"
import type { DynamicToolUIPart } from "ai"
import { AlertCircle } from "lucide-react"
import { memo, useMemo, useState } from "react"

export const ImageGenerationToolRenderer = memo(
    ({ toolInvocation }: { toolInvocation: DynamicToolUIPart }) => {
        if (toolInvocation.toolName !== "image_generation") return null

        // V5 states: "input-streaming", "input-available", "output-available", "output-error"
        const isLoading =
            toolInvocation.state === "input-streaming" || toolInvocation.state === "input-available"
        const hasResult =
            toolInvocation.state === "output-available" && toolInvocation.output !== undefined
        const hasError = toolInvocation.state === "output-error"

        // Extract aspect ratio from input (V5) instead of args (V4)
        const aspectRatio = (toolInvocation.input as { imageSize?: string })?.imageSize || "1:1"

        // Convert aspect ratio to CSS aspect-ratio value
        const cssAspectRatio = useMemo(() => {
            if (aspectRatio.includes("x")) {
                // Handle resolution format (1024x1024 -> 1/1)
                const [width, height] = aspectRatio.split("x").map(Number)
                return `${width}/${height}`
            }
            if (aspectRatio.includes(":")) {
                // Handle aspect ratio format (16:9 -> 16/9, 1:1-hd -> 1/1)
                const baseRatio = aspectRatio.replace("-hd", "")
                return baseRatio.replace(":", "/")
            }
            return "1/1" // fallback
        }, [aspectRatio])

        // Format aspect ratio for display
        const displayAspectRatio = useMemo(() => {
            if (aspectRatio.includes("x")) {
                const [width, height] = aspectRatio.split("x").map(Number)
                const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
                const divisor = gcd(width, height)
                return `${width / divisor}:${height / divisor}`
            }
            return aspectRatio.replace("-hd", " (HD)")
        }, [aspectRatio])

        // Calculate optimal rows and cols based on aspect ratio
        const { rows, cols } = useMemo(() => {
            const [widthRatio, heightRatio] = cssAspectRatio.split("/").map(Number)
            const baseSize = 20 // Base number of dots for smaller dimension

            if (widthRatio >= heightRatio) {
                // Landscape or square
                const calculatedCols = Math.round(baseSize * (widthRatio / heightRatio))
                return { rows: baseSize, cols: calculatedCols }
            }
            // Portrait
            const calculatedRows = Math.round(baseSize * (heightRatio / widthRatio))
            return { rows: calculatedRows, cols: baseSize }
        }, [cssAspectRatio])

        if (isLoading) {
            return (
                <div
                    className="w-full max-w-md overflow-hidden rounded-xl border bg-muted/5"
                    style={{ aspectRatio: cssAspectRatio }}
                >
                    <ImageSkeleton
                        rows={rows}
                        cols={cols}
                        dotSize={3}
                        gap={4}
                        loadingDuration={99999}
                        autoLoop={false}
                        className="h-full w-full rounded-xl border-0 bg-transparent"
                    />
                </div>
            )
        }

        if (hasError) {
            return (
                <div
                    className="flex w-full max-w-md flex-col items-center justify-center rounded-xl border border-destructive/50 bg-destructive/10"
                    style={{ aspectRatio: cssAspectRatio }}
                >
                    <AlertCircle className="mx-auto mb-2 size-8 text-destructive/70" />
                    <p className="text-destructive text-sm">
                        {toolInvocation.errorText || "Failed to generate image"}
                    </p>
                </div>
            )
        }

        if (hasResult) {
            // V5: Use output instead of result
            const output = toolInvocation.output as {
                assets?: Array<{ imageUrl?: string }>
                prompt?: string
                modelId?: string
            }

            if (output.assets) {
                const assets = output.assets
                // V5: Get prompt from output or input
                const prompt =
                    output.prompt || (toolInvocation.input as { prompt?: string })?.prompt

                const modelName = output.modelId
                    ? MODELS_SHARED.find((m) => m.id === output.modelId)?.name
                    : output.modelId

                return assets.map((asset, index) => (
                    <ImageWithErrorHandler
                        key={index}
                        asset={asset}
                        prompt={prompt || ""}
                        modelName={modelName || ""}
                        cssAspectRatio={cssAspectRatio}
                    />
                ))
            }
        }

        return null
    }
)

ImageGenerationToolRenderer.displayName = "ImageGenerationToolRenderer"

const ImageWithErrorHandler = memo(
    ({
        asset,
        prompt,
        modelName,
        cssAspectRatio
    }: { asset: any; prompt: string; modelName: string; cssAspectRatio: string }) => {
        const [isError, setIsError] = useState(false)

        if (isError) {
            return (
                <div
                    className="flex w-full max-w-md items-center justify-center rounded-xl border bg-muted/50"
                    style={{ aspectRatio: cssAspectRatio }}
                >
                    <div className="flex flex-col items-center gap-2">
                        <AlertCircle className="mx-auto mb-2 size-8 text-destructive/70" />
                        <p className="text-destructive text-sm">Failed to load image</p>
                    </div>
                </div>
            )
        }
        return (
            <div
                className="not-prose relative w-full max-w-md overflow-hidden"
                style={{ aspectRatio: cssAspectRatio }}
            >
                <img
                    src={`${browserEnv("VITE_CONVEX_API_URL")}/r2?key=${asset.imageUrl}`}
                    alt={prompt || "Generated image"}
                    className="w-full max-w-md rounded-xl border bg-background object-cover"
                    style={{ aspectRatio: cssAspectRatio }}
                    onError={(e) => {
                        setIsError(true)
                    }}
                />
            </div>
        )
    }
)
