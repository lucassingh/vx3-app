-- CreateTable
CREATE TABLE "integration_credentials" (
    "id" UUID NOT NULL,
    "integration" TEXT NOT NULL,
    "encrypted" TEXT NOT NULL,
    "mask" TEXT NOT NULL,
    "loaded_by_id" UUID NOT NULL,
    "loaded_by_label" TEXT NOT NULL,
    "loaded_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "integration_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "integration_credentials_integration_key" ON "integration_credentials"("integration");

