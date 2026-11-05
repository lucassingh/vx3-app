-- AlterTable
ALTER TABLE "dux_customers" ADD COLUMN     "first_name" TEXT;

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "normalized_phone" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "first_name" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "province" TEXT,
    "city" TEXT,
    "dux_records" INTEGER NOT NULL,
    "content_hash" TEXT NOT NULL,
    "first_seen_at" TIMESTAMPTZ(6) NOT NULL,
    "changed_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_normalized_phone_key" ON "customers"("normalized_phone");

