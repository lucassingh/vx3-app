-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "first_purchase_local" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "search_text" TEXT NOT NULL DEFAULT '';
