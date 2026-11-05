-- CreateEnum
CREATE TYPE "customer_segment" AS ENUM ('nueva', 'activa', 'top', 'en_riesgo', 'dormida');

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "cycle_days" DOUBLE PRECISION,
ADD COLUMN     "first_purchase_on" DATE,
ADD COLUMN     "last_purchase_on" DATE,
ADD COLUMN     "margin_12m_cents" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "margin_cents" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "purchases" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "segment" "customer_segment",
ADD COLUMN     "total_cents" BIGINT NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "customers_segment_idx" ON "customers"("segment");
