import { type GenericCtx, createClient } from "@convex-dev/better-auth"
import { convex, crossDomain } from "@convex-dev/better-auth/plugins"
import { betterAuth } from "better-auth"
import { emailOTP, jwt } from "better-auth/plugins"
import { components } from "./_generated/api"
import type { DataModel } from "./_generated/dataModel"
import { internalAction, query } from "./_generated/server"
import authConfig from "./auth.config"

// baseURL is where better-auth server runs (Convex HTTP endpoint)
const baseURL = process.env.AUTH_BASE_URL!
// clientUrl is where to redirect users after auth (your frontend app)
const clientUrl = process.env.CLIENT_URL || "http://localhost:3000"

// The component client has methods needed for integrating Convex with Better Auth,
// as well as helper methods for general use.
export const authComponent = createClient<DataModel>(components.betterAuth)

// Email sending function for OTP
async function sendOTPEmail(data: {
    email: string
    otp: string
    type: "sign-in" | "email-verification" | "forget-password"
}) {
    const emailProvider = process.env.EMAIL_PROVIDER || "resend"
    const emailFrom = process.env.EMAIL_FROM || "noreply@intern3.chat"

    const getSubjectAndText = () => {
        switch (data.type) {
            case "sign-in":
                return {
                    subject: "Your sign-in code - LLMio Chat",
                    text: `Your sign-in code for LLMio Chat is: ${data.otp}\n\nThis code will expire in 5 minutes.`
                }
            case "email-verification":
                return {
                    subject: "Verify your email - LLMio Chat",
                    text: `Your email verification code for LLMio Chat is: ${data.otp}\n\nThis code will expire in 5 minutes.`
                }
            case "forget-password":
                return {
                    subject: "Reset your password - LLMio Chat",
                    text: `Your password reset code for LLMio Chat is: ${data.otp}\n\nThis code will expire in 5 minutes.`
                }
        }
    }

    const { subject, text } = getSubjectAndText()

    // Generate simple HTML email
    const html = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #f6f9fc; margin: 0; padding: 40px 0; }
        .container { background-color: #ffffff; border: 1px solid #e6ebf1; border-radius: 5px; margin: 0 auto; padding: 20px; max-width: 465px; }
        .heading { color: #32325d; font-size: 24px; font-weight: 600; margin: 0 0 20px; }
        .text { color: #525f7f; font-size: 16px; line-height: 1.4; margin: 0 0 16px; }
        .otp-code { background-color: #f8f9fa; border: 2px dashed #dee2e6; border-radius: 8px; color: #212529; display: inline-block; font-size: 32px; font-weight: 700; letter-spacing: 8px; margin: 20px 0; padding: 16px 24px; font-family: Consolas, Monaco, 'Courier New', monospace; }
    </style>
</head>
<body>
    <div class="container">
        <p class="heading">${data.type === "sign-in" ? "Your sign-in code" : data.type === "email-verification" ? "Verify your email" : "Reset your password"}</p>
        <p class="text">Hi,</p>
        <p class="text">${data.type === "sign-in" ? "Use this code to sign in to your LLMio Chat account:" : data.type === "email-verification" ? "Use this code to verify your email address for LLMio Chat:" : "Use this code to reset your password for your LLMio Chat account:"}</p>
        <p class="otp-code">${data.otp}</p>
        <p class="text">This code will expire in 5 minutes for security reasons.</p>
        <p class="text">If you didn't request this code, you can safely ignore this email.</p>
    </div>
</body>
</html>
    `.trim()

    if (emailProvider === "resend") {
        const resendApiKey = process.env.RESEND_API_KEY
        if (!resendApiKey) {
            throw new Error("RESEND_API_KEY is required when using Resend provider")
        }

        const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${resendApiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                from: emailFrom,
                to: data.email,
                subject,
                html,
                text
            })
        })

        if (!response.ok) {
            const errorData = await response.json()
            throw new Error(`Resend error: ${JSON.stringify(errorData)}`)
        }

        console.log(`Sent ${data.type} OTP email to ${data.email}`)
    } else if (emailProvider === "local-only-mock") {
        console.log(
            `[Mock Email] Sending ${data.type} OTP email to ${data.email} with code: ${data.otp}`
        )
    } else {
        throw new Error(
            `Unsupported email provider in Convex: ${emailProvider}. Use 'resend' or 'local-only-mock'.`
        )
    }
}

export const createAuth = (ctx: GenericCtx<DataModel>) => {
    return betterAuth({
        baseURL: baseURL,
        trustedOrigins: [
            baseURL,
            clientUrl,
            "*.intern3.chat",
            "*.ayushrudani.com",
            "https://intern3.chat",
            "http://localhost:3000",
            "https://localhost:3000",
            process.env.VERCEL_URL,
            process.env.PROD_URL,
            process.env.LOCAL_URL
        ].filter((origin): origin is string => !!origin),
        database: authComponent.adapter(ctx),
        socialProviders: {
            google: {
                clientId: process.env.GOOGLE_CLIENT_ID || "",
                clientSecret: process.env.GOOGLE_CLIENT_SECRET || ""
            }
        },
        plugins: [
            emailOTP({
                async sendVerificationOTP({ email, otp, type }) {
                    await sendOTPEmail({ email, otp, type })
                },
                otpLength: 6,
                expiresIn: 300 // 5 minutes
            }),
            // JWT plugin provides the /token endpoint for bearer token generation
            jwt(),
            // The cross domain plugin redirects users to the client app after auth
            crossDomain({ siteUrl: clientUrl }),
            // The Convex plugin is required for Convex compatibility
            convex({ authConfig, jwks: process.env.JWKS })
        ]
    })
}

// Query to get the current authenticated user
export const getCurrentUser = query({
    args: {},
    handler: async (ctx) => {
        return authComponent.getAuthUser(ctx)
    }
})

// Internal action to rotate JWKS keys (run this to fix algorithm issues)
export const rotateKeys = internalAction({
    args: {},
    handler: async (ctx) => {
        const auth = createAuth(ctx)
        const result = await auth.api.rotateKeys()
        console.log("JWKS keys rotated:", result)
        return result
    }
})
