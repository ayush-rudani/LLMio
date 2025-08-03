import Forest from "@/assets/forest.svg"
import { Button } from "@/components/ui/button"
import { useThemeStore } from "@/lib/theme-store"
import { useNavigate } from "@tanstack/react-router"
import { motion } from "framer-motion"
import { Logo } from "./logo"
import { MagneticButton } from "./magnetic-button"

export const SignupMessagePrompt = () => {
    const navigate = useNavigate()
    const { themeState } = useThemeStore()

    const handleNavigation = () => {
        navigate({ to: "/auth/$pathname", params: { pathname: "signup" }, replace: true })
    }
    const mode = themeState.currentMode

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="isolate mx-auto flex max-w-md flex-col items-center justify-center md:p-8"
        >
            <div className="z-2 mb-8 space-y-12 text-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2, duration: 0.4 }}
                >
                    <div className="mx-auto mb-4 h-16 w-16 rounded-full border dark:border-0">
                        <Logo />
                    </div>
                    <h1 className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text font-bold text-4xl text-transparent tracking-tight">
                        LLMio Chat (intern3.chat-fork)
                    </h1>
                    <p className="mt-1 font-medium text-muted-foreground text-sm italic">
                        built for interns, by interns
                    </p>
                </motion.div>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.4 }}
                className="flex w-full justify-center gap-3"
            >
                <MagneticButton>
                    <Button
                        onClick={handleNavigation}
                        className="min-w-64 font-medium transition-all hover:scale-102 active:scale-98"
                        size="lg"
                    >
                        Get Started
                    </Button>
                </MagneticButton>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 0 }}
                animate={{ opacity: mode === "dark" ? 0.2 : 0.4, y: 0 }}
                transition={{ delay: 0.6, duration: 0.4, ease: "easeOut" }}
                className="md:-top-10 pointer-events-none fixed inset-x-0 top-0 z-1 mx-auto w-full max-w-none opacity-40 md:absolute md:h-[50rem] md:w-[50rem] md:max-w-[90vw] dark:opacity-20"
                style={{
                    mask: "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 30%, rgba(0,0,0,0.4) 60%, rgba(0,0,0,0) 80%)",
                    WebkitMask:
                        "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 30%, rgba(0,0,0,0.4) 60%, rgba(0,0,0,0) 80%)"
                }}
            >
                {/* @ts-expect-error - TODO: fix this */}
                <Forest className="h-auto w-full md:h-full" />
            </motion.div>
        </motion.div>
    )
}
