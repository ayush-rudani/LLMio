import { Body, Container, Head, Html, Link, Preview, Section, Text } from "@react-email/components"

interface EmailVerificationTemplateProps {
    name?: string
    verificationUrl: string
}

export const EmailVerificationTemplate = ({
    name,
    verificationUrl
}: EmailVerificationTemplateProps) => (
    <Html>
        <Head />
        <Preview>Verify your email address for LLMio Chat</Preview>
        <Body style={main}>
            <Container style={container}>
                <Section>
                    <Text style={heading}>Verify your email address</Text>
                    <Text style={text}>{name ? `Hi ${name},` : "Hi,"}</Text>
                    <Text style={text}>
                        Thank you for signing up for LLMio Chat. To complete your registration,
                        please verify your email address by clicking the link below:
                    </Text>
                    <Link href={verificationUrl} style={button}>
                        Verify Email Address
                    </Link>
                    <Text style={text}>
                        If you didn't create an account, you can safely ignore this email.
                    </Text>
                    <Text style={footer}>
                        This link will expire in 24 hours for security reasons.
                    </Text>
                </Section>
            </Container>
        </Body>
    </Html>
)

interface PasswordResetTemplateProps {
    name?: string
    resetUrl: string
}

export const PasswordResetTemplate = ({ name, resetUrl }: PasswordResetTemplateProps) => (
    <Html>
        <Head />
        <Preview>Reset your password for LLMio Chat</Preview>
        <Body style={main}>
            <Container style={container}>
                <Section>
                    <Text style={heading}>Reset your password</Text>
                    <Text style={text}>{name ? `Hi ${name},` : "Hi,"}</Text>
                    <Text style={text}>
                        We received a request to reset your password for your LLMio Chat account.
                        Click the link below to create a new password:
                    </Text>
                    <Link href={resetUrl} style={button}>
                        Reset Password
                    </Link>
                    <Text style={text}>
                        If you didn't request a password reset, you can safely ignore this email.
                        Your password will remain unchanged.
                    </Text>
                    <Text style={footer}>
                        This link will expire in 1 hour for security reasons.
                    </Text>
                </Section>
            </Container>
        </Body>
    </Html>
)

interface OTPEmailTemplateProps {
    otp: string
    type: "sign-in" | "email-verification" | "forget-password"
}

export const OTPEmailTemplate = ({ otp, type }: OTPEmailTemplateProps) => {
    const getContent = () => {
        switch (type) {
            case "sign-in":
                return {
                    preview: "Your sign-in code for LLMio Chat",
                    heading: "Your sign-in code",
                    description: "Use this code to sign in to your LLMio Chat account:"
                }
            case "email-verification":
                return {
                    preview: "Verify your email for LLMio Chat",
                    heading: "Verify your email",
                    description: "Use this code to verify your email address for LLMio Chat:"
                }
            case "forget-password":
                return {
                    preview: "Reset your password for LLMio Chat",
                    heading: "Reset your password",
                    description: "Use this code to reset your password for your LLMio Chat account:"
                }
        }
    }

    const { preview, heading, description } = getContent()

    return (
        <Html>
            <Head />
            <Preview>{preview}</Preview>
            <Body style={main}>
                <Container style={container}>
                    <Section>
                        <Text style={headingStyle}>{heading}</Text>
                        <Text style={text}>Hi,</Text>
                        <Text style={text}>{description}</Text>
                        <Text style={otpCode}>{otp}</Text>
                        <Text style={text}>
                            This code will expire in 5 minutes for security reasons.
                        </Text>
                        <Text style={text}>
                            If you didn't request this code, you can safely ignore this email.
                        </Text>
                    </Section>
                </Container>
            </Body>
        </Html>
    )
}

// Simple, clean styles
const main = {
    backgroundColor: "#f6f9fc",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
}

const container = {
    backgroundColor: "#ffffff",
    border: "1px solid #e6ebf1",
    borderRadius: "5px",
    margin: "40px auto",
    padding: "20px",
    width: "465px"
}

const heading = {
    color: "#32325d",
    fontSize: "24px",
    fontWeight: "600",
    lineHeight: "1.25",
    margin: "0 0 20px"
}

const text = {
    color: "#525f7f",
    fontSize: "16px",
    lineHeight: "1.4",
    margin: "0 0 16px"
}

const button = {
    backgroundColor: "#656ee8",
    borderRadius: "5px",
    color: "#fff",
    display: "inline-block",
    fontSize: "16px",
    fontWeight: "600",
    lineHeight: "1",
    padding: "12px 20px",
    textDecoration: "none",
    margin: "16px 0"
}

const footer = {
    color: "#8898aa",
    fontSize: "14px",
    lineHeight: "1.4",
    margin: "16px 0 0"
}

const headingStyle = {
    color: "#32325d",
    fontSize: "24px",
    fontWeight: "600",
    lineHeight: "1.25",
    margin: "0 0 20px"
}

const otpCode = {
    backgroundColor: "#f8f9fa",
    border: "2px dashed #dee2e6",
    borderRadius: "8px",
    color: "#212529",
    display: "inline-block",
    fontSize: "32px",
    fontWeight: "700",
    letterSpacing: "8px",
    margin: "20px 0",
    padding: "16px 24px",
    textAlign: "center" as const,
    fontFamily: "Consolas, Monaco, 'Courier New', monospace"
}
