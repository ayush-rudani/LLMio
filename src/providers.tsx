import { ThemeProvider } from "@/components/theme-provider"
import { authClient } from "@/lib/auth-client"
import { ConvexQueryClient } from "@convex-dev/react-query"
import { AuthQueryProvider } from "@daveyplate/better-auth-tanstack"
import { AuthUIProviderTanstack } from "@daveyplate/better-auth-ui/tanstack"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ClientOnly, Link, useRouter } from "@tanstack/react-router"
import { ConvexQueryCacheProvider } from "convex-helpers/react/cache"
import type { ReactNode } from "react"
import { Toaster } from "sonner"
import { browserEnv } from "./lib/browser-env"

export const convexQueryClient = new ConvexQueryClient(browserEnv("VITE_CONVEX_URL"))

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
            <ConvexQueryCacheProvider>
                <QueryClientProvider client={queryClient}>
                    <AuthQueryProvider>
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
                    </AuthQueryProvider>
                </QueryClientProvider>
            </ConvexQueryCacheProvider>
        </ClientOnly>
    )
}
