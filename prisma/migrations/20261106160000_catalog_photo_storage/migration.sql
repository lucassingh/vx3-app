-- AlterTable
ALTER TABLE "catalog_photos" ADD COLUMN     "storage_key" TEXT,
ALTER COLUMN "drive_id" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "catalog_photos_storage_key_key" ON "catalog_photos"("storage_key");

-- Una foto viene de un solo lado.
ALTER TABLE "catalog_photos" ADD CONSTRAINT "catalog_photos_un_origen" CHECK (("drive_id" IS NULL) <> ("storage_key" IS NULL));
