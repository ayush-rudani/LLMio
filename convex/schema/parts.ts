import { v } from "convex/values"

export const TextPart = v.object({
    type: v.literal("text"),
    text: v.string()
})

export const TextPartV2 = v.object({
    type: v.literal("text"),
    text: v.string(),
    state: v.optional(v.union(v.literal("streaming"), v.literal("done"))),
    providerMetadata: v.optional(v.record(v.string(), v.record(v.string(), v.any())))
})

export const ImagePart = v.object({
    type: v.literal("image"),
    image: v.string(),
    mimeType: v.string()
})

export const ImagePartV2 = v.object({
    type: v.literal("image"),
    image: v.string(),
    mediaType: v.optional(v.string())
})

export const ReasoningPart = v.object({
    type: v.literal("reasoning"),
    reasoning: v.string(),
    signature: v.optional(v.string()),
    duration: v.optional(v.number()),
    details: v.optional(
        v.array(
            v.object({
                type: v.union(v.literal("text"), v.literal("redacted")),
                text: v.optional(v.string()),
                data: v.optional(v.string()),
                signature: v.optional(v.string())
            })
        )
    )
})

export const ReasoningPartV2 = v.object({
    type: v.literal("reasoning"),
    text: v.string(),
    state: v.optional(v.union(v.literal("streaming"), v.literal("done"))),
    providerMetadata: v.optional(v.record(v.string(), v.record(v.string(), v.any())))
})

export const FilePart = v.object({
    type: v.literal("file"),
    data: v.string(),
    filename: v.optional(v.string()),
    mimeType: v.optional(v.string())
})

export const FilePartV2 = v.object({
    type: v.literal("file"),
    url: v.string(),
    filename: v.optional(v.string()),
    mediaType: v.string()
})

export const ErrorUIPart = v.object({
    type: v.literal("error"),
    error: v.object({
        code: v.string(),
        message: v.string()
    })
})

export const ErrorUIPartV2 = v.object({
    type: v.literal("error"),
    errorText: v.string()
})

export const ToolInvocationUIPart = v.object({
    type: v.literal("tool-invocation"),
    toolInvocation: v.object({
        state: v.union(v.literal("call"), v.literal("result"), v.literal("partial-call")),
        args: v.optional(v.any()),
        result: v.optional(v.any()),
        toolCallId: v.string(),
        toolName: v.string(),
        step: v.optional(v.number())
    })
})

export const ToolUIPartV2 = v.object({
    type: v.string(),
    toolCallId: v.string(),
    state: v.union(
        v.literal("input-streaming"),
        v.literal("input-available"),
        v.literal("output-available"),
        v.literal("output-error")
    ),
    input: v.optional(v.any()),
    output: v.optional(v.any()),
    errorText: v.optional(v.string()),
    providerExecuted: v.optional(v.boolean())
})

export const DynamicToolUIPartV2 = v.object({
    type: v.literal("dynamic-tool"),
    toolName: v.string(),
    toolCallId: v.string(),
    title: v.optional(v.string()),
    providerExecuted: v.optional(v.boolean()),
    state: v.union(
        v.literal("input-streaming"),
        v.literal("input-available"),
        v.literal("output-available"),
        v.literal("output-error")
    ),
    input: v.optional(v.any()),
    output: v.optional(v.any()),
    errorText: v.optional(v.string()),
    callProviderMetadata: v.optional(v.record(v.string(), v.record(v.string(), v.any()))),
    preliminary: v.optional(v.boolean())
})

export const MessagePart = v.union(
    TextPart,
    ImagePart,
    ReasoningPart,
    FilePart,
    ErrorUIPart,
    ToolInvocationUIPart
)

export const MessagePartV2 = v.union(
    TextPartV2,
    ImagePartV2,
    ReasoningPartV2,
    FilePartV2,
    ErrorUIPartV2,
    ToolUIPartV2,
    DynamicToolUIPartV2
)
