import { createRouter as createTanStackRouter } from "@tanstack/react-router"
import { routerWithQueryClient } from "@tanstack/react-router-with-query"
import { queryClient } from "./providers"
import { routeTree } from "./routeTree.gen"

export function createRouter() {
    const router = routerWithQueryClient(
        createTanStackRouter({
            routeTree,
            defaultPreload: "intent",
            context: { queryClient },
            defaultNotFoundComponent: () => (
                <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
                    <div className="space-y-2">
                        <h1 className="font-bold text-8xl text-muted-foreground">404</h1>
                        <h2 className="font-semibold text-2xl">Page Not Found</h2>
                        <p className="max-w-md text-muted-foreground">
                            The page you're looking for doesn't exist or has been moved.
                        </p>
                    </div>
                    <a
                        href="/"
                        className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 font-medium text-primary-foreground text-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                        Go Home
                    </a>
                </div>
            )
        }),
        queryClient
    )

    return router
}

declare module "@tanstack/react-router" {
    interface Register {
        router: ReturnType<typeof createRouter>
    }
}
