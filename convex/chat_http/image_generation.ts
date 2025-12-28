import type { ImageModelV2 } from "@ai-sdk/provider"
import { experimental_generateImage } from "ai"
import type { GenericActionCtx } from "convex/server"
import type { DataModel, Id } from "../_generated/dataModel"
import { r2 } from "../attachments"
import { type ImageSize, MODELS_SHARED } from "../lib/models"

export interface ImageGenerationResult {
    assets: {
        imageUrl: string
        imageSize: ImageSize
        mimeType: string
    }[]
    prompt: string
    modelId: string
}

export async function generateAndStoreImage({
    prompt,
    imageSize: requestedImageSize,
    imageModel,
    modelId,
    userId,
    threadId,
    actionCtx
}: {
    prompt: string
    imageSize: ImageSize
    imageModel: ImageModelV2
    modelId: string
    userId: string
    threadId: Id<"threads">
    actionCtx: GenericActionCtx<DataModel>
}): Promise<ImageGenerationResult> {
    console.log("[cvx][image_generation] Starting image generation")

    const sharedModel = MODELS_SHARED.find((m) => m.id === modelId)
    if (!sharedModel || sharedModel.mode !== "image") {
        throw new Error(`Model ${modelId} is not an image generation model`)
    }

    // Validate that the requested image size is supported by the model
    if (!sharedModel.supportedImageSizes?.includes(requestedImageSize)) {
        console.warn("[cvx][image_generation] Unsupported image size, using default")
        // Fall back to first supported size
        const fallbackSize = sharedModel.supportedImageSizes?.[0]
        if (!fallbackSize) {
            throw new Error(`Model ${modelId} has no supported image sizes configured`)
        }
        requestedImageSize = fallbackSize
    }

    const imageSize = requestedImageSize

    // Determine if this model needs resolution format (like GPT Image 1)
    const needsResolution = imageSize.includes("x")

    // For models that need aspect ratios, convert resolution format to aspect ratio
    let aspectRatio: `${number}:${number}` | undefined
    let size: `${number}x${number}` | undefined

    if (needsResolution) {
        // Use the resolution directly
        size = imageSize as `${number}x${number}`
    } else {
        // Convert to aspect ratio, handling HD variants
        const baseRatio = imageSize.replace("-hd", "")
        aspectRatio = baseRatio as `${number}:${number}`
    }

    try {
        console.log(
            `[cvx][image_generation] Generating image with model ${imageModel.provider}/${imageModel.modelId}`,
            { imageSize, aspectRatio, size }
        )

        const { images } = await experimental_generateImage({
            model: imageModel,
            prompt,
            ...(size ? { size } : { aspectRatio })
        })

        const assets: ImageGenerationResult["assets"] = []

        for (const image of images) {
            // image might not have mimeType property, default to "image/png"
            let mimeType = "image/png"
            let fileExtension = "png"
            if ("mimeType" in image && typeof image.mimeType === "string") {
                mimeType = image.mimeType
                fileExtension = mimeType.split("/")[1] || "png"
            }
            const key = `generations/${userId}/${Date.now()}-${crypto.randomUUID()}-gen.${fileExtension}`

            const storedKey = await r2.store(actionCtx, image.uint8Array, {
                authorId: userId,
                key,
                type: mimeType
            })

            console.log("[cvx][image_generation] Image stored to R2:", storedKey)

            assets.push({
                imageUrl: key,
                imageSize: requestedImageSize,
                mimeType: mimeType
            })
        }

        console.log("[cvx][image_generation] Image generation complete")

        return {
            assets,
            prompt,
            modelId
        }
    } catch (error) {
        console.error("[cvx][image_generation] Error generating image:", error)
        throw new Error(
            `Failed to generate image: ${error instanceof Error ? error.message : "Unknown error"}`
        )
    }
}
