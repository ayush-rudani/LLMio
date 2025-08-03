"use client"
import { OpenAIIcon } from "@/components/brand-icons"
import { Logo } from "@/components/logo"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { useThemeManagement } from "@/hooks/use-theme-management"
import { extractThemeColors } from "@/lib/theme-utils"
import { cn } from "@/lib/utils"
import {
    ArrowLeft,
    ArrowRight,
    BarChart3,
    Bot,
    Box,
    Command,
    Edit,
    FileImage,
    FileUp,
    Folder,
    Image,
    Key,
    Mic,
    Palette,
    Paperclip,
    Play,
    Search,
    Sparkles,
    Wand2,
    Zap
} from "lucide-react"
import { CheckCircle, MoonIcon, SunIcon } from "lucide-react"
import { AnimatePresence, MotionConfig, motion } from "motion/react"
import { useCallback, useState } from "react"

interface OnboardingStep {
    id: string
    title: string
    content: React.ReactNode
    icon: React.ComponentType<{ className?: string }>
}

interface OnboardingDialogProps {
    isOpen: boolean
    onComplete: () => void
}

const ONBOARDING_STEPS: OnboardingStep[] = [
    {
        id: "welcome",
        title: "Welcome to LLMio Chat",
        icon: Sparkles,
        content: (
            <div className="flex flex-col items-center space-y-4 text-center">
                <div className="mx-auto h-24 w-24 rounded-full border-2 border-primary/20">
                    <Logo />
                </div>
                <div className="text-center">
                    <h3 className="font-bold text-2xl text-foreground">Welcome to LLMio Chat</h3>
                    <span className="text-muted-foreground text-sm">
                        The best open-source chatbot. Made by interns, for interns.
                    </span>
                </div>
            </div>
        )
    },
    {
        id: "themes",
        title: "Beautiful Themes",
        icon: Palette,
        content: (
            <div className="flex w-full flex-col items-center space-y-4">
                <ThemeSelector />
                <div className="space-y-2 text-left">
                    <p className="text-muted-foreground text-xs leading-relaxed">
                        LLMio Chat has a built-in theme switcher. Try some of the popular ones
                        above! You can always change this later in settings.
                    </p>
                </div>
            </div>
        )
    },
    {
        id: "byok",
        title: "Bring Your Own Keys (BYOK)",
        icon: Key,
        content: (
            <div className="-mb-12 space-y-6">
                <div className="relative flex flex-col gap-2">
                    <Card className="p-4 shadow-none">
                        <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                                <div className="flex size-8 items-center justify-center rounded-lg">
                                    <Logo />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-sm">LLMio Chat Built-in</h4>
                                    <p className="mt-0.5 text-muted-foreground text-xs">
                                        Access built-in AI models without needing API keys. Rate
                                        limits may apply.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </Card>
                    <Card className="p-4 shadow-none">
                        <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                                <div className="flex size-8 items-center justify-center rounded-lg">
                                    <OpenAIIcon className="size-6" />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-sm">OpenAI</h4>
                                    <p className="mt-0.5 text-muted-foreground text-xs">
                                        Access GPT-4, GPT-4o, o3, and other OpenAI models
                                    </p>
                                </div>
                            </div>
                        </div>
                    </Card>

                    <div className="absolute inset-0 h-full w-full bg-gradient-to-b from-transparent via-popover/80 to-popover" />
                </div>
                <div className="-translate-y-10 space-y-3">
                    <h3 className="font-semibold text-xl tracking-tight">
                        Your Keys, Your Control
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                        Use for free with basic built-in models, or connect your own API keys to use
                        any model you want. LLMio Chat works with all leading models (OpenAI,
                        Gemini, Claude, etc.), and even custom OpenAI-compatible providers.
                    </p>
                </div>
            </div>
        )
    },
    {
        id: "search",
        title: "Web Search & Research",
        icon: Search,
        content: (
            <div className="space-y-6">
                <Card className="p-4 shadow-none">
                    <div className="flex items-start space-x-3">
                        <Search className="mt-0.5 h-5 w-5 text-primary" />
                        <div className="space-y-2">
                            <div className="font-medium text-sm">
                                "Is flutter the best mobile app framework?"
                            </div>
                            <div className="flex flex-wrap gap-1">
                                <Badge variant="secondary" className="text-xs">
                                    Brave Search
                                </Badge>
                                <Badge variant="secondary" className="text-xs">
                                    Firecrawl
                                </Badge>
                                <Badge variant="secondary" className="text-xs">
                                    Tavily
                                </Badge>
                                <Badge variant="secondary" className="text-xs">
                                    Serper
                                </Badge>
                            </div>
                        </div>
                    </div>
                </Card>
                <div className="space-y-3">
                    <h3 className="font-semibold text-xl tracking-tight">Real-time Web Search</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                        Access up-to-date information from the web. Choose from multiple search
                        providers and get comprehensive answers backed by real sources. Works with
                        nearly any model!
                    </p>
                </div>
            </div>
        )
    },
    {
        id: "integrations",
        title: "Powerful Integrations",
        icon: Zap,
        content: (
            <div className="space-y-6">
                <div className="grid grid-cols-1 gap-2">
                    <Card className="p-4 shadow-none">
                        <div className="flex items-start space-x-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                                <Zap className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1 space-y-1">
                                <div className="font-medium text-sm">MCP Tools</div>
                                <div className="text-muted-foreground text-xs leading-relaxed">
                                    Connect external tools via Model Context Protocol over HTTP/MCP
                                </div>
                            </div>
                        </div>
                    </Card>
                    <Card className="p-4 shadow-none">
                        <div className="flex items-start space-x-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                                <Bot className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1 space-y-1">
                                <div className="font-medium text-sm">Supermemory AI Memory</div>
                                <div className="text-muted-foreground text-xs leading-relaxed">
                                    Add persistent memory across conversations (BYOK)
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
                <div className="space-y-3">
                    <h3 className="font-semibold text-xl tracking-tight">Powerful Integrations</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                        LLMio comes built-in with powerful connectors to enhance your AI experience.
                    </p>
                </div>
            </div>
        )
    },
    {
        id: "features",
        title: "More Amazing Features",
        icon: Wand2,
        content: (
            <div className="space-y-6">
                <div className="flex flex-wrap gap-1.5">
                    {[
                        { icon: Image, label: "Image generation" },
                        { icon: Folder, label: "Chat folders" },
                        { icon: Command, label: "Keyboard shortcuts" },
                        { icon: Paperclip, label: "Attachments management" },
                        { icon: Play, label: "Resumable streams" },
                        { icon: Edit, label: "Edit/Regenerate messages" },
                        { icon: FileImage, label: "AI image library" },
                        { icon: BarChart3, label: "Model usage dashboard" },
                        { icon: FileUp, label: "Upload image/text/PDF files" },
                        { icon: Box, label: "HTML/Mermaid rendering" },
                        { icon: Mic, label: "Voice input" }
                    ].map(({ icon: Icon, label }) => (
                        <div
                            key={label}
                            className="flex items-center space-x-2 rounded-lg border border-border/50 bg-muted/10 px-3 py-2"
                        >
                            <Icon className="h-4 w-4 text-primary" />
                            <span className="font-medium text-sm">{label}</span>
                        </div>
                    ))}
                </div>
                <div className="space-y-3">
                    <h3 className="font-semibold text-xl tracking-tight">Feature packed</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                        Our intern couldn't fit our tremendous feature list into actual slides, so
                        here's a list instead.
                    </p>
                </div>
            </div>
        )
    },
    {
        id: "ready",
        title: "Ready to Get Started?",
        icon: Sparkles,
        content: (
            <div className="flex w-full flex-col items-start space-y-4 text-left">
                <Sparkles className="size-10 text-primary" />
                <div className="w-full space-y-1">
                    <h3 className="font-bold text-2xl text-foreground tracking-tight">
                        You're all set!
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                        Start chatting with AI and make LLMio truly yours! Don't forget to checkout
                        the Settings page to customize your experience.
                    </p>
                </div>
            </div>
        )
    }
]

function ThemeSelector() {
    const { themeState, filteredThemes, handleThemeSelect, toggleMode, selectedThemeUrl } =
        useThemeManagement()

    const popularThemes = filteredThemes.filter((theme) => theme.type === "built-in").slice(0, 6)

    return (
        <div className="w-full max-w-md space-y-4">
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-base tracking-tight">Themes</h4>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={toggleMode}
                        className="flex h-8 items-center justify-center gap-2 px-3"
                    >
                        <div className="relative flex h-3 w-3 items-center justify-center">
                            <SunIcon className="dark:-rotate-90 absolute h-3 w-3 transition-all duration-300 dark:scale-0" />
                            <MoonIcon className="absolute h-3 w-3 rotate-90 scale-0 transition-all duration-300 dark:rotate-0 dark:scale-100" />
                        </div>
                        <span className="text-xs">
                            {themeState.currentMode === "light" ? "Light" : "Dark"}
                        </span>
                    </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    {popularThemes.map((theme) => {
                        const colors =
                            "error" in theme && theme.error
                                ? []
                                : "preset" in theme
                                  ? extractThemeColors(theme.preset, themeState.currentMode)
                                  : []
                        const isSelected = selectedThemeUrl === theme.url

                        return (
                            <button
                                type="button"
                                key={theme.url}
                                onClick={() => handleThemeSelect(theme)}
                                className={cn(
                                    "relative overflow-hidden rounded-lg border p-2 text-left transition-all hover:scale-[1.02]",
                                    isSelected
                                        ? "border-primary ring-2 ring-primary/20"
                                        : "border-border hover:border-primary/50"
                                )}
                            >
                                <div className="mb-1 flex items-center justify-between">
                                    <span className="truncate font-medium text-xs">
                                        {theme.name}
                                    </span>
                                    {isSelected && (
                                        <CheckCircle className="h-3 w-3 flex-shrink-0 text-primary" />
                                    )}
                                </div>
                                {colors.length > 0 && (
                                    <div className="flex h-1.5 overflow-hidden rounded">
                                        {colors.slice(0, 4).map((color, index) => (
                                            <div
                                                key={index}
                                                className="flex-1"
                                                style={{ backgroundColor: color }}
                                            />
                                        ))}
                                    </div>
                                )}
                            </button>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

export function OnboardingDialog({ isOpen, onComplete }: OnboardingDialogProps) {
    const [currentStep, setCurrentStep] = useState(0)
    const currentStepData = ONBOARDING_STEPS[currentStep]

    const handleNext = useCallback(() => {
        if (currentStep < ONBOARDING_STEPS.length - 1) {
            setCurrentStep(currentStep + 1)
        } else {
            onComplete()
        }
    }, [currentStep, onComplete])

    const handlePrevious = useCallback(() => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1)
        }
    }, [currentStep])

    return (
        <Dialog open={isOpen} onOpenChange={() => {}}>
            <DialogContent
                className="w-[95vw] max-w-2xl border-0 bg-transparent p-0 shadow-none sm:w-full"
                showCloseButton={false}
            >
                <MotionConfig
                    transition={{
                        type: "spring",
                        duration: 0.4,
                        bounce: 0.1
                    }}
                >
                    <Card className="inset-shadow-sm w-full max-w-none overflow-hidden border-2 bg-card pt-3 pb-5">
                        <div className="relative overflow-hidden">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={currentStep}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                >
                                    <CardContent className="flex flex-col items-center px-4 py-4 sm:px-6">
                                        <div className="flex w-full max-w-lg justify-center">
                                            {currentStepData.content}
                                        </div>
                                    </CardContent>
                                </motion.div>
                            </AnimatePresence>
                        </div>

                        <CardFooter className="relative flex items-center justify-between border-t-2 px-4 pt-4 sm:px-6">
                            {currentStep > 0 ? (
                                <Button
                                    variant="secondary"
                                    onClick={handlePrevious}
                                    disabled={currentStep === 0}
                                    className="h-8 gap-2 px-3 text-xs sm:h-10 sm:px-4 sm:text-sm"
                                >
                                    <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4" />
                                    <span className="hidden sm:inline">Previous</span>
                                    <span className="sm:hidden">Prev</span>
                                </Button>
                            ) : (
                                <div className="w-8" />
                            )}

                            <div className="absolute right-[50%] flex translate-x-1/2 gap-1">
                                {ONBOARDING_STEPS.map((_, index) => (
                                    <div
                                        key={index}
                                        className={`h-2 w-2 rounded-full transition-all duration-300 ${
                                            index === currentStep
                                                ? "w-6 bg-primary"
                                                : index < currentStep
                                                  ? "bg-primary/60"
                                                  : "bg-muted-foreground/20"
                                        }`}
                                    />
                                ))}
                            </div>

                            <Button
                                onClick={handleNext}
                                className="h-8 gap-2 px-3 text-xs sm:h-10 sm:px-4 sm:text-sm"
                            >
                                {currentStep === ONBOARDING_STEPS.length - 1 ? (
                                    <>
                                        <span className="hidden sm:inline">Get Started</span>
                                        <span className="sm:hidden">Start</span>
                                        <Sparkles className="h-3 w-3 sm:h-4 sm:w-4" />
                                    </>
                                ) : (
                                    <>
                                        <span className="hidden sm:inline">Next</span>
                                        <span className="sm:hidden">Next</span>
                                        <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
                                    </>
                                )}
                            </Button>
                        </CardFooter>
                    </Card>
                </MotionConfig>
            </DialogContent>
        </Dialog>
    )
}
