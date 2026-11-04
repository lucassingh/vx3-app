-- CreateTable
CREATE TABLE "sync_locks" (
    "integration" TEXT NOT NULL,
    "holder" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sync_locks_pkey" PRIMARY KEY ("integration")
);

