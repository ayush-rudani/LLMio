export const RESPONSE_OPTS = {
    status: 200,
    statusText: "OK",
    headers: {
        "Content-Type": "text/event-stream",
        "x-vercel-ai-ui-message-stream": "v1",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Content-Encoding": "none"
    }
}
