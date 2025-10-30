import { create } from "zustand"
import { persist } from "zustand/middleware"

export const CHAT_WIDTH_STORE_KEY = "chat-width-store"

export type ChatWidth = "normal" | "wider"

type ChatWidthState = {
    chatWidth: ChatWidth
}

type ChatWidthStore = {
    chatWidthState: ChatWidthState
    setChatWidth: (width: ChatWidth) => void
}

export const useChatWidthStore = create<ChatWidthStore>()(
    persist(
        (set) => ({
            chatWidthState: {
                chatWidth: "normal"
            },
            setChatWidth: (chatWidth) => set({ chatWidthState: { chatWidth } })
        }),
        {
            name: CHAT_WIDTH_STORE_KEY,
            partialize: (state) => ({ chatWidthState: state.chatWidthState })
        }
    )
)

// Utility function to get the Tailwind class for chat width
export const getChatWidthClass = (chatWidth: ChatWidth) => {
    switch (chatWidth) {
        case "normal":
            return "max-w-3xl"
        case "wider":
            return "max-w-4xl"
        default:
            return "max-w-3xl"
    }
}
