type Env = {
    VITE_CONVEX_URL: string
    VITE_CONVEX_API_URL: string
}

export const browserEnv = (key: keyof Env) => {
    const value = (import.meta as unknown as { env: Env }).env[key]
    if (!value) {
        throw new Error(`Missing environment variable(browser): ${key}`)
    }
    return value
}
