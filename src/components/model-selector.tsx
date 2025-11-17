import {
    ClaudeIcon,
    DeepSeekIcon,
    GeminiIcon,
    MetaIcon,
    Moonshot,
    OpenAIIcon,
    XAIIcon
} from "@/components/brand-icons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList
} from "@/components/ui/command"
import {
    ResponsivePopover,
    ResponsivePopoverContent,
    ResponsivePopoverTrigger
} from "@/components/ui/responsive-popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { api } from "@/convex/_generated/api"
import { MODELS_SHARED, type SharedModel } from "@/convex/lib/models"
import { useSession } from "@/hooks/auth-hooks"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

import { DefaultSettings } from "@/convex/settings"
import { useDiskCachedQuery } from "@/lib/convex-cached-query"
import { type DisplayModel, useAvailableModels } from "@/lib/models-providers-shared"
import { useConvexAuth } from "@convex-dev/react-query"
import { Brain, Check, ChevronDown, Eye, Globe, Image } from "lucide-react"
import * as React from "react"
import { BlackForestLabsIcon, StabilityIcon } from "./brand-icons"
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip"

export const getProviderIcon = (model: DisplayModel, isCustom: boolean) => {
    if (isCustom) {
        return <Badge className="text-xs">Custom</Badge>
    }

    // For shared models, try to determine provider from adapters
    const sharedModel = model as SharedModel
    if (sharedModel.customIcon || sharedModel.adapters) {
        const firstAdapter = sharedModel.adapters?.[0]
        const icon = sharedModel.customIcon ?? firstAdapter?.split(":")[0]

        switch (icon) {
            case "i3-openai":
            case "openai":
                return <OpenAIIcon className="size-4" />
            case "i3-anthropic":
            case "anthropic":
                return <ClaudeIcon className="size-4" />
            case "i3-google":
            case "google":
                return <GeminiIcon className="size-4" />
            case "bflabs":
                return <BlackForestLabsIcon className="size-4" />
            case "stability-ai":
                return <StabilityIcon className="size-4" />
            case "meta":
                return <MetaIcon className="size-4" />
            case "deepseek":
                return <DeepSeekIcon className="size-4" />
            case "xai":
                return <XAIIcon className="size-4" />
            case "moonshot":
                return <Moonshot className="size-4" />
            default:
                return <Badge className="text-xs">Built-in</Badge>
        }
    }

    return <Badge className="text-xs">Built-in</Badge>
}

interface ModelItemProps {
    model: DisplayModel
    selectedModel: string
    onModelChange: (modelId: string) => void
    onClose: () => void
    isCustom?: boolean
}

const ModelItem = React.memo(function ModelItem({
    model,
    selectedModel,
    onModelChange,
    onClose,
    isCustom = false
}: ModelItemProps) {
    const abilityRenderer = (ability: string, className: string) => {
        switch (ability) {
            case "reasoning":
                return (
                    <Tooltip>
                        <TooltipTrigger>
                            <Brain className={className} />
                        </TooltipTrigger>
                        <TooltipContent>Reasoning</TooltipContent>
                    </Tooltip>
                )
            case "vision":
                return (
                    <Tooltip>
                        <TooltipTrigger>
                            <Eye className={className} />
                        </TooltipTrigger>
                        <TooltipContent>Vision</TooltipContent>
                    </Tooltip>
                )
            case "web_search":
                return (
                    <Tooltip>
                        <TooltipTrigger>
                            <Globe className={className} />
                        </TooltipTrigger>
                        <TooltipContent>Web Search</TooltipContent>
                    </Tooltip>
                )
            case "image_generation":
                return (
                    <Tooltip>
                        <TooltipTrigger>
                            <Image className={className} />
                        </TooltipTrigger>
                        <TooltipContent>Image Generation</TooltipContent>
                    </Tooltip>
                )
        }
    }

    return (
        <CommandItem
            key={model.id}
            onSelect={() => {
                onModelChange(model.id)
                onClose()
            }}
            className={cn(
                "flex items-center gap-2",
                model.id === selectedModel && "bg-accent/50 text-accent-foreground"
            )}
        >
            {getProviderIcon(model, isCustom)}
            <span className="flex items-center gap-2">
                {model.name}
                {model.id === selectedModel && <Check className="size-4" />}
            </span>
            <div className="ml-auto flex gap-2">
                {model.mode === "image" &&
                    abilityRenderer(
                        "image_generation",
                        "bg-accent text-accent-foreground p-1 rounded-md size-5"
                    )}
                {model.abilities.sort().map((ability) => (
                    <div key={ability} className="flex items-center justify-center rounded-full">
                        {abilityRenderer(
                            ability,
                            "bg-accent text-accent-foreground p-1 rounded-md size-5"
                        )}
                    </div>
                ))}
            </div>
        </CommandItem>
    )
})

export function ModelSelector({
    selectedModel,
    onModelChange,
    className
}: {
    selectedModel: string
    onModelChange: (modelId: string) => void
    className?: string
}) {
    const auth = useConvexAuth()
    const session = useSession()
    const userSettings = useDiskCachedQuery(
        api.settings.getUserSettings,
        {
            key: "user-settings",
            default: DefaultSettings(session.user?.id ?? "CACHE"),
            forceCache: true
        },
        session.user?.id && !auth.isLoading ? {} : "skip"
    )

    const { availableModels } = useAvailableModels(
        "error" in userSettings ? DefaultSettings(session.user?.id ?? "") : userSettings
    )

    const [open, setOpen] = React.useState(false)

    // Memoize expensive computations to avoid repeating them on every render
    const { selectedModelData, customModels, groupedSharedModels } = React.useMemo(() => {
        // Find the model currently selected by the user
        const selectedModelData = availableModels.find((model) => model.id === selectedModel)

        // Separate shared and custom models
        const sharedModels = availableModels.filter((model) => !("isCustom" in model))
        const customModels = availableModels.filter(
            (model) => "isCustom" in model && model.isCustom
        )

        // Group shared models by provider
        const groupedSharedModels = Object.entries(
            sharedModels.reduce<Record<string, DisplayModel[]>>((acc, model) => {
                const sharedModel = model as SharedModel
                const provider = sharedModel.adapters?.[0]?.split(":")[0] || "unknown"
                const providerKey = provider.startsWith("i3-") ? "Built-in" : provider

                if (!acc[providerKey]) {
                    acc[providerKey] = []
                }
                acc[providerKey].push(model)
                return acc
            }, {})
        )

        return { selectedModelData, customModels, groupedSharedModels }
    }, [availableModels, selectedModel])

    const isMobile = useIsMobile()

    // React.useEffect(() => {
    //     const down = (e: KeyboardEvent) => {
    //         if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
    //             e.preventDefault()
    //             setOpen((open) => !open)
    //         }
    //     }

    //     document.addEventListener("keydown", down)
    //     return () => document.removeEventListener("keydown", down)
    // }, [])

    const icon = React.useMemo(() => {
        if (!selectedModelData) return null

        const isCustom = !MODELS_SHARED.some((m) => m.id === selectedModelData.id)
        return getProviderIcon(selectedModelData, isCustom)
    }, [selectedModelData])

    return (
        <ResponsivePopover open={open} onOpenChange={setOpen}>
            <ResponsivePopoverTrigger asChild>
                <Button
                    variant="ghost"
                    aria-expanded={open}
                    className={cn(
                        "h-8 bg-secondary/70 font-normal text-xs backdrop-blur-lg sm:text-sm md:rounded-md",
                        className,
                        "!px-1.5 min-[390px]:!px-2 gap-0.5 min-[390px]:gap-2"
                    )}
                >
                    {selectedModelData && (
                        <div className="flex items-center gap-2">
                            <div className="block min-[390px]:hidden">{icon}</div>
                            <span className="hidden md:hidden min-[390px]:block">
                                {(selectedModelData as SharedModel)?.shortName ||
                                    selectedModelData?.name}
                            </span>
                            <span className="hidden md:block">{selectedModelData?.name}</span>
                        </div>
                    )}
                    <ChevronDown className="ml-auto h-4 w-4" />
                </Button>
            </ResponsivePopoverTrigger>
            <ResponsivePopoverContent
                className={cn("p-0 md:w-80")}
                align="start"
                title="Select Model"
                description="Choose a model for your conversation"
            >
                <Command>
                    {!isMobile && <CommandInput placeholder="Search models..." className="h-8" />}
                    <CommandList>
                        <CommandEmpty>No model found.</CommandEmpty>
                        <ScrollArea className="h-[300px]">
                            {groupedSharedModels.map(([providerKey, providerModels]) => (
                                <CommandGroup
                                    key={providerKey}
                                    heading={
                                        providerKey === "Built-in"
                                            ? "Built-in Models"
                                            : providerKey === "openai"
                                              ? "OpenAI"
                                              : providerKey === "anthropic"
                                                ? "Anthropic"
                                                : providerKey === "google"
                                                  ? "Google"
                                                  : providerKey === "fal"
                                                    ? "Fal.AI"
                                                    : providerKey
                                    }
                                >
                                    {providerModels.map((model) => (
                                        <ModelItem
                                            key={model.id}
                                            model={model}
                                            selectedModel={selectedModel}
                                            onModelChange={onModelChange}
                                            onClose={() => setOpen(false)}
                                            isCustom={false}
                                        />
                                    ))}
                                </CommandGroup>
                            ))}
                            {customModels.length > 0 && (
                                <CommandGroup heading="Custom Models">
                                    {customModels.map((model) => (
                                        <ModelItem
                                            key={model.id}
                                            model={model}
                                            selectedModel={selectedModel}
                                            onModelChange={onModelChange}
                                            onClose={() => setOpen(false)}
                                            isCustom={true}
                                        />
                                    ))}
                                </CommandGroup>
                            )}
                        </ScrollArea>
                    </CommandList>
                </Command>
            </ResponsivePopoverContent>
        </ResponsivePopover>
    )
}
