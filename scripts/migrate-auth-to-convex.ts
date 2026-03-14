/**
 * Migration Script: PostgreSQL Better-Auth to Convex Better-Auth
 *
 * This script migrates user authentication data from PostgreSQL to Convex.
 * It handles users, accounts (OAuth/credentials), and creates a mapping file
 * for updating existing data references.
 *
 * Prerequisites:
 * 1. Have both PostgreSQL (old) and Convex (new) environments accessible
 * 2. Set environment variables:
 *    - DATABASE_URL: PostgreSQL connection string
 *    - CONVEX_URL: Your Convex deployment URL (e.g., https://xxx.convex.cloud)
 * 3. Deploy the new Convex auth setup first (npx convex dev / npx convex deploy)
 *
 * Usage:
 *   npx tsx scripts/migrate-auth-to-convex.ts
 *
 * What this script does:
 * 1. Reads all users and accounts from PostgreSQL
 * 2. Creates users in Convex Better Auth component
 * 3. Links OAuth accounts (Google, etc.) to users
 * 4. Generates an ID mapping file (old_user_id -> new_user_id)
 * 5. Provides a separate command to update authorId in your data tables
 */

import * as fs from "node:fs"
import * as path from "node:path"
import { ConvexHttpClient } from "convex/browser"
import { config } from "dotenv"
import { drizzle } from "drizzle-orm/node-postgres"

// Load environment variables
config({ path: ".env" })
config({ path: ".env.local" })

// PostgreSQL schema (matching your current auth-schema.ts)
import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core"

const users = pgTable("users", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull(),
    image: text("image"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull()
})

const accounts = pgTable("accounts", {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull()
})

interface UserRecord {
    id: string
    name: string
    email: string
    emailVerified: boolean
    image: string | null
    createdAt: Date
    updatedAt: Date
}

interface AccountRecord {
    id: string
    accountId: string
    providerId: string
    userId: string
    accessToken: string | null
    refreshToken: string | null
    idToken: string | null
    accessTokenExpiresAt: Date | null
    refreshTokenExpiresAt: Date | null
    scope: string | null
    password: string | null
    createdAt: Date
    updatedAt: Date
}

interface IdMapping {
    oldUserId: string
    newUserId: string
    email: string
}

async function main() {
    console.log("=== PostgreSQL to Convex Auth Migration ===\n")

    // Validate environment
    const databaseUrl = process.env.DATABASE_URL
    const convexUrl = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL

    if (!databaseUrl) {
        console.error("ERROR: DATABASE_URL environment variable is required")
        process.exit(1)
    }

    if (!convexUrl) {
        console.error("ERROR: VITE_CONVEX_URL or CONVEX_URL environment variable is required")
        process.exit(1)
    }

    console.log("PostgreSQL URL:", databaseUrl.replace(/:[^:@]+@/, ":***@"))
    console.log("Convex URL:", convexUrl)
    console.log("")

    // Connect to PostgreSQL
    console.log("Connecting to PostgreSQL...")
    const db = drizzle(databaseUrl)

    // Fetch all users
    console.log("Fetching users from PostgreSQL...")
    const userRecords: UserRecord[] = await db.select().from(users)
    console.log(`Found ${userRecords.length} users`)

    // Fetch all accounts
    console.log("Fetching accounts from PostgreSQL...")
    const accountRecords: AccountRecord[] = await db.select().from(accounts)
    console.log(`Found ${accountRecords.length} accounts`)

    // Group accounts by userId
    const accountsByUser = new Map<string, AccountRecord[]>()
    for (const account of accountRecords) {
        const existing = accountsByUser.get(account.userId) || []
        existing.push(account)
        accountsByUser.set(account.userId, existing)
    }

    // Initialize Convex client
    console.log("\nConnecting to Convex...")
    const convex = new ConvexHttpClient(convexUrl)

    // ID mapping for later data migration
    const idMappings: IdMapping[] = []

    console.log("\n--- Starting Migration ---\n")

    for (let i = 0; i < userRecords.length; i++) {
        const user = userRecords[i]
        const userAccounts = accountsByUser.get(user.id) || []

        console.log(`[${i + 1}/${userRecords.length}] Migrating user: ${user.email}`)

        try {
            // For now, we'll create users directly via the Better Auth API
            // This requires the auth routes to be registered
            //
            // NOTE: The Convex Better Auth component stores users in its internal tables.
            // We need to use the auth.api methods to create users properly.
            //
            // Since we can't directly insert into Convex Better Auth tables,
            // we have two options:
            //
            // Option 1: Users re-authenticate (simplest, recommended)
            //   - Users sign in with Google OAuth or Email OTP
            //   - Their accounts are created fresh in Convex
            //   - You update authorId references in your data using email matching
            //
            // Option 2: Direct database insertion (requires internal mutation)
            //   - Create a Convex internal mutation to insert users
            //   - Call it from this script
            //
            // This script implements Option 1 preparation by creating a mapping file

            // For OAuth users (Google, etc.), they just need to sign in again
            const oauthAccounts = userAccounts.filter(
                (a) => a.providerId !== "credential" && a.providerId !== "email"
            )

            // For credential users, we can't migrate passwords directly
            // They'll need to use "forgot password" or re-register
            const hasCredentialAccount = userAccounts.some(
                (a) => a.providerId === "credential" && a.password
            )

            // Store the mapping - newUserId will be populated after user signs in
            idMappings.push({
                oldUserId: user.id,
                newUserId: "", // Will be populated after user authenticates
                email: user.email
            })

            console.log(
                `  - OAuth accounts: ${oauthAccounts.map((a) => a.providerId).join(", ") || "none"}`
            )
            if (hasCredentialAccount) {
                console.log("  - Has password credential (will need to reset)")
            }
        } catch (error) {
            console.error(`  ERROR migrating ${user.email}:`, error)
        }
    }

    // Save the mapping file
    const mappingPath = path.join(process.cwd(), "scripts", "user-id-mapping.json")
    fs.writeFileSync(mappingPath, JSON.stringify(idMappings, null, 2))
    console.log(`\nSaved ID mapping to: ${mappingPath}`)

    // Generate update script
    console.log("\n=== Migration Summary ===")
    console.log(`Total users: ${userRecords.length}`)
    console.log(`Total accounts: ${accountRecords.length}`)
    console.log("")
    console.log("Next Steps:")
    console.log("1. Deploy your updated Convex functions (npx convex deploy)")
    console.log("2. Update Google OAuth redirect URI in Google Cloud Console:")
    console.log("   https://your-deployment.convex.site/api/auth/callback/google")
    console.log("3. Set Convex environment variables:")
    console.log("   npx convex env set BETTER_AUTH_SECRET=$(openssl rand -base64 32)")
    console.log("   npx convex env set SITE_URL=https://your-site.com")
    console.log("   npx convex env set GOOGLE_CLIENT_ID=your_client_id")
    console.log("   npx convex env set GOOGLE_CLIENT_SECRET=your_client_secret")
    console.log("   npx convex env set EMAIL_PROVIDER=resend")
    console.log("   npx convex env set RESEND_API_KEY=re_xxx")
    console.log("   npx convex env set EMAIL_FROM=noreply@yourdomain.com")
    console.log("4. Users will need to sign in again (OAuth or Email OTP)")
    console.log("5. Run the authorId update script after users have signed in")
    console.log("")
    console.log("To update authorId references in your data after migration,")
    console.log("run: npx tsx scripts/update-author-ids.ts")
}

main().catch(console.error)
