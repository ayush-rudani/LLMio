import { convexClient, crossDomainClient } from "@convex-dev/better-auth/client/plugins"
import { emailOTPClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
    baseURL: import.meta.env.VITE_CONVEX_SITE_URL,
    plugins: [
        emailOTPClient(),
        convexClient(),
        crossDomainClient() as any // Type mismatch between @convex-dev/better-auth and better-auth versions
    ]
})
