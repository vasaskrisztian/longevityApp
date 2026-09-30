-- CreateTable
CREATE TABLE "inbody_measurements" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "weightKg" DECIMAL(5,1),
    "bodyFatPercentage" DECIMAL(4,1),
    "skeletalMuscleMassKg" DECIMAL(5,1),
    "fatFreeMassKg" DECIMAL(5,1),
    "bmi" DECIMAL(4,1),
    "inBodyScore" INTEGER,
    "visceralFatLevel" INTEGER,
    "basalMetabolicRateKcal" INTEGER,
    "totalBodyWaterL" DECIMAL(5,1),
    "ecwRatio" DECIMAL(5,3),
    "imageData" BYTEA NOT NULL,
    "imageContentType" TEXT NOT NULL,
    "imageFilename" TEXT,
    "rawOcrText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inbody_measurements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inbody_measurements_userId_idx" ON "inbody_measurements"("userId");

-- CreateIndex
CREATE INDEX "inbody_measurements_userId_measuredAt_idx" ON "inbody_measurements"("userId", "measuredAt");

-- AddForeignKey
ALTER TABLE "inbody_measurements" ADD CONSTRAINT "inbody_measurements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
