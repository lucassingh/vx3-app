-- CreateTable
CREATE TABLE "rate_limits" (
    "key" TEXT NOT NULL,
    "next_slot_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("key")
);

