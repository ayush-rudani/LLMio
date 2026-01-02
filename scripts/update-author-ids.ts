/**
 * Update Author IDs Script
 *
 * This script updates authorId references in your Convex data tables
 * after users have signed in with the new Convex Better Auth.
 *
 * Prerequisites:
 * 1. Migration script has been run
 * 2. Users have signed in at least once to create new auth records
 * 3. user-id-mapping.json exists with mappings
 *
 * Usage:
 *   npx tsx scripts/update-author-ids.ts
 */

import * as fs from "node:fs"
import * as path from "node:path"
import { config } from "dotenv"

// Load environment variables
config({ path: ".env" })
config({ path: ".env.local" })

interface IdMapping {
    oldUserId: string
    newUserId: string
    email: string
}

async function main() {
    console.log("=== Update Author IDs Script ===\n")

    // Load mapping file
    const mappingPath = path.join(process.cwd(), "scripts", "user-id-mapping.json")

    if (!fs.existsSync(mappingPath)) {
        console.error("ERROR: user-id-mapping.json not found")
        console.error("Run the migration script first: npx tsx scripts/migrate-auth-to-convex.ts")
        process.exit(1)
    }

    const mappings: IdMapping[] = JSON.parse(fs.readFileSync(mappingPath, "utf-8"))
    console.log(`Loaded ${mappings.length} user mappings`)

    // Check for users without new IDs
    const pendingMappings = mappings.filter((m) => !m.newUserId)
    const completedMappings = mappings.filter((m) => m.newUserId)

    console.log("\nMappings status:")
    console.log(`  - Completed (have new ID): ${completedMappings.length}`)
    console.log(`  - Pending (user needs to sign in): ${pendingMappings.length}`)

    if (pendingMappings.length > 0) {
        console.log("\nUsers who still need to sign in:")
        for (const mapping of pendingMappings.slice(0, 10)) {
            console.log(`  - ${mapping.email}`)
        }
        if (pendingMappings.length > 10) {
            console.log(`  ... and ${pendingMappings.length - 10} more`)
        }
    }

    console.log("\n--- Instructions ---")
    console.log("\nTo update authorId references in your data:")
    console.log("")
    console.log("1. First, query all users from Convex Better Auth to get new IDs")
    console.log("2. Match by email to populate newUserId in the mapping")
    console.log("3. Create a Convex migration to update authorId fields")
    console.log("")
    console.log("Example Convex migration (add to convex/migrations.ts):")
    console.log(`
import { makeMigration, internalMutationGeneric } from "@convex-dev/migrations"
import { components, internal } from "./_generated/api"
import { authComponent } from "./auth"

// Get the mapping
const ID_MAPPING: Record<string, string> = {
    // "old_postgres_id": "new_convex_id",
    // Add your mappings here
}

export const updateThreadAuthorIds = internalMutationGeneric({
    handler: async (ctx) => {
        const threads = await ctx.db.query("threads").collect()
        for (const thread of threads) {
            const newAuthorId = ID_MAPPING[thread.authorId]
            if (newAuthorId) {
                await ctx.db.patch(thread._id, { authorId: newAuthorId })
            }
        }
    }
})
`)
    console.log("")
    console.log("Note: Since you opted for new Convex IDs, users will get fresh accounts.")
    console.log("Their old data (threads, settings, etc.) will need authorId updates,")
    console.log("or you can start fresh if that's acceptable for your use case.")
}

main().catch(console.error)
