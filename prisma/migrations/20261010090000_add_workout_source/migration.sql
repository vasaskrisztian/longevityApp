-- AlterTable
ALTER TABLE "workouts" ADD COLUMN "source" TEXT;

-- Backfill from the raw provider payloads already stored (Oura's workout
-- records carry `source`: manual | autodetected | confirmed | workout_heart_rate).
UPDATE "workouts" AS w
SET "source" = r."payload" ->> 'source'
FROM "wearable_raw_records" AS r
WHERE r."dataType" = 'WORKOUT'
  AND r."provider" = w."provider"
  AND r."externalId" = w."externalId"
  AND w."userId" = r."userId"
  AND r."payload" ->> 'source' IS NOT NULL;
