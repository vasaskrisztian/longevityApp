-- Preferred interface language of a person ('en' | 'hu' | 'de').
ALTER TABLE "users" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'en';
