import { corsRouter } from "convex-helpers/server/cors"
import { httpRouter } from "convex/server"
import { getFile, uploadFile } from "./attachments"
import { chatGETV2 } from "./chat_http/get.route"
import { chatPOST } from "./chat_http/post.route"
import { transcribeAudio } from "./speech_to_text"

const VERCEL_URL = process.env.VERCEL_URL
const PROD_URL = process.env.PROD_URL
const LOCAL_URL = process.env.LOCAL_URL

const http = httpRouter()
const cors = corsRouter(http, {
    allowedOrigins: [
        "http://localhost:3000",
        "https://intern3.vercel.app",
        "https://intern3.chat",
        "https://llmio.ayushrudani.com",
        VERCEL_URL,
        PROD_URL,
        LOCAL_URL
    ].filter((origin): origin is string => typeof origin === "string" && origin !== null),
    allowedHeaders: ["Content-Type", "Authorization"],
    allowCredentials: true
})

cors.route({
    path: "/chat",
    method: "POST",
    handler: chatPOST
})

// Exact match for /chat (query param style: /chat?chatId=xxx)
cors.route({
    path: "/chat",
    method: "GET",
    handler: chatGETV2
})

// Prefix match for /chat/{chatId}/stream pattern (AI SDK 5)
cors.route({
    pathPrefix: "/chat/",
    method: "GET",
    handler: chatGETV2
})

// File upload route
cors.route({
    path: "/upload",
    method: "POST",
    handler: uploadFile
})

// Speech-to-text route
cors.route({
    path: "/transcribe",
    method: "POST",
    handler: transcribeAudio
})

http.route({
    path: "/r2",
    method: "GET",
    handler: getFile
})

export default http
