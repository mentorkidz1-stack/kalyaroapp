-- AlterTable
ALTER TABLE "tentatives_eleve" ADD COLUMN     "used_for_diagnostic_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "consumed_attempt_tokens" (
    "jti" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consumed_attempt_tokens_pkey" PRIMARY KEY ("jti")
);
