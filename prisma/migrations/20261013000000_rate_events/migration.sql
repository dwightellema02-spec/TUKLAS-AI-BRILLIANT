-- CreateTable
CREATE TABLE "RateEvent" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "until" TIMESTAMP(3),

    CONSTRAINT "RateEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RateEvent_key_at_idx" ON "RateEvent"("key", "at");

-- CreateIndex
CREATE INDEX "RateEvent_at_idx" ON "RateEvent"("at");
