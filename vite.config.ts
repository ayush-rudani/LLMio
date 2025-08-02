import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
// vite.config.ts
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import { defineConfig } from "vite"
import analyzer from "vite-bundle-analyzer"
import svgr from "vite-plugin-svgr"
import tsConfigPaths from "vite-tsconfig-paths"

export default defineConfig({
    resolve: {
        alias: {
            "@/convex": path.resolve(__dirname, "./convex"),
            "@": path.resolve(__dirname, "./src"),
            "micromark-extension-math": "micromark-extension-llm-math"
        }
    },
    server: {
        proxy: {}
    },
    plugins: [
        (process.env.ANALYZE && analyzer()) || null,
        tanstackStart({
            target: "vercel",
            spa: {
                enabled: true
            },
            react: {
                babel: {
                    plugins: [
                        [
                            "babel-plugin-react-compiler",
                            {
                                sources: (filename: string) => {
                                    if (
                                        // https://github.com/lucide-icons/lucide/issues/2386
                                        filename.includes("email")
                                    ) {
                                        return false
                                    }

                                    return true
                                }
                            }
                        ]
                    ]
                }
            }
        }),

        tsConfigPaths({
            projects: ["./tsconfig.json"]
        }),
        tailwindcss(),
        svgr({ include: "**/*.svg" })
    ]
})
