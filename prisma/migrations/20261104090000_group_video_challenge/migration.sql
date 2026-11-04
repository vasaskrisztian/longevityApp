-- Group video challenges: a new challenge type, the video on the challenge,
-- and the records of started / finished viewings.

ALTER TYPE "ChallengeType" ADD VALUE 'VIDEO_SESSIONS';

ALTER TABLE "group_challenges"
  ADD COLUMN "videoId" TEXT,
  ADD COLUMN "videoTitle" TEXT,
  ADD COLUMN "videoDurationSec" INTEGER;

CREATE TABLE "group_video_watches" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "group_video_watches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "group_video_sessions" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "watchedSeconds" INTEGER NOT NULL,

    CONSTRAINT "group_video_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "group_video_watches_challengeId_userId_idx" ON "group_video_watches"("challengeId", "userId");
CREATE INDEX "group_video_sessions_challengeId_day_idx" ON "group_video_sessions"("challengeId", "day");
CREATE UNIQUE INDEX "group_video_sessions_challengeId_userId_day_key" ON "group_video_sessions"("challengeId", "userId", "day");

ALTER TABLE "group_video_watches" ADD CONSTRAINT "group_video_watches_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "group_challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "group_video_watches" ADD CONSTRAINT "group_video_watches_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "group_video_sessions" ADD CONSTRAINT "group_video_sessions_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "group_challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "group_video_sessions" ADD CONSTRAINT "group_video_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
