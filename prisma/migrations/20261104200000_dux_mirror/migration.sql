-- CreateEnum
CREATE TYPE "dux_item_kind" AS ENUM ('prenda', 'pack', 'pack_viejo', 'combo', 'no_producto');

-- CreateEnum
CREATE TYPE "sync_run_status" AS ENUM ('en_curso', 'ok', 'con_errores', 'error');

-- CreateTable
CREATE TABLE "dux_items" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "normalized_code" TEXT NOT NULL,
    "kind" "dux_item_kind" NOT NULL,
    "base_code" TEXT NOT NULL,
    "pack_quantity" INTEGER,
    "out_of_rule" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "subcategory" TEXT,
    "brand" TEXT,
    "supplier_id" INTEGER,
    "supplier" TEXT,
    "cost_cents" BIGINT NOT NULL,
    "prices" JSONB NOT NULL,
    "stock_real" DECIMAL(18,8) NOT NULL,
    "stock_reserved" DECIMAL(18,8) NOT NULL,
    "stock_available" DECIMAL(18,8) NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "external_code" TEXT,
    "image_url" TEXT,
    "created_on" DATE NOT NULL,
    "content_hash" TEXT NOT NULL,
    "present" BOOLEAN NOT NULL DEFAULT true,
    "first_seen_at" TIMESTAMPTZ(6) NOT NULL,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL,
    "changed_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "dux_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dux_invoices" (
    "id" UUID NOT NULL,
    "dux_id" INTEGER NOT NULL,
    "branch_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "letter" TEXT NOT NULL,
    "point_of_sale" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "issued_on" DATE NOT NULL,
    "customer_dux_id" INTEGER,
    "order_number" TEXT,
    "total_cents" BIGINT NOT NULL,
    "cancelled" BOOLEAN NOT NULL,
    "content_hash" TEXT NOT NULL,
    "first_seen_at" TIMESTAMPTZ(6) NOT NULL,
    "changed_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "dux_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dux_invoice_items" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "line" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "dux_item_kind" NOT NULL,
    "base_code" TEXT NOT NULL,
    "pack_quantity" INTEGER,
    "name" TEXT NOT NULL,
    "quantity" DECIMAL(18,8) NOT NULL,
    "unit_price_cents" BIGINT NOT NULL,
    "discount_pct" DECIMAL(7,4) NOT NULL,
    "vat_pct" DECIMAL(7,4) NOT NULL,
    "cost_cents" BIGINT NOT NULL,

    CONSTRAINT "dux_invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dux_customers" (
    "id" UUID NOT NULL,
    "dux_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "normalized_phone" TEXT,
    "email" TEXT,
    "province" TEXT,
    "city" TEXT,
    "enabled" BOOLEAN NOT NULL,
    "created_on" DATE,
    "content_hash" TEXT NOT NULL,
    "first_seen_at" TIMESTAMPTZ(6) NOT NULL,
    "changed_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "dux_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_runs" (
    "id" UUID NOT NULL,
    "integration" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "status" "sync_run_status" NOT NULL,
    "trigger" TEXT NOT NULL,
    "triggered_by" TEXT,
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "finished_at" TIMESTAMPTZ(6),
    "calls" INTEGER NOT NULL DEFAULT 0,
    "records" INTEGER NOT NULL DEFAULT 0,
    "detail" TEXT,

    CONSTRAINT "sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dux_items_code_key" ON "dux_items"("code");

-- CreateIndex
CREATE INDEX "dux_items_base_code_idx" ON "dux_items"("base_code");

-- CreateIndex
CREATE INDEX "dux_items_normalized_code_idx" ON "dux_items"("normalized_code");

-- CreateIndex
CREATE UNIQUE INDEX "dux_invoices_dux_id_key" ON "dux_invoices"("dux_id");

-- CreateIndex
CREATE INDEX "dux_invoices_issued_on_idx" ON "dux_invoices"("issued_on");

-- CreateIndex
CREATE INDEX "dux_invoices_customer_dux_id_idx" ON "dux_invoices"("customer_dux_id");

-- CreateIndex
CREATE INDEX "dux_invoice_items_base_code_idx" ON "dux_invoice_items"("base_code");

-- CreateIndex
CREATE UNIQUE INDEX "dux_invoice_items_invoice_id_line_key" ON "dux_invoice_items"("invoice_id", "line");

-- CreateIndex
CREATE UNIQUE INDEX "dux_customers_dux_id_key" ON "dux_customers"("dux_id");

-- CreateIndex
CREATE INDEX "dux_customers_normalized_phone_idx" ON "dux_customers"("normalized_phone");

-- CreateIndex
CREATE INDEX "sync_runs_integration_started_at_idx" ON "sync_runs"("integration", "started_at" DESC);

-- AddForeignKey
ALTER TABLE "dux_invoice_items" ADD CONSTRAINT "dux_invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "dux_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

