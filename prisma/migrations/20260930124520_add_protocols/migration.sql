-- CreateTable
CREATE TABLE "protocols" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "targetSleepScore" INTEGER,
    "targetSleepMinutes" INTEGER,
    "targetWeeklyWorkouts" INTEGER,
    "targetDailyActiveCalories" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "protocols_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "protocol_supplements" (
    "id" TEXT NOT NULL,
    "protocolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dosage" DECIMAL(8,2),
    "unit" TEXT,
    "frequency" "SupplementFrequency",
    "timing" "SupplementTiming",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "protocol_supplements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "protocols_userId_idx" ON "protocols"("userId");

-- CreateIndex
CREATE INDEX "protocols_userId_isActive_idx" ON "protocols"("userId", "isActive");

-- CreateIndex
CREATE INDEX "protocol_supplements_protocolId_idx" ON "protocol_supplements"("protocolId");

-- AddForeignKey
ALTER TABLE "protocols" ADD CONSTRAINT "protocols_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "protocol_supplements" ADD CONSTRAINT "protocol_supplements_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "protocols"("id") ON DELETE CASCADE ON UPDATE CASCADE;
