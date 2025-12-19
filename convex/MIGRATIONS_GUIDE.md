# Database Migrations

This project uses Convex Migrations to manage database schema updates and data backfills.

## Title Generation Model Migration

This migration updates the `titleGenerationModel` for users who are currently set to `gemini-2.0-flash-lite` to the new default `gpt-oss-20b`.

### Dry Run (Recommended)
Before applying the changes, run the migration in dry-run mode to see how many documents will be affected:

```bash
bunx convex run migrations:runTitleModelMigration '{"dryRun": true}'
```

### Run Migration
To apply the changes to the database:

```bash
bunx convex run migrations:runTitleModelMigration
```

## Creating New Migrations

1. Define your migration in `convex/migrations.ts` using `migrations.define`.
2. Add a runner for your migration using `migrations.runner`.
3. Export the runner so it can be called via the CLI.
