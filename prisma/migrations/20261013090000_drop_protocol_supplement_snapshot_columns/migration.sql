-- Protocol supplement lines keep only the link to the user's own supplement; the
-- name/dose/frequency/timing snapshot columns left over from before the
-- single-source migration (20261012090000) are dropped. IRREVERSIBLE: take a
-- database backup first.
--
-- Safety: re-run the link backfill for any line that is still unlinked (idempotent, same
-- matching rules as 20261012090000), then refuse to continue if one is left, so no
-- line can lose its only copy of the name/dose.

-- 1. Create the supplements any still-unlinked line would need.
INSERT INTO "supplements" ("id", "userId", "name", "dosage", "unit", "frequency", "timing", "active", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, p."userId", MIN(ps."name"), ps."dosage", ps."unit", ps."frequency", ps."timing", true, NOW(), NOW()
FROM "protocol_supplements" ps
JOIN "protocols" p ON p."id" = ps."protocolId"
WHERE ps."supplementId" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "supplements" s
    WHERE s."userId" = p."userId"
      AND LOWER(s."name") = LOWER(ps."name")
      AND s."dosage" IS NOT DISTINCT FROM ps."dosage"
      AND s."unit" IS NOT DISTINCT FROM ps."unit"
      AND s."frequency" IS NOT DISTINCT FROM ps."frequency"
      AND s."timing" IS NOT DISTINCT FROM ps."timing"
  )
GROUP BY p."userId", LOWER(ps."name"), ps."dosage", ps."unit", ps."frequency", ps."timing";

-- 2. Link those lines (the oldest matching supplement).
UPDATE "protocol_supplements" ps
SET "supplementId" = (
  SELECT s."id"
  FROM "supplements" s
  JOIN "protocols" p ON p."userId" = s."userId"
  WHERE p."id" = ps."protocolId"
    AND LOWER(s."name") = LOWER(ps."name")
    AND s."dosage" IS NOT DISTINCT FROM ps."dosage"
    AND s."unit" IS NOT DISTINCT FROM ps."unit"
    AND s."frequency" IS NOT DISTINCT FROM ps."frequency"
    AND s."timing" IS NOT DISTINCT FROM ps."timing"
  ORDER BY s."createdAt" ASC, s."id" ASC
  LIMIT 1
)
WHERE ps."supplementId" IS NULL;

-- 3. Nothing may be left unlinked.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "protocol_supplements" WHERE "supplementId" IS NULL) THEN
    RAISE EXCEPTION 'protocol_supplements still has lines without a supplementId; not dropping the snapshot columns';
  END IF;
END $$;

-- 4. The link is now mandatory and the snapshot goes.
ALTER TABLE "protocol_supplements" ALTER COLUMN "supplementId" SET NOT NULL;
ALTER TABLE "protocol_supplements"
  DROP COLUMN "name",
  DROP COLUMN "dosage",
  DROP COLUMN "unit",
  DROP COLUMN "frequency",
  DROP COLUMN "timing";
