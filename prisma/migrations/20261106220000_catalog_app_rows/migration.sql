-- AlterTable
ALTER TABLE "catalog_sheet_rows" ADD COLUMN     "app_photos" JSONB,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'sheet';
