-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'GROUP_CHALLENGE_GOAL_REACHED';

-- AlterTable
ALTER TABLE "group_challenges" ADD COLUMN "goalReachedAt" TIMESTAMP(3);
