-- CreateEnum
CREATE TYPE "catalog_lifecycle" AS ENUM ('activo', 'agotado', 'historico');

-- CreateEnum
CREATE TYPE "catalog_priority" AS ENUM ('A', 'B', 'C');

-- CreateTable
CREATE TABLE "catalog_sheet_rows" (
    "id" UUID NOT NULL,
    "row_number" INTEGER NOT NULL,
    "shown" JSONB NOT NULL,
    "raw" JSONB NOT NULL,
    "read_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "catalog_sheet_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_drive_files" (
    "id" UUID NOT NULL,
    "drive_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "bytes" BIGINT,
    "md5" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "folder" TEXT NOT NULL,
    "modified_at" TIMESTAMPTZ(6),
    "read_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "catalog_drive_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_products" (
    "id" UUID NOT NULL,
    "base_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_combo" BOOLEAN NOT NULL,
    "category" TEXT,
    "subcategory" TEXT,
    "brand" TEXT,
    "last_supplier" TEXT,
    "fabric" TEXT,
    "colors" TEXT,
    "sizes" TEXT,
    "attributes" JSONB NOT NULL,
    "length_cm" DECIMAL(8,2),
    "width_cm" DECIMAL(8,2),
    "height_cm" DECIMAL(8,2),
    "weight_kg" DECIMAL(8,3),
    "lifecycle" "catalog_lifecycle" NOT NULL,
    "seasonal" BOOLEAN NOT NULL,
    "priority" "catalog_priority" NOT NULL,
    "sales_rank" INTEGER,
    "sales_90d_cents" BIGINT NOT NULL,
    "last_sale_on" DATE,
    "missing" JSONB NOT NULL,
    "ready_to_sell" BOOLEAN NOT NULL,
    "in_sheet" BOOLEAN NOT NULL,
    "in_dux" BOOLEAN NOT NULL,
    "sheet_row" INTEGER,
    "present" BOOLEAN NOT NULL DEFAULT true,
    "search_text" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "first_seen_at" TIMESTAMPTZ(6) NOT NULL,
    "changed_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "catalog_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_presentations" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "dux_item_kind" NOT NULL,
    "quantity" INTEGER,
    "in_dux" BOOLEAN NOT NULL,

    CONSTRAINT "catalog_presentations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_photos" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "drive_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,

    CONSTRAINT "catalog_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_review_cases" (
    "id" UUID NOT NULL,
    "block" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "base_code" TEXT,
    "priority" "catalog_priority",
    "sales_rank" INTEGER,
    "description" TEXT NOT NULL,
    "fix_in" TEXT NOT NULL,
    "sheet_row" INTEGER,
    "details" JSONB NOT NULL,

    CONSTRAINT "catalog_review_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_decisions" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "decided_by_id" TEXT,
    "decided_by_label" TEXT NOT NULL,
    "decided_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "catalog_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "catalog_sheet_rows_row_number_key" ON "catalog_sheet_rows"("row_number");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_drive_files_drive_id_key" ON "catalog_drive_files"("drive_id");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_products_base_code_key" ON "catalog_products"("base_code");

-- CreateIndex
CREATE INDEX "catalog_products_category_idx" ON "catalog_products"("category");

-- CreateIndex
CREATE INDEX "catalog_products_lifecycle_idx" ON "catalog_products"("lifecycle");

-- CreateIndex
CREATE INDEX "catalog_products_priority_idx" ON "catalog_products"("priority");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_presentations_code_key" ON "catalog_presentations"("code");

-- CreateIndex
CREATE INDEX "catalog_presentations_product_id_idx" ON "catalog_presentations"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_photos_drive_id_key" ON "catalog_photos"("drive_id");

-- CreateIndex
CREATE INDEX "catalog_photos_product_id_idx" ON "catalog_photos"("product_id");

-- CreateIndex
CREATE INDEX "catalog_review_cases_block_idx" ON "catalog_review_cases"("block");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_review_cases_block_key_key" ON "catalog_review_cases"("block", "key");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_decisions_type_key_key" ON "catalog_decisions"("type", "key");

-- AddForeignKey
ALTER TABLE "catalog_presentations" ADD CONSTRAINT "catalog_presentations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "catalog_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_photos" ADD CONSTRAINT "catalog_photos_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "catalog_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

