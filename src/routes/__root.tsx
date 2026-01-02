import type { QueryClient } from "@tanstack/react-query"
import { createRootRouteWithContext } from "@tanstack/react-router"
import { HeadContent, Outlet, Scripts } from "@tanstack/react-router"
import type { ReactNode } from "react"

import { ThemeScript } from "@/components/theme-script"
import globals_css from "@/styles/globals.css?url"
import { Analytics } from "@vercel/analytics/react"
import { Providers } from "../providers"

// Configurable site metadata
const SITE_TITLE = "LLMio Chat"
const SITE_DESCRIPTION = "Powerful AI chatbot. By interns, for interns."
const SITE_URL = "https://llmio.ayushrudani.com" // Update this to your actual domain

export const Route = createRootRouteWithContext<{
    queryClient: QueryClient
}>()({
    head: () => ({
        meta: [
            {
                charSet: "utf-8"
            },
            {
                name: "viewport",
                content: "initial-scale=1, viewport-fit=contain, width=device-width"
            },
            {
                title: SITE_TITLE
            },
            {
                name: "description",
                content: SITE_DESCRIPTION
            },
            // Theme color meta tags
            {
                name: "theme-color",
                content: "oklch(1 0 0)",
                media: "(prefers-color-scheme: light)"
            },
            {
                name: "theme-color",
                content: "oklch(0.145 0 0)",
                media: "(prefers-color-scheme: dark)"
            },
            // Apple mobile web app
            {
                name: "apple-mobile-web-app-capable",
                content: "yes"
            },
            // Open Graph meta tags
            {
                property: "og:title",
                content: SITE_TITLE
            },
            {
                property: "og:description",
                content: SITE_DESCRIPTION
            },
            {
                property: "og:image",
                content: `${SITE_URL}/opengraph.jpg`
            },
            {
                property: "og:url",
                content: SITE_URL
            },
            {
                property: "og:type",
                content: "website"
            },
            {
                property: "og:site_name",
                content: SITE_TITLE
            },
            // Twitter Card meta tags
            {
                name: "twitter:card",
                content: "summary_large_image"
            },
            {
                name: "twitter:title",
                content: SITE_TITLE
            },
            {
                name: "twitter:description",
                content: SITE_DESCRIPTION
            },
            {
                name: "twitter:image",
                content: `${SITE_URL}/opengraph.jpg`
            }
        ],
        links: [
            { rel: "stylesheet", href: globals_css },
            { rel: "icon", href: "/favicon.ico" },
            { rel: "apple-touch-icon", href: "/apple-icon-180.png" },
            { rel: "manifest", href: "/manifest.webmanifest" },
            { rel: "preconnect", href: "https://fonts.googleapis.com" },
            {
                rel: "preconnect",
                href: "https://fonts.gstatic.com",
                crossOrigin: "anonymous"
            },
            {
                rel: "stylesheet",
                href: "https://fonts.googleapis.com/css2?family=Architects+Daughter&family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Fira+Code:wght@300..700&family=Geist+Mono:wght@100..900&family=Geist:wght@100..900&family=IBM+Plex+Mono:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;1,100;1,200;1,300;1,400;1,500;1,600;1,700&family=IBM+Plex+Sans:ital,wght@0,100..700;1,100..700&family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Lora:ital,wght@0,400..700;1,400..700&family=Merriweather:ital,opsz,wght@0,18..144,300..900;1,18..144,300..900&family=Montserrat:ital,wght@0,100..900;1,100..900&family=Open+Sans:ital,wght@0,300..800;1,300..800&family=Outfit:wght@100..900&family=Oxanium:wght@200..800&family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&family=Roboto+Mono:ital,wght@0,100..700;1,100..700&family=Roboto:ital,wght@0,100..900;1,100..900&family=Source+Code+Pro:ital,wght@0,200..900;1,200..900&family=Source+Serif+4:ital,opsz,wght@0,8..60,200..900;1,8..60,200..900&family=Space+Grotesk:wght@300..700&family=Space+Mono:ital,wght@0,400;0,700;1,400;1,700&display=swap"
            }
        ]
    }),

    component: RootComponent
})

function RootComponent() {
    return (
        <RootDocument>
            <Outlet />
        </RootDocument>
    )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <ThemeScript />
                <HeadContent />
            </head>

            <body className="h-dvh overflow-hidden">
                <Providers>{children}</Providers>

                <Scripts />
                <Analytics />
            </body>
        </html>
    )
}
