-- AlterTable
ALTER TABLE "catalog_drafts" ADD COLUMN     "dux_done_at" TIMESTAMPTZ(6),
ADD COLUMN     "steps" JSONB;

-- AlterTable
ALTER TABLE "dux_items" ADD COLUMN     "brand_code" TEXT;
