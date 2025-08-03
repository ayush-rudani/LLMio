import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses"
import { render } from "@react-email/render"
import { Resend } from "resend"
import {
    EmailVerificationTemplate,
    OTPEmailTemplate,
    PasswordResetTemplate
} from "./email-templates"

// Email provider types
type EmailProvider = "resend" | "ses" | "local-only-mock"

interface EmailConfig {
    provider: EmailProvider
    from: string
    resend?: {
        apiKey: string
    }
    ses?: {
        region: string
        accessKeyId?: string
        secretAccessKey?: string
    }
}

interface SendEmailOptions {
    to: string
    subject: string
    html: string
    text?: string
}

class EmailService {
    private config: EmailConfig
    private resend?: Resend
    private sesClient?: SESClient

    constructor() {
        this.config = this.getEmailConfig()
        this.initializeProvider()
    }

    private getEmailConfig(): EmailConfig {
        const provider = (process.env.EMAIL_PROVIDER || "resend") as EmailProvider

        if (provider === "resend" && !process.env.RESEND_API_KEY) {
            throw new Error("RESEND_API_KEY is required when using Resend provider")
        }

        if (provider === "ses" && !process.env.AWS_REGION) {
            throw new Error("AWS_REGION is required when using SES provider")
        }

        return {
            provider,
            from: process.env.EMAIL_FROM || "noreply@intern3.chat",
            resend:
                provider === "resend"
                    ? {
                          apiKey: process.env.RESEND_API_KEY!
                      }
                    : undefined,
            ses:
                provider === "ses"
                    ? {
                          region: process.env.AWS_REGION!,
                          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
                      }
                    : undefined
        }
    }

    private initializeProvider() {
        if (this.config.provider === "resend" && this.config.resend) {
            this.resend = new Resend(this.config.resend.apiKey)
        } else if (this.config.provider === "ses" && this.config.ses) {
            this.sesClient = new SESClient({
                region: this.config.ses.region,
                ...(this.config.ses.accessKeyId &&
                    this.config.ses.secretAccessKey && {
                        credentials: {
                            accessKeyId: this.config.ses.accessKeyId,
                            secretAccessKey: this.config.ses.secretAccessKey
                        }
                    })
            })
        }
    }

    private async sendWithResend(options: SendEmailOptions) {
        if (!this.resend) {
            throw new Error("Resend client not initialized")
        }

        const result = await this.resend.emails.send({
            from: this.config.from,
            to: options.to,
            subject: options.subject,
            html: options.html,
            text: options.text
        })

        if (result.error) {
            throw new Error(`Resend error: ${result.error.message}`)
        }

        return result
    }

    private async sendWithSES(options: SendEmailOptions) {
        if (!this.sesClient) {
            throw new Error("SES client not initialized")
        }

        const command = new SendEmailCommand({
            Source: this.config.from,
            Destination: {
                ToAddresses: [options.to]
            },
            Message: {
                Subject: {
                    Data: options.subject,
                    Charset: "UTF-8"
                },
                Body: {
                    Html: {
                        Data: options.html,
                        Charset: "UTF-8"
                    },
                    ...(options.text && {
                        Text: {
                            Data: options.text,
                            Charset: "UTF-8"
                        }
                    })
                }
            }
        })

        return await this.sesClient.send(command)
    }

    async sendEmail(options: SendEmailOptions) {
        try {
            if (this.config.provider === "resend") {
                return await this.sendWithResend(options)
            }

            if (this.config.provider === "ses") {
                return await this.sendWithSES(options)
            }

            if (this.config.provider === "local-only-mock") {
                if (process.env.NODE_ENV !== "development") {
                    throw new Error(
                        "Local mock email provider is only available in development mode"
                    )
                }
                console.log("Sending email with local mock:", options)
                return {}
            }

            throw new Error(`Unsupported email provider: ${this.config.provider}`)
        } catch (error) {
            console.error("Failed to send email:", error)
            throw error
        }
    }

    async sendVerificationEmail(data: {
        user: { email: string; name?: string }
        url: string
        token: string
    }) {
        const html = await render(
            EmailVerificationTemplate({
                name: data.user.name,
                verificationUrl: data.url
            })
        )

        console.debug(`Sending verification email to ${data.user.email} with URL: ${data.url}`)

        await this.sendEmail({
            to: data.user.email,
            subject: "Verify your email address - LLMio Chat",
            html,
            text: `Hi ${data.user.name || ""},\n\nPlease verify your email address by clicking this link: ${data.url}\n\nIf you didn't create an account, you can safely ignore this email.`
        })
    }

    async sendPasswordResetEmail(data: {
        user: { email: string; name?: string }
        url: string
        token: string
    }) {
        const html = await render(
            PasswordResetTemplate({
                name: data.user.name,
                resetUrl: data.url
            })
        )

        await this.sendEmail({
            to: data.user.email,
            subject: "Reset your password - LLMio Chat",
            html,
            text: `Hi ${data.user.name || ""},\n\nYou can reset your password by clicking this link: ${data.url}\n\nIf you didn't request a password reset, you can safely ignore this email.`
        })
    }

    async sendOTPEmail(data: {
        email: string
        otp: string
        type: "sign-in" | "email-verification" | "forget-password"
    }) {
        const getSubjectAndTemplate = async () => {
            switch (data.type) {
                case "sign-in":
                    return {
                        subject: "Your sign-in code - LLMio Chat",
                        html: await render(
                            OTPEmailTemplate({
                                otp: data.otp,
                                type: "sign-in"
                            })
                        ),
                        text: `Your sign-in code for LLMio Chat is: ${data.otp}\n\nThis code will expire in 5 minutes.`
                    }
                case "email-verification":
                    return {
                        subject: "Verify your email - LLMio Chat",
                        html: await render(
                            OTPEmailTemplate({
                                otp: data.otp,
                                type: "email-verification"
                            })
                        ),
                        text: `Your email verification code for LLMio Chat is: ${data.otp}\n\nThis code will expire in 5 minutes.`
                    }
                case "forget-password":
                    return {
                        subject: "Reset your password - LLMio Chat",
                        html: await render(
                            OTPEmailTemplate({
                                otp: data.otp,
                                type: "forget-password"
                            })
                        ),
                        text: `Your password reset code for LLMio Chat is: ${data.otp}\n\nThis code will expire in 5 minutes.`
                    }
            }
        }

        const { subject, html, text } = await getSubjectAndTemplate()

        console.debug(`Sending ${data.type} OTP email to ${data.email} with code: ${data.otp}`)

        await this.sendEmail({
            to: data.email,
            subject,
            html,
            text
        })
    }
}

// Export singleton instance
export const emailService = new EmailService()

// Export individual functions for Better Auth
export const sendEmail = emailService.sendEmail.bind(emailService)
export const sendVerificationEmail = emailService.sendVerificationEmail.bind(emailService)
export const sendPasswordResetEmail = emailService.sendPasswordResetEmail.bind(emailService)
export const sendOTPEmail = emailService.sendOTPEmail.bind(emailService)
