// Migration setup - will be implemented when ready to migrate
import { Migrations } from "@convex-dev/migrations"
import { components, internal } from "./_generated/api.js"
import type { DataModel } from "./_generated/dataModel.js"
import { aggregrateThreadsByFolder } from "./aggregates.js"

export const migrations = new Migrations<DataModel>(components.migrations)

export const backfillUserThreadsAggregatesMigration = migrations.define({
    table: "threads",
    migrateOne: async (ctx, doc) => {
        await aggregrateThreadsByFolder.insertIfDoesNotExist(ctx, doc)
    }
})

export const migrateTitleGenerationModel = migrations.define({
    table: "settings",
    migrateOne: async (ctx, doc) => {
        if (doc.titleGenerationModel === "gemini-2.0-flash-lite") {
            await ctx.db.patch(doc._id, {
                titleGenerationModel: "gpt-oss-20b"
            })
        }
    }
})

export const runAggregateBackfill = migrations.runner([
    internal.migrations.backfillUserThreadsAggregatesMigration
])

export const runTitleModelMigration = migrations.runner([
    internal.migrations.migrateTitleGenerationModel
])
