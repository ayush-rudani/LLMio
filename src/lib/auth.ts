import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { emailOTP } from "better-auth/plugins"

import { db } from "@/database/db"
import * as schema from "@/database/schema"
import { jwt } from "better-auth/plugins/jwt"
import { sendOTPEmail } from "./email"

export const auth = betterAuth({
    trustedOrigins: [
        "*.intern3.chat",
        process.env.VERCEL_URL!,
        "https://intern3.chat",
        "http://localhost:3000",
        "https://localhost:3000"
    ].filter(Boolean),
    baseURL: process.env.VITE_BETTER_AUTH_URL || "http://localhost:3000",

    database: drizzleAdapter(db, {
        provider: "pg",
        usePlural: true,
        schema
    }),
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID || "",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || ""
        }
        // github: {
        //     clientId: process.env.GITHUB_CLIENT_ID || "",
        //     clientSecret: process.env.GITHUB_CLIENT_SECRET || ""
        // },
    },
    plugins: [
        emailOTP({
            async sendVerificationOTP({ email, otp, type }) {
                await sendOTPEmail({ email, otp, type })
            },
            otpLength: 6,
            expiresIn: 300, // 5 minutes
            allowedAttempts: 3
        }),
        jwt({
            jwt: {
                audience: "intern3",
                expirationTime: "6h"
            },
            jwks: {
                keyPairConfig: {
                    alg: "RS256",
                    modulusLength: 2048,
                    // @ts-expect-error required for convex
                    extractable: true
                }
            }
        })
    ]
})
