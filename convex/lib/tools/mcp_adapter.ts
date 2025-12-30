import { createMCPClient } from "@ai-sdk/mcp"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import type { Tool } from "ai"
import type { ToolAdapter } from "../toolkit"

export const MCPAdapter: ToolAdapter = async ({ enabledTools, userSettings }) => {
    console.log("[MCP] MCPAdapter called", {
        enabledTools,
        mcpServersCount: userSettings.mcpServers?.length || 0
    })

    // Check if MCP is enabled
    if (!enabledTools.includes("mcp")) {
        console.log("[MCP] MCP not enabled in enabledTools, returning empty tools")
        return {}
    }

    // Get MCP servers from user settings and filter only enabled ones
    const allMcpServers = userSettings.mcpServers || []
    const mcpServers = allMcpServers.filter((server) => server.enabled !== false) // Default to enabled if not specified

    if (mcpServers.length === 0) {
        console.log("[MCP] No enabled MCP servers configured, returning empty tools")
        return {}
    }

    console.log(
        "[MCP] Found",
        mcpServers.length,
        "enabled MCP servers (out of",
        allMcpServers.length,
        "total):",
        mcpServers.map((s) => ({ name: s.name, url: s.url, type: s.type, enabled: s.enabled }))
    )

    const tools: Record<string, Tool> = {}

    // Initialize MCP clients and collect tools
    const initializeServers = async () => {
        console.log("[MCP] Starting server initialization...")

        for (const server of mcpServers) {
            console.log(
                `[MCP] Initializing server: ${server.name} (${server.type}://${server.url})`
            )

            try {
                const headers = server.headers?.reduce<Record<string, string>>((acc, header) => {
                    if (header.key) acc[header.key] = header.value || ""
                    return acc
                }, {})

                console.log(`[MCP] Server ${server.name} headers:`, headers)

                // Create transport based on server type
                const transport =
                    server.type === "sse"
                        ? {
                              type: "sse" as const,
                              url: server.url,
                              headers
                          }
                        : new StreamableHTTPClientTransport(new URL(server.url), {
                              requestInit: {
                                  headers
                              }
                          })

                console.log(`[MCP] Created ${server.type} transport for ${server.name}`)

                // Create MCP client
                console.log(`[MCP] Creating MCP client for ${server.name}...`)
                const client = await createMCPClient({
                    transport,
                    name: `intern3-chat-${server.name}`
                })

                console.log(`[MCP] Successfully created client for ${server.name}`)

                console.log(`[MCP] Getting tools from ${server.name}...`)
                // Get tools from the client
                const mcpTools = await client.tools()
                const toolNames = Object.keys(mcpTools)
                console.log(`[MCP] Got ${toolNames.length} tools from ${server.name}:`, toolNames)

                // Add tools with server prefix to avoid conflicts
                let addedCount = 0
                for (const [toolName, tool] of Object.entries(mcpTools)) {
                    const prefixedName = `${server.name}_${toolName}`
                    tools[prefixedName] = tool as Tool
                    addedCount++
                    console.log(`[MCP] Added tool: ${prefixedName}`)
                }

                console.log(
                    `[MCP] Successfully added ${addedCount} tools from server ${server.name}`
                )
            } catch (error) {
                console.error(`[MCP] Failed to initialize MCP client for ${server.name}:`, error)
                console.error(`[MCP] Error details for ${server.name}:`, {
                    message: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined
                })
            }
        }

        const totalTools = Object.keys(tools).length
        console.log(`[MCP] Server initialization complete. Total tools available: ${totalTools}`)
        if (totalTools > 0) {
            console.log("[MCP] Available tools:", Object.keys(tools))
        }
    }

    // Initialize servers in the background
    console.log("[MCP] Starting background initialization...")
    await initializeServers()

    console.log("[MCP] Returning tools object (will be populated asynchronously)")
    return tools
}
