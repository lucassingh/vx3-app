-- CreateTable
CREATE TABLE "dux_references" (
    "kind" TEXT NOT NULL,
    "dux_id" INTEGER NOT NULL,
    "parent_id" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "read_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "dux_references_pkey" PRIMARY KEY ("kind","parent_id","dux_id")
);

-- CreateTable
CREATE TABLE "catalog_drafts" (
    "id" UUID NOT NULL,
    "data" JSONB NOT NULL,
    "created_by_id" TEXT,
    "created_by_label" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "catalog_drafts_pkey" PRIMARY KEY ("id")
);
