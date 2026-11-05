-- CreateEnum
CREATE TYPE "reactivation_stage" AS ENUM ('m1', 'm2', 'm3', 'm4', 'reactivacion', 'alto_valor');

-- CreateEnum
CREATE TYPE "reactivation_status" AS ENUM ('contactada', 'respondio', 'pospuesta');

-- CreateTable
CREATE TABLE "reactivation_contacts" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "contacted_on" DATE NOT NULL,
    "stage" "reactivation_stage" NOT NULL,
    "variant" TEXT NOT NULL,
    "status" "reactivation_status" NOT NULL,
    "message" TEXT NOT NULL,
    "responded_on" DATE,
    "actor_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "reactivation_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reactivation_contacts_contacted_on_idx" ON "reactivation_contacts"("contacted_on");

-- CreateIndex
CREATE UNIQUE INDEX "reactivation_contacts_customer_id_contacted_on_key" ON "reactivation_contacts"("customer_id", "contacted_on");

-- AddForeignKey
ALTER TABLE "reactivation_contacts" ADD CONSTRAINT "reactivation_contacts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
