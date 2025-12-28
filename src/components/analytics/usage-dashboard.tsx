import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
    type ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent
} from "@/components/ui/chart"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { api } from "@/convex/_generated/api"
import { useSession } from "@/hooks/auth-hooks"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { useQuery } from "convex/react"
import { Activity, BarChart3, TrendingUp, Zap } from "lucide-react"
import { useMemo, useState } from "react"
import { Bar, BarChart, XAxis, YAxis } from "recharts"

// Enhanced color palette for better model distinction
const MODEL_COLORS = [
    "#3b82f6", // blue
    "#ef4444", // red
    "#10b981", // emerald
    "#f59e0b", // amber
    "#8b5cf6", // violet
    "#ec4899", // pink
    "#06b6d4", // cyan
    "#84cc16", // lime
    "#f97316", // orange
    "#6366f1", // indigo
    "#14b8a6", // teal
    "#eab308", // yellow
    "#dc2626", // red-600
    "#059669", // emerald-600
    "#7c3aed", // violet-600
    "#db2777", // pink-600
    "#0891b2", // cyan-600
    "#65a30d", // lime-600
    "#ea580c", // orange-600
    "#4f46e5" // indigo-600
]

interface UsageDashboardProps {
    className?: string
}

export function UsageDashboard({ className }: UsageDashboardProps) {
    const [timeframe, setTimeframe] = useState<"1d" | "7d" | "30d">("7d")
    const isMobile = useIsMobile()

    const session = useSession()
    const stats = useQuery(api.analytics.getMyUsageStats, session.user?.id ? { timeframe } : "skip")
    const chartData = useQuery(
        api.analytics.getMyUsageChartData,
        session.user?.id ? { timeframe } : "skip"
    )

    // Process data for stacked model usage chart
    const modelUsageData = useMemo(() => {
        if (!chartData) return []

        return chartData.map((day) => {
            const dayData: Record<string, any> = {
                date: day.date,
                total: day.totalTokens
            }

            // Add each model's token count
            Object.entries(day.models).forEach(([modelId, data]) => {
                dayData[modelId] = data.tokens
            })

            return dayData
        })
    }, [chartData])

    // Process data for token type distribution chart
    const tokenTypeData = useMemo(() => {
        if (!chartData) return []

        return chartData.map((day) => ({
            date: day.date,
            prompt: Object.values(day.models).reduce((sum, model) => sum + model.inputTokens, 0),
            completion: Object.values(day.models).reduce(
                (sum, model) => sum + model.outputTokens,
                0
            ),
            reasoningText: Object.values(day.models).reduce(
                (sum, model) => sum + model.reasoningTokens,
                0
            )
        }));
    }, [chartData])

    // Get unique models for chart config
    const modelIds = useMemo(() => {
        if (!stats) return []
        return stats.modelStats.map((model) => model.modelId)
    }, [stats])

    // Create chart configs
    const modelChartConfig = useMemo(() => {
        const config: ChartConfig = {}
        modelIds.forEach((modelId, index) => {
            config[modelId] = {
                label: stats?.modelStats.find((m) => m.modelId === modelId)?.modelName || modelId,
                color: MODEL_COLORS[index % MODEL_COLORS.length]
            }
        })
        return config
    }, [modelIds, stats])

    const tokenChartConfig = {
        prompt: {
            label: "Input Tokens"
        },
        completion: {
            label: "Output Tokens"
        },
        reasoningText: {
            label: "Reasoning Tokens"
        }
    } satisfies ChartConfig

    return (
        <div className={cn("space-y-4", className)}>
            {/* Header with timeframe selector */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Tabs
                    value={timeframe}
                    onValueChange={(value) => setTimeframe(value as "1d" | "7d" | "30d")}
                >
                    <TabsList className="grid w-full grid-cols-3 sm:w-auto">
                        <TabsTrigger value="1d">1 Day</TabsTrigger>
                        <TabsTrigger value="7d">7 Days</TabsTrigger>
                        <TabsTrigger value="30d">30 Days</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>
            {/* Key Metrics Cards - Compact */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Card className="gap-3 p-4">
                    <CardHeader className="flex flex-row items-center px-0">
                        <Activity className="size-3 text-muted-foreground sm:size-4" />
                        <CardTitle className="font-medium text-xs sm:text-sm">
                            Total Requests
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="font-bold text-lg sm:text-2xl">
                            {stats?.totalRequests || 0}
                        </div>
                        <p className="text-muted-foreground text-xs">
                            {timeframe === "1d"
                                ? "today"
                                : `last ${timeframe === "7d" ? "7" : "30"} days`}
                        </p>
                    </CardContent>
                </Card>

                <Card className="gap-3 p-4">
                    <CardHeader className="flex flex-row items-center px-0">
                        <Zap className="size-3 text-muted-foreground sm:size-4" />
                        <CardTitle className="font-medium text-xs sm:text-sm">
                            Total Tokens
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="font-bold text-lg sm:text-2xl">
                            {((stats?.totalTokens || 0) / 1000).toFixed(1)}K
                        </div>
                        <p className="text-muted-foreground text-xs">input + output + reasoning</p>
                    </CardContent>
                </Card>

                <Card className="gap-3 p-4">
                    <CardHeader className="flex flex-row items-center px-0">
                        <BarChart3 className="size-3 text-muted-foreground sm:size-4" />
                        <CardTitle className="font-medium text-xs sm:text-sm">
                            Models Used
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="font-bold text-lg sm:text-2xl">
                            {stats?.modelStats.length || 0}
                        </div>
                        <p className="text-muted-foreground text-xs">different models</p>
                    </CardContent>
                </Card>

                <Card className="gap-3 p-4">
                    <CardHeader className="flex flex-row items-center px-0">
                        <TrendingUp className="size-3 text-muted-foreground sm:size-4" />
                        <CardTitle className="font-medium text-xs sm:text-sm">
                            Avg tokens/request
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="font-bold text-lg sm:text-2xl">
                            {stats?.totalRequests
                                ? Math.round((stats?.totalTokens || 0) / stats.totalRequests)
                                : 0}
                        </div>
                        <p className="text-muted-foreground text-xs">
                            total tokens / total requests
                        </p>
                    </CardContent>
                </Card>
            </div>
            {/* Charts */}
            <div className="grid gap-4">
                {/* Stacked Model Usage Chart */}
                <Card className="gap-3 overflow-hidden p-4">
                    <CardHeader className="gap-0 px-0 pb-3">
                        <CardTitle className="text-base sm:text-lg">Token Usage by Model</CardTitle>
                        <CardDescription className="text-xs sm:text-sm">
                            Daily token consumption breakdown by model
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-3 px-0">
                        <ChartContainer
                            config={modelChartConfig}
                            className="aspect-auto h-[250px] w-full overflow-hidden sm:h-[300px]"
                        >
                            <BarChart
                                data={modelUsageData}
                                width={undefined}
                                height={undefined}
                                margin={{ left: 0, right: 10, top: 5, bottom: 0 }}
                            >
                                <XAxis
                                    dataKey="date"
                                    tickFormatter={(value) => {
                                        const date = new Date(value)
                                        if (timeframe === "1d") {
                                            return date.toLocaleTimeString([], {
                                                hour: "numeric",
                                                hour12: true
                                            })
                                        }
                                        return isMobile
                                            ? `${date.getMonth() + 1}/${date.getDate()}`
                                            : date.toLocaleDateString()
                                    }}
                                    fontSize={isMobile ? 10 : 12}
                                />
                                <YAxis
                                    width={30}
                                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                                    fontSize={isMobile ? 10 : 12}
                                />
                                <ChartTooltip
                                    content={<ChartTooltipContent />}
                                    labelFormatter={(value) => {
                                        const date = new Date(value)
                                        if (timeframe === "1d") {
                                            return date.toLocaleString([], {
                                                month: "short",
                                                day: "numeric",
                                                hour: "numeric",
                                                minute: "2-digit",
                                                hour12: true
                                            })
                                        }
                                        return date.toLocaleDateString([], {
                                            weekday: "short",
                                            month: "short",
                                            day: "numeric"
                                        })
                                    }}
                                    formatter={(value, name) => [
                                        `${Number(value).toLocaleString()} tokens - `,
                                        modelChartConfig[name as string]?.label || name
                                    ]}
                                />
                                {modelIds.map((modelId) => (
                                    <Bar
                                        key={modelId}
                                        dataKey={modelId}
                                        stackId="models"
                                        fill={modelChartConfig[modelId]?.color}
                                    />
                                ))}
                            </BarChart>
                        </ChartContainer>
                    </CardContent>
                </Card>

                {/* Token Type Distribution Chart */}
                <Card className="gap-3 overflow-hidden p-4">
                    <CardHeader className="gap-0 px-0 pb-3">
                        <CardTitle className="text-base sm:text-lg">
                            Token Type Distribution
                        </CardTitle>
                        <CardDescription className="text-xs sm:text-sm">
                            Input, output, and reasoning token breakdown
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-3 px-0">
                        <ChartContainer
                            config={tokenChartConfig}
                            className="aspect-auto h-[250px] w-full overflow-hidden sm:h-[300px]"
                        >
                            <BarChart
                                data={tokenTypeData}
                                margin={{ left: 0, right: 10, top: 5, bottom: 0 }}
                                width={undefined}
                                height={undefined}
                            >
                                <XAxis
                                    dataKey="date"
                                    tickFormatter={(value) => {
                                        const date = new Date(value)
                                        if (timeframe === "1d") {
                                            return date.toLocaleTimeString([], {
                                                hour: "numeric",
                                                hour12: true
                                            })
                                        }
                                        return isMobile
                                            ? `${date.getMonth() + 1}/${date.getDate()}`
                                            : date.toLocaleDateString()
                                    }}
                                    fontSize={isMobile ? 10 : 12}
                                />
                                <YAxis
                                    width={30}
                                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                                    fontSize={isMobile ? 10 : 12}
                                />
                                <ChartTooltip
                                    content={<ChartTooltipContent />}
                                    labelFormatter={(value) => {
                                        const date = new Date(value)
                                        if (timeframe === "1d") {
                                            return date.toLocaleString([], {
                                                month: "short",
                                                day: "numeric",
                                                hour: "numeric",
                                                minute: "2-digit",
                                                hour12: true
                                            })
                                        }
                                        return date.toLocaleDateString([], {
                                            weekday: "short",
                                            month: "short",
                                            day: "numeric"
                                        })
                                    }}
                                    formatter={(value, name) => [
                                        `${Number(value).toLocaleString()} `,
                                        tokenChartConfig[name as keyof typeof tokenChartConfig]
                                            ?.label || name
                                    ]}
                                />
                                <Bar dataKey="prompt" stackId="tokens" fill={"var(--chart-1)"} />
                                <Bar
                                    dataKey="completion"
                                    stackId="tokens"
                                    fill={"var(--chart-2)"}
                                />
                                <Bar dataKey="reasoning" stackId="tokens" fill={"var(--chart-3)"} />
                            </BarChart>
                        </ChartContainer>
                    </CardContent>
                </Card>
            </div>
            {/* Model Details - Non-chart breakdown */}
            <Card className="gap-3 p-4">
                <CardHeader className="gap-0 px-0">
                    <CardTitle className="text-base sm:text-lg">Model Usage Details</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">
                        Detailed breakdown by model for the selected period
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0 pt-0">
                    <div className="space-y-1.5">
                        {stats?.modelStats.map((model, index) => (
                            <div
                                key={model.modelId}
                                className="flex items-center justify-between rounded-lg border px-2 py-1"
                            >
                                <div className="flex items-center gap-3">
                                    <div
                                        className="h-3 w-3 rounded-full"
                                        style={{
                                            backgroundColor:
                                                MODEL_COLORS[index % MODEL_COLORS.length]
                                        }}
                                    />
                                    <div>
                                        <div className="font-medium text-sm">{model.modelName}</div>
                                        <div className="text-muted-foreground text-xs">
                                            {model.requests} request
                                            {model.requests === 1 ? "" : "s"}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-medium text-sm sm:text-base">
                                        {(model.totalTokens / 1000).toFixed(1)}K tokens
                                    </div>
                                    <div className="text-muted-foreground text-xs">
                                        {(model.inputTokens / 1000).toFixed(0)}K in •{" "}
                                        {(model.outputTokens / 1000).toFixed(0)}K out
                                        {model.reasoningTokens > 0 &&
                                            ` • ${(model.reasoningTokens / 1000).toFixed(0)}K reasoning`}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {(!stats?.modelStats || stats.modelStats.length === 0) && (
                            <div className="py-8 text-center text-muted-foreground">
                                No usage data for the selected period
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
