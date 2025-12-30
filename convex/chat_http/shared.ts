export const RESPONSE_OPTS = {
    status: 200,
    statusText: "OK",
    headers: {
        "Content-Type": "text/event-stream",
        "X-Vercel-AI-Data-Stream": "v1",
        "Cache-Control": "no-cache",
        Connection: "keep-alive"
    }
}
