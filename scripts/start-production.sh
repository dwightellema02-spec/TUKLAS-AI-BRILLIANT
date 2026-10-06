#!/bin/sh
# Container / server start (Phase 42): check the settings, bring the database up to date with migrations, load the curriculum (no accounts),
# create the first administrator if asked (never overwrites an account), then run the server in the foreground so SIGTERM reaches it.
set -e
npx tsx scripts/check-env.ts
if [ -n "$DATABASE_URL" ]; then
  npx tsx scripts/db-migrate.ts
  SEED_CURRICULUM_ONLY=true npx tsx prisma/seed.ts
  if [ -n "$ADMIN_EMAIL" ]; then npx tsx scripts/create-admin.ts || true; fi
fi
export NODE_ENV=production
# `node --import tsx` (not the tsx launcher, which does not pass SIGTERM on): a deploy then lets requests in flight finish
exec node --import tsx server.ts
