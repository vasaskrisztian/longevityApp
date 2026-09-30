-- CreateEnum
CREATE TYPE "ChallengeType" AS ENUM ('SLEEP_SCORE', 'DAILY_STEPS', 'WEEKLY_WORKOUTS');

-- CreateTable
CREATE TABLE "challenges" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ChallengeType" NOT NULL,
    "name" TEXT,
    "requiredCount" INTEGER NOT NULL,
    "threshold" INTEGER NOT NULL,
    "windowDays" INTEGER NOT NULL,
    "activatedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "challenges_userId_idx" ON "challenges"("userId");

-- CreateIndex
CREATE INDEX "challenges_userId_activatedAt_idx" ON "challenges"("userId", "activatedAt");

-- AddForeignKey
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
