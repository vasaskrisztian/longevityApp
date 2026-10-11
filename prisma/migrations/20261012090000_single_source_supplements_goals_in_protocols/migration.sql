-- Supplements: the user's own list becomes the single source; a protocol points at it.
-- Goals: a goal can belong to a protocol.
--
-- Nothing is deleted or rewritten destructively: every protocol supplement line gets
-- linked to a matching supplement of the same user (created when none matches), and
-- every existing goal is attached to its owner's active protocol (if any).

-- 1. A protocol line without a dose used to be legal, so a supplement made from it
--    cannot require one.
ALTER TABLE "supplements" ALTER COLUMN "dosage" DROP NOT NULL;
ALTER TABLE "supplements" ALTER COLUMN "unit" DROP NOT NULL;
ALTER TABLE "supplements" ALTER COLUMN "frequency" DROP NOT NULL;

-- 2. The link from a protocol line to the user's supplement.
ALTER TABLE "protocol_supplements" ADD COLUMN "supplementId" TEXT;
CREATE INDEX "protocol_supplements_supplementId_idx" ON "protocol_supplements"("supplementId");
ALTER TABLE "protocol_supplements"
  ADD CONSTRAINT "protocol_supplements_supplementId_fkey"
  FOREIGN KEY ("supplementId") REFERENCES "supplements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. Backfill: create the missing supplements. A protocol line matches an existing
--    supplement of the same user when name (case-insensitive), dose, unit, frequency
--    and timing are all equal.
INSERT INTO "supplements" ("id", "userId", "name", "dosage", "unit", "frequency", "timing", "active", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, p."userId", MIN(ps."name"), ps."dosage", ps."unit", ps."frequency", ps."timing", true, NOW(), NOW()
FROM "protocol_supplements" ps
JOIN "protocols" p ON p."id" = ps."protocolId"
WHERE NOT EXISTS (
  SELECT 1 FROM "supplements" s
  WHERE s."userId" = p."userId"
    AND LOWER(s."name") = LOWER(ps."name")
    AND s."dosage" IS NOT DISTINCT FROM ps."dosage"
    AND s."unit" IS NOT DISTINCT FROM ps."unit"
    AND s."frequency" IS NOT DISTINCT FROM ps."frequency"
    AND s."timing" IS NOT DISTINCT FROM ps."timing"
)
GROUP BY p."userId", LOWER(ps."name"), ps."dosage", ps."unit", ps."frequency", ps."timing";

-- 4. Link every protocol line to its supplement (the oldest match if there are several).
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
);

-- 5. Goals belong to a protocol; deleting the protocol keeps the goal.
ALTER TABLE "goals" ADD COLUMN "protocolId" TEXT;
CREATE INDEX "goals_protocolId_idx" ON "goals"("protocolId");
ALTER TABLE "goals"
  ADD CONSTRAINT "goals_protocolId_fkey"
  FOREIGN KEY ("protocolId") REFERENCES "protocols"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 6. Backfill: existing goals go under the owner's active protocol (none = stay without one).
UPDATE "goals" g
SET "protocolId" = p."id"
FROM "protocols" p
WHERE p."userId" = g."userId" AND p."isActive" = true;
