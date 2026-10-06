-- Phase 43: privacy notice acceptance and guardian consent
ALTER TABLE "User" ADD COLUMN "privacyNoticeVersion" TEXT,
ADD COLUMN "privacyAcceptedAt" TIMESTAMP(3),
ADD COLUMN "guardianConsentAt" TIMESTAMP(3),
ADD COLUMN "guardianConsentRecordedBy" TEXT;
