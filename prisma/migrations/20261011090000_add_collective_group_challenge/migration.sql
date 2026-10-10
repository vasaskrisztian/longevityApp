-- CreateEnum
CREATE TYPE "GroupChallengeMode" AS ENUM ('INDIVIDUAL', 'COLLECTIVE');

-- AlterTable: existing rows are per-person challenges, so they default to INDIVIDUAL.
ALTER TABLE "group_challenges" ADD COLUMN "mode" "GroupChallengeMode" NOT NULL DEFAULT 'INDIVIDUAL',
ADD COLUMN "targetTotal" INTEGER;
