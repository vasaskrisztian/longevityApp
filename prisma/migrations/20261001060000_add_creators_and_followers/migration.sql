-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('MEMBER', 'CREATOR');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PRIVATE', 'PUBLIC');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "accountType" "AccountType" NOT NULL DEFAULT 'MEMBER',
ADD COLUMN     "publicProfileConsentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "protocols" ADD COLUMN     "visibility" "Visibility" NOT NULL DEFAULT 'PRIVATE';

-- AlterTable
ALTER TABLE "challenges" ADD COLUMN     "visibility" "Visibility" NOT NULL DEFAULT 'PRIVATE';

-- CreateTable
CREATE TABLE "follows" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "follows_creatorId_idx" ON "follows"("creatorId");

-- CreateIndex
CREATE UNIQUE INDEX "follows_followerId_creatorId_key" ON "follows"("followerId", "creatorId");

-- CreateIndex
CREATE INDEX "protocols_userId_visibility_idx" ON "protocols"("userId", "visibility");

-- CreateIndex
CREATE INDEX "challenges_userId_visibility_idx" ON "challenges"("userId", "visibility");

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
