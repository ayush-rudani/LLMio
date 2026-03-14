import { ImageSkeleton } from "@/components/ui/image-skeleton"
import { MODELS_SHARED } from "@/convex/lib/models"
import { browserEnv } from "@/lib/browser-env"
import { AlertCircle } from "lucide-react"
import { memo, useMemo, useState } from "react"

// Custom type to match our DB schema (v4-compatible format)
type ImageGenerationArgs = {
    imageSize?: string
    prompt?: string
}

type ImageGenerationResult = {
    error?: string
    assets?: { imageUrl: string }[]
    prompt?: string
    modelId?: string
}

// General type for tool invocations passed from messages.tsx
type GenericDBToolInvocation = {
    state: "call" | "result" | "partial-call"
    args?: unknown
    result?: unknown
    toolCallId: string
    toolName: string
}

export const ImageGenerationToolRenderer = memo(
    ({ toolInvocation }: { toolInvocation: GenericDBToolInvocation }) => {
        if (toolInvocation.toolName !== "image_generation") return null

        const args = toolInvocation.args as ImageGenerationArgs | undefined
        const result = toolInvocation.result as ImageGenerationResult | undefined

        const isLoading = toolInvocation.state === "partial-call" || toolInvocation.state === "call"
        const hasResult = toolInvocation.state === "result" && !!result
        const hasError = hasResult && !!result?.error

        // Extract aspect ratio from args to determine container dimensions
        const aspectRatio = args?.imageSize || "1:1"

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
                        {result?.error || "Failed to generate image"}
                    </p>
                </div>
            )
        }

        if (hasResult && result?.assets) {
            const assets = result.assets
            const prompt = result.prompt || args?.prompt || ""

            const modelName = result.modelId
                ? MODELS_SHARED.find((m) => m.id === result.modelId)?.name || ""
                : ""

            return assets.map((asset, index) => (
                <ImageWithErrorHandler
                    key={index}
                    asset={asset}
                    prompt={prompt}
                    modelName={modelName}
                    cssAspectRatio={cssAspectRatio}
                />
            ))
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
