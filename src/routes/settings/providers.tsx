import { BYOKSearchProviderCard } from "@/components/settings/search-provider-card"
import { SettingsLayout } from "@/components/settings/settings-layout"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { api } from "@/convex/_generated/api"
import { useSession } from "@/hooks/auth-hooks"
import {
    CORE_PROVIDERS,
    type CoreProviderInfo,
    SEARCH_PROVIDERS,
    useAvailableModels
} from "@/lib/models-providers-shared"
import Logo from "@/logo.svg"
import { useConvexQuery } from "@convex-dev/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useMutation } from "convex/react"
import {
    AlertCircle,
    Bot,
    Check,
    Globe,
    Key,
    PackageIcon,
    Plus,
    RotateCcw,
    Settings2,
    SquarePen,
    Trash2,
    X
} from "lucide-react"
import { memo, useState } from "react"
import { toast } from "sonner"

export const Route = createFileRoute("/settings/providers")({
    component: ProvidersSettings
})

type ProviderCardProps = {
    provider: CoreProviderInfo
    currentProvider?: { enabled: boolean; encryptedKey: string }
    onSave: (providerId: string, enabled: boolean, newKey?: string) => Promise<void>
    loading: boolean
}

const ProviderCard = memo(({ provider, currentProvider, onSave, loading }: ProviderCardProps) => {
    const [isEditing, setIsEditing] = useState(false)
    const [enabled, setEnabled] = useState(currentProvider?.enabled || false)
    const [newKey, setNewKey] = useState("")
    const [rotatingKey, setRotatingKey] = useState(false)

    const hasExistingKey = Boolean(currentProvider?.encryptedKey)
    const canSave = enabled ? (hasExistingKey && !rotatingKey) || newKey.trim() : true

    const handleSave = async () => {
        try {
            await onSave(provider.id, enabled, rotatingKey || !hasExistingKey ? newKey : undefined)
            setIsEditing(false)
            setNewKey("")
            setRotatingKey(false)
        } catch (error) {
            // Error handled in parent
        }
    }

    const handleCancel = () => {
        setIsEditing(false)
        setEnabled(currentProvider?.enabled || false)
        setNewKey("")
        setRotatingKey(false)
    }

    const Icon = provider.icon
    const isEnabled = currentProvider?.enabled || false

    return (
        <Card className="p-4 shadow-xs">
            <div className="flex items-start gap-2 space-y-4">
                <div className="flex size-8 items-center justify-center rounded-lg">
                    <Icon className="size-5" />
                </div>
                <div className="flex-1">
                    <div className="mb-4 flex items-start justify-between">
                        <div className="flex items-start gap-2">
                            <div>
                                <h4 className="font-semibold text-sm">{provider.name}</h4>
                                <p className="mt-0.5 text-muted-foreground text-xs">
                                    {provider.description}
                                </p>
                            </div>
                        </div>

                        {isEnabled && (
                            <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-green-500" />
                                <span className="text-muted-foreground text-xs">Active</span>
                            </div>
                        )}
                    </div>

                    {isEditing ? (
                        <div className="space-y-4">
                            <div className="flex items-center space-x-2">
                                <Switch
                                    id={`${provider.id}-enabled`}
                                    checked={enabled}
                                    onCheckedChange={setEnabled}
                                />
                                <Label htmlFor={`${provider.id}-enabled`}>
                                    Enable {provider.name}
                                </Label>
                            </div>

                            {enabled && (
                                <div className="space-y-3">
                                    {hasExistingKey && (
                                        <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                                            <div className="flex items-center gap-2">
                                                <Key className="h-4 w-4 text-green-600" />
                                                <span className="text-sm">API key configured</span>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setRotatingKey(!rotatingKey)}
                                            >
                                                <RotateCcw className="h-4 w-4" />
                                                {rotatingKey ? "Keep existing" : "Rotate key"}
                                            </Button>
                                        </div>
                                    )}

                                    {(!hasExistingKey || rotatingKey) && (
                                        <div className="space-y-2">
                                            <Label htmlFor={`${provider.id}-key`}>
                                                {rotatingKey ? "New API Key" : "API Key"}
                                            </Label>
                                            <Input
                                                id={`${provider.id}-key`}
                                                type="password"
                                                value={newKey}
                                                onChange={(e) => setNewKey(e.target.value)}
                                                placeholder={provider.placeholder}
                                                className="font-mono"
                                            />
                                            {rotatingKey && (
                                                <p className="text-muted-foreground text-xs">
                                                    Leave empty to keep existing key
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {enabled && !hasExistingKey && !newKey.trim() && (
                                        <div className="flex items-center gap-2 text-amber-600">
                                            <AlertCircle className="h-4 w-4" />
                                            <span className="text-sm">
                                                API key required to enable provider
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex gap-2">
                                <Button
                                    onClick={handleSave}
                                    disabled={loading || !canSave}
                                    size="sm"
                                >
                                    <Check className="h-4 w-4" />
                                    {loading ? "Saving..." : "Save"}
                                </Button>
                                <Button variant="ghost" size="sm" onClick={handleCancel}>
                                    <X className="h-4 w-4" />
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                            {isEnabled ? (
                                <SquarePen className="size-4" />
                            ) : (
                                <Settings2 className="size-4" />
                            )}
                            {isEnabled ? "Edit" : "Setup BYOK"}
                        </Button>
                    )}
                </div>
            </div>
        </Card>
    )
})

type CustomProviderCardProps = {
    providerId: string
    provider: { name: string; enabled: boolean; endpoint: string; encryptedKey: string }
    onSave: (
        providerId: string,
        data: { name: string; enabled: boolean; endpoint: string; newKey?: string }
    ) => Promise<void>
    onDelete: (providerId: string) => Promise<void>
    loading: boolean
}

const CustomProviderCard = memo(
    ({ providerId, provider, onSave, onDelete, loading }: CustomProviderCardProps) => {
        const [isEditing, setIsEditing] = useState(false)
        const [formData, setFormData] = useState({
            name: provider.name,
            enabled: provider.enabled,
            endpoint: provider.endpoint,
            newKey: ""
        })
        const [rotatingKey, setRotatingKey] = useState(false)

        const hasExistingKey = Boolean(provider.encryptedKey)
        const canSave = formData.enabled
            ? (hasExistingKey && !rotatingKey) || formData.newKey.trim()
            : true

        const handleSave = async () => {
            try {
                await onSave(providerId, {
                    name: formData.name,
                    enabled: formData.enabled,
                    endpoint: formData.endpoint,
                    newKey: rotatingKey || !hasExistingKey ? formData.newKey : undefined
                })
                setIsEditing(false)
                setFormData((prev) => ({ ...prev, newKey: "" }))
                setRotatingKey(false)
            } catch (error) {
                // Error handled in parent
            }
        }

        const handleCancel = () => {
            setIsEditing(false)
            setFormData({
                name: provider.name,
                enabled: provider.enabled,
                endpoint: provider.endpoint,
                newKey: ""
            })
            setRotatingKey(false)
        }

        return (
            <Card className="p-4 shadow-xs">
                <div className="flex items-start gap-2 space-y-4">
                    <div className="flex size-8 items-center justify-center rounded-lg">
                        <Bot className="size-5" />
                    </div>
                    <div className="flex-1">
                        <div className="mb-4 flex items-start justify-between">
                            <div>
                                <div>
                                    <h4 className="font-semibold text-sm">{provider.name}</h4>
                                    <p className="mt-0.5 text-muted-foreground text-xs">
                                        Custom OpenAI-compatible provider
                                    </p>
                                    <p className="mt-0.5 font-mono text-muted-foreground text-xs">
                                        {provider.endpoint}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {provider.enabled && (
                                    <>
                                        <div className="h-2 w-2 rounded-full bg-green-500" />
                                        <span className="text-muted-foreground text-xs">
                                            Active
                                        </span>
                                    </>
                                )}
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>
                                                Delete Custom Provider
                                            </AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Are you sure you want to delete "{provider.name}"?
                                                This action cannot be undone and will affect any
                                                custom models using this provider.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={() => onDelete(providerId)}
                                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                            >
                                                Delete
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </div>

                        {isEditing ? (
                            <div className="space-y-4">
                                <div className="flex items-center space-x-2">
                                    <Switch
                                        id={`${providerId}-enabled`}
                                        checked={formData.enabled}
                                        onCheckedChange={(checked) =>
                                            setFormData((prev) => ({ ...prev, enabled: checked }))
                                        }
                                    />
                                    <Label htmlFor={`${providerId}-enabled`}>
                                        Enable {provider.name}
                                    </Label>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor={`${providerId}-name`}>Provider Name</Label>
                                        <Input
                                            id={`${providerId}-name`}
                                            value={formData.name}
                                            onChange={(e) =>
                                                setFormData((prev) => ({
                                                    ...prev,
                                                    name: e.target.value
                                                }))
                                            }
                                            placeholder="My Custom Provider"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor={`${providerId}-endpoint`}>Base URL</Label>
                                        <Input
                                            id={`${providerId}-endpoint`}
                                            value={formData.endpoint}
                                            onChange={(e) =>
                                                setFormData((prev) => ({
                                                    ...prev,
                                                    endpoint: e.target.value
                                                }))
                                            }
                                            placeholder="https://api.example.com/v1"
                                        />
                                    </div>
                                </div>

                                {formData.enabled && (
                                    <div className="space-y-3">
                                        {hasExistingKey && (
                                            <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                                                <div className="flex items-center gap-2">
                                                    <Key className="h-4 w-4 text-green-600" />
                                                    <span className="text-sm">
                                                        API key configured
                                                    </span>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setRotatingKey(!rotatingKey)}
                                                >
                                                    <RotateCcw className="h-4 w-4" />
                                                    {rotatingKey ? "Keep existing" : "Rotate key"}
                                                </Button>
                                            </div>
                                        )}

                                        {(!hasExistingKey || rotatingKey) && (
                                            <div className="space-y-2">
                                                <Label htmlFor={`${providerId}-key`}>
                                                    {rotatingKey ? "New API Key" : "API Key"}
                                                </Label>
                                                <Input
                                                    id={`${providerId}-key`}
                                                    type="password"
                                                    value={formData.newKey}
                                                    onChange={(e) =>
                                                        setFormData((prev) => ({
                                                            ...prev,
                                                            newKey: e.target.value
                                                        }))
                                                    }
                                                    placeholder="sk-..."
                                                    className="font-mono"
                                                />
                                                {rotatingKey && (
                                                    <p className="text-muted-foreground text-xs">
                                                        Leave empty to keep existing key
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        {formData.enabled &&
                                            !hasExistingKey &&
                                            !formData.newKey.trim() && (
                                                <div className="flex items-center gap-2 text-amber-600">
                                                    <AlertCircle className="h-4 w-4" />
                                                    <span className="text-sm">
                                                        API key required to enable provider
                                                    </span>
                                                </div>
                                            )}
                                    </div>
                                )}

                                <div className="flex gap-2">
                                    <Button
                                        onClick={handleSave}
                                        disabled={
                                            loading ||
                                            !canSave ||
                                            !formData.name.trim() ||
                                            !formData.endpoint.trim()
                                        }
                                        size="sm"
                                    >
                                        <Check className="h-4 w-4" />
                                        {loading ? "Saving..." : "Save"}
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={handleCancel}>
                                        <X className="h-4 w-4" />
                                        Cancel
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                                <SquarePen className="h-4 w-4" />
                                {provider.enabled ? "Edit" : "Configure"}
                            </Button>
                        )}
                    </div>
                </div>
            </Card>
        )
    }
)

function ProvidersSettings() {
    const session = useSession()
    const userSettings = useConvexQuery(
        api.settings.getUserSettings,
        session.user?.id ? {} : "skip"
    )
    const updateSettings = useMutation(api.settings.updateUserSettingsPartial)

    const [loading, setLoading] = useState(false)
    const [addingCustomProvider, setAddingCustomProvider] = useState(false)
    const [customProviderForm, setCustomProviderForm] = useState({
        name: "",
        endpoint: "",
        enabled: true,
        key: ""
    })

    // Only call useAvailableModels if userSettings is valid
    const { currentProviders } = useAvailableModels(
        userSettings && !("error" in userSettings) ? userSettings : undefined
    )

    // Helper function to get current search provider state
    const getCurrentSearchProviders = () => {
        if (!userSettings || "error" in userSettings) return {}
        return userSettings.generalProviders || {}
    }

    const handleSaveSearchProvider = async (
        providerId: string,
        config: { enabled: boolean; newKey?: string } & Record<string, any>
    ) => {
        if (!session.user?.id) return
        if (providerId === "fal") {
            return handleSaveProvider(providerId, config.enabled, config.newKey)
        }
        setLoading(true)
        try {
            await updateSettings({
                generalProviderUpdates: {
                    [providerId]: config
                }
            })
            toast.success(`${SEARCH_PROVIDERS.find((p) => p.id === providerId)?.name} BYOK updated`)
        } catch (error) {
            toast.error("Failed to save search provider settings")
            console.error(error)
            throw error
        } finally {
            setLoading(false)
        }
    }

    const handleSaveProvider = async (providerId: string, enabled: boolean, newKey?: string) => {
        if (!session.user?.id) return

        setLoading(true)
        try {
            await updateSettings({
                coreProviderUpdates: {
                    [providerId]: { enabled, newKey }
                }
            })
            toast.success(
                `${CORE_PROVIDERS.find((p) => p.id === providerId)?.name} provider updated`
            )
        } catch (error) {
            toast.error("Failed to save provider settings")
            console.error(error)
            throw error
        } finally {
            setLoading(false)
        }
    }

    const handleSaveCustomProvider = async (
        providerId: string,
        data: { name: string; enabled: boolean; endpoint: string; newKey?: string }
    ) => {
        if (!session.user?.id) return

        setLoading(true)
        try {
            await updateSettings({
                customProviderUpdates: {
                    [providerId]: data
                }
            })
            toast.success("Custom provider updated")
        } catch (error) {
            toast.error("Failed to save custom provider")
            console.error(error)
            throw error
        } finally {
            setLoading(false)
        }
    }

    const handleAddCustomProvider = async () => {
        if (!session.user?.id) return

        setLoading(true)
        try {
            const providerId = `custom-${Date.now()}`
            await updateSettings({
                customProviderUpdates: {
                    [providerId]: {
                        name: customProviderForm.name,
                        enabled: customProviderForm.enabled,
                        endpoint: customProviderForm.endpoint,
                        newKey: customProviderForm.key
                    }
                }
            })

            toast.success("Custom provider added")
            setAddingCustomProvider(false)
            setCustomProviderForm({
                name: "",
                endpoint: "",
                enabled: true,
                key: ""
            })
        } catch (error) {
            toast.error("Failed to add custom provider")
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteCustomProvider = async (providerId: string) => {
        if (!session.user?.id) return

        setLoading(true)
        try {
            await updateSettings({
                customProviderUpdates: {
                    [providerId]: null
                }
            })
            toast.success("Custom provider deleted")
        } catch (error) {
            toast.error("Failed to delete custom provider")
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    if (!session.user?.id) {
        return (
            <SettingsLayout
                title="Providers"
                description="Manage your AI provider API keys and configure custom providers."
            >
                <p className="text-muted-foreground text-sm">Sign in to manage your providers.</p>
            </SettingsLayout>
        )
    }

    if (!userSettings || "error" in userSettings) {
        return (
            <SettingsLayout
                title="Providers"
                description="Manage your AI provider API keys and configure custom providers."
            >
                <p className="text-muted-foreground text-sm">Loading provider settings...</p>
            </SettingsLayout>
        )
    }

    const currentSearchProviders = getCurrentSearchProviders()

    return (
        <SettingsLayout
            title="Providers"
            description="Manage your AI and search provider API keys. Keys are encrypted and stored securely."
        >
            <div className="space-y-6">
                <div className="space-y-1.5">
                    <div className="space-y-0.25">
                        <h3 className="font-semibold text-base">Built-in Providers</h3>
                        <p className="text-muted-foreground text-xs">
                            Access built-in services without needing API keys
                        </p>
                    </div>

                    {/* Built-in AI Provider */}
                    <Card className="p-4 shadow-xs">
                        <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                                <div className="flex size-8 items-center justify-center rounded-lg">
                                    <Logo />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-sm">LLMio Built-in</h4>
                                    <p className="mt-0.5 text-muted-foreground text-xs">
                                        Access built-in AI models without needing API keys. Rate
                                        limits may apply.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-green-500" />
                                <span className="text-muted-foreground text-xs">Active</span>
                            </div>
                        </div>
                    </Card>

                    {/* Built-in Web Search Provider */}
                    <Card className="p-4 shadow-xs">
                        <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                                <div className="flex size-8 items-center justify-center rounded-lg">
                                    <Globe className="size-5" />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-sm">Web Search</h4>
                                    <p className="mt-0.5 text-muted-foreground text-xs">
                                        4 search providers available from server
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-green-500" />
                                <span className="text-muted-foreground text-xs">Active</span>
                            </div>
                        </div>
                    </Card>
                </div>

                <div className="space-y-1.5">
                    <div className="space-y-0.25">
                        <h3 className="font-semibold text-base">BYOK AI Providers</h3>
                        <p className="text-muted-foreground text-xs">
                            Bring your own API keys for enhanced AI capabilities
                        </p>
                    </div>

                    {CORE_PROVIDERS.map((provider) => (
                        <ProviderCard
                            key={provider.id}
                            provider={provider}
                            currentProvider={currentProviders.core[provider.id]}
                            onSave={handleSaveProvider}
                            loading={loading}
                        />
                    ))}
                </div>

                <div className="space-y-1.5">
                    <div className="space-y-0.25">
                        <h3 className="font-semibold text-base">BYOK Search Providers</h3>
                        <p className="text-muted-foreground text-xs">
                            Your keys take priority over server keys when available
                        </p>
                    </div>

                    {SEARCH_PROVIDERS.map((provider) => (
                        <BYOKSearchProviderCard
                            key={provider.id}
                            provider={provider}
                            currentConfig={currentSearchProviders[provider.id]}
                            onSave={handleSaveSearchProvider}
                            loading={loading}
                        />
                    ))}
                </div>

                <div className="space-y-1.5">
                    <div className="space-y-0.25">
                        <h3 className="font-semibold text-base">Custom Providers</h3>
                        <p className="text-muted-foreground text-xs">
                            Add any OpenAI-compatible provider
                        </p>
                    </div>

                    {/* Custom Providers */}
                    {Object.entries(currentProviders.custom).map(([id, provider]) => (
                        <CustomProviderCard
                            key={id}
                            providerId={id}
                            provider={provider}
                            onSave={handleSaveCustomProvider}
                            onDelete={handleDeleteCustomProvider}
                            loading={loading}
                        />
                    ))}

                    {/* Add Custom Provider */}
                    {addingCustomProvider ? (
                        <Card className="p-4 shadow-xs">
                            <div className="space-y-4">
                                <h4 className="font-semibold text-sm">Add Custom Provider</h4>

                                <div className="space-y-4">
                                    <div className="flex items-center space-x-2">
                                        <Switch
                                            id="custom-provider-enabled"
                                            checked={customProviderForm.enabled}
                                            onCheckedChange={(checked) =>
                                                setCustomProviderForm((prev) => ({
                                                    ...prev,
                                                    enabled: checked
                                                }))
                                            }
                                        />
                                        <Label htmlFor="custom-provider-enabled">
                                            Enable Provider
                                        </Label>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="custom-provider-name">
                                                Provider Name
                                            </Label>
                                            <Input
                                                id="custom-provider-name"
                                                value={customProviderForm.name}
                                                onChange={(e) =>
                                                    setCustomProviderForm((prev) => ({
                                                        ...prev,
                                                        name: e.target.value
                                                    }))
                                                }
                                                placeholder="My Custom Provider"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="custom-provider-endpoint">
                                                Base URL
                                            </Label>
                                            <Input
                                                id="custom-provider-endpoint"
                                                value={customProviderForm.endpoint}
                                                onChange={(e) =>
                                                    setCustomProviderForm((prev) => ({
                                                        ...prev,
                                                        endpoint: e.target.value
                                                    }))
                                                }
                                                placeholder="https://api.example.com/v1"
                                            />
                                        </div>
                                    </div>

                                    {customProviderForm.enabled && (
                                        <div className="space-y-2">
                                            <Label htmlFor="custom-provider-key">API Key</Label>
                                            <Input
                                                id="custom-provider-key"
                                                type="password"
                                                value={customProviderForm.key}
                                                onChange={(e) =>
                                                    setCustomProviderForm((prev) => ({
                                                        ...prev,
                                                        key: e.target.value
                                                    }))
                                                }
                                                placeholder="sk-..."
                                                className="font-mono"
                                            />
                                            {customProviderForm.enabled &&
                                                !customProviderForm.key.trim() && (
                                                    <div className="flex items-center gap-2 text-amber-600">
                                                        <AlertCircle className="h-4 w-4" />
                                                        <span className="text-xs">
                                                            API key required to enable provider
                                                        </span>
                                                    </div>
                                                )}
                                        </div>
                                    )}

                                    <div className="flex gap-2">
                                        <Button
                                            onClick={handleAddCustomProvider}
                                            disabled={
                                                loading ||
                                                !customProviderForm.name.trim() ||
                                                !customProviderForm.endpoint.trim() ||
                                                (customProviderForm.enabled &&
                                                    !customProviderForm.key.trim())
                                            }
                                            size="sm"
                                        >
                                            <Check className="h-4 w-4" />
                                            {loading ? "Adding..." : "Add Provider"}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                setAddingCustomProvider(false)
                                                setCustomProviderForm({
                                                    name: "",
                                                    endpoint: "",
                                                    enabled: true,
                                                    key: ""
                                                })
                                            }}
                                        >
                                            <X className="h-4 w-4" />
                                            Cancel
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    ) : (
                        <Card className="border-dashed p-4 shadow-xs">
                            <div className="flex flex-col items-center justify-center py-8 text-center">
                                <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-muted">
                                    <PackageIcon className="size-6" />
                                </div>
                                <h4 className="mb-2 font-semibold">Add Custom Provider</h4>
                                <p className="mb-4 text-muted-foreground text-sm">
                                    Add any OpenAI-compatible provider with an API key and base URL
                                </p>
                                <Button
                                    variant="outline"
                                    onClick={() => setAddingCustomProvider(true)}
                                >
                                    <Plus className="h-4 w-4" />
                                    Add Provider
                                </Button>
                            </div>
                        </Card>
                    )}
                </div>
            </div>
        </SettingsLayout>
    )
}
