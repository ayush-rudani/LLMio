import { SettingsLayout } from "@/components/settings/settings-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/convex/_generated/api"
import { useSession } from "@/hooks/auth-hooks"
import { useConvexMutation, useConvexQuery } from "@convex-dev/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Loader2, Save } from "lucide-react"
import { useRef, useState } from "react"
import { toast } from "sonner"

export const Route = createFileRoute("/settings/customization")({
    component: CustomizationSettings
})

function CustomizationSettings() {
    const session = useSession()
    const userSettings = useConvexQuery(
        api.settings.getUserSettings,
        session.user?.id ? {} : "skip"
    )
    const updateSettings = useConvexMutation(api.settings.updateUserSettingsPartial)

    const [isSaving, setIsSaving] = useState(false)

    const nameRef = useRef<HTMLInputElement>(null)
    const personalityRef = useRef<HTMLTextAreaElement>(null)
    const contextRef = useRef<HTMLTextAreaElement>(null)

    const handleSave = async () => {
        if (!session.user?.id) return

        setIsSaving(true)
        try {
            await updateSettings({
                customization: {
                    name: nameRef.current?.value || undefined,
                    aiPersonality: personalityRef.current?.value || undefined,
                    additionalContext: contextRef.current?.value || undefined
                }
            })
            toast.success("Customization settings saved")
        } catch (error) {
            console.error("Failed to save customization:", error)
            toast.error("Failed to save customization settings")
        } finally {
            setIsSaving(false)
        }
    }

    if (!session.user?.id) {
        return (
            <SettingsLayout
                title="Customization"
                description="Personalize how the AI interacts with you"
            >
                <p className="text-muted-foreground text-sm">
                    Sign in to customize your AI experience.
                </p>
            </SettingsLayout>
        )
    }

    if (!userSettings) {
        return (
            <SettingsLayout
                title="Customization"
                description="Personalize how the AI interacts with you"
            >
                <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            </SettingsLayout>
        )
    }

    // Handle error response from getUserSettings
    if ("error" in userSettings) {
        return (
            <SettingsLayout
                title="Customization"
                description="Personalize how the AI interacts with you"
            >
                <p className="text-muted-foreground text-sm">Failed to load settings.</p>
            </SettingsLayout>
        )
    }

    return (
        <SettingsLayout
            title="Customization"
            description="Personalize how the AI interacts with you"
        >
            <div className="space-y-8">
                <div className="space-y-4">
                    <div>
                        <h3 className="font-semibold text-foreground">AI Personalization</h3>
                        <p className="mt-1 text-muted-foreground text-sm">
                            Customize how the AI addresses you and behaves in conversations
                        </p>
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="name">Your Name</Label>
                            <Input
                                id="name"
                                ref={nameRef}
                                defaultValue={userSettings?.customization?.name || ""}
                                placeholder="How should the AI address you?"
                                maxLength={100}
                            />
                            <p className="text-muted-foreground text-xs">
                                This helps the AI address you personally in conversations.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="personality">AI Personality</Label>
                            <Textarea
                                id="personality"
                                ref={personalityRef}
                                defaultValue={userSettings?.customization?.aiPersonality || ""}
                                placeholder="Describe how you want the AI to behave and communicate..."
                                rows={4}
                                maxLength={2000}
                            />
                            <p className="text-muted-foreground text-xs">
                                Shape the AI's communication style and personality.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="context">Additional Context</Label>
                            <Textarea
                                id="context"
                                ref={contextRef}
                                defaultValue={userSettings?.customization?.additionalContext || ""}
                                placeholder="Share relevant information about yourself, your work, or preferences..."
                                rows={4}
                                maxLength={2000}
                            />
                            <p className="text-muted-foreground text-xs">
                                Provide context that helps the AI give you more relevant responses.
                            </p>
                        </div>

                        <div className="flex justify-end pt-4">
                            <Button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="min-w-[100px]"
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save className="h-4 w-4" />
                                        Save Changes
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </SettingsLayout>
    )
}
