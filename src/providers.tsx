import { ThemeProvider } from "@/components/theme-provider"
import { authClient } from "@/lib/auth-client"
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react"
import { ConvexQueryClient } from "@convex-dev/react-query"
import { AuthUIProviderTanstack } from "@daveyplate/better-auth-ui/tanstack"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ClientOnly, Link, useRouter } from "@tanstack/react-router"
import { ConvexQueryCacheProvider } from "convex-helpers/react/cache"
import { ConvexReactClient } from "convex/react"
import type { ReactNode } from "react"
import { Toaster } from "sonner"
import { browserEnv } from "./lib/browser-env"

const convex = new ConvexReactClient(browserEnv("VITE_CONVEX_URL"))
export const convexQueryClient = new ConvexQueryClient(convex)

export const queryClient: QueryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5,
            gcTime: 1000 * 60 * 5,
            queryKeyHashFn: convexQueryClient.hashFn(),
            queryFn: convexQueryClient.queryFn()
        }
    }
})
convexQueryClient.connect(queryClient)

export function Providers({ children }: { children: ReactNode }) {
    const router = useRouter()

    return (
        <ClientOnly>
            <ConvexBetterAuthProvider client={convex} authClient={authClient}>
                <ConvexQueryCacheProvider>
                    <QueryClientProvider client={queryClient}>
                        <ThemeProvider>
                            <AuthUIProviderTanstack
                                authClient={authClient}
                                navigate={(href) => router.navigate({ href })}
                                replace={(href) => router.navigate({ href, replace: true })}
                                Link={({ href, ...props }) => <Link to={href} {...props} />}
                            >
                                {children}

                                <Toaster />
                            </AuthUIProviderTanstack>
                        </ThemeProvider>
                    </QueryClientProvider>
                </ConvexQueryCacheProvider>
            </ConvexBetterAuthProvider>
        </ClientOnly>
    )
}
