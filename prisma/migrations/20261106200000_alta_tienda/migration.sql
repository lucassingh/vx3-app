-- AlterTable
ALTER TABLE "catalog_drafts" ADD COLUMN     "store_done_at" TIMESTAMPTZ(6),
ADD COLUMN     "store_state" JSONB;

-- CreateTable
CREATE TABLE "store_products" (
    "id" BIGINT NOT NULL,
    "sku" TEXT,
    "name" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL,
    "section" TEXT,
    "category_ids" INTEGER[],
    "image_count" INTEGER NOT NULL,
    "price_cents" BIGINT NOT NULL,
    "read_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "store_products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "store_products_sku_idx" ON "store_products"("sku");
