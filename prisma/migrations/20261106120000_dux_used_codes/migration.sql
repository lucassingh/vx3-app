-- CreateTable
CREATE TABLE "dux_used_codes" (
    "code" TEXT NOT NULL,
    "normalized_code" TEXT NOT NULL,
    "first_seen_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "dux_used_codes_pkey" PRIMARY KEY ("code")
);

-- CreateIndex
CREATE INDEX "dux_used_codes_normalized_code_idx" ON "dux_used_codes"("normalized_code");
