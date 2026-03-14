import { UI_MESSAGE_STREAM_HEADERS } from "ai"

// Re-export the v6 headers for backward compatibility
export const RESPONSE_OPTS = {
    status: 200,
    statusText: "OK",
    headers: UI_MESSAGE_STREAM_HEADERS
}
