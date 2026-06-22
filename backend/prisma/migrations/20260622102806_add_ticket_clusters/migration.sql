/*
  Warnings:

  - Made the column `freshdesk_conversation_id` on table `conversations` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "conversations" ALTER COLUMN "freshdesk_conversation_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "evidences" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "group_mappings" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "knowledge_base" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "reference_emails" ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "ticket_clusters" (
    "id" UUID NOT NULL,
    "ticket_id" BIGINT NOT NULL,
    "cluster_id" INTEGER NOT NULL,
    "cluster_label" TEXT,
    "anomaly_score" DOUBLE PRECISION,
    "method" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_clusters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cluster_metadata" (
    "id" UUID NOT NULL,
    "cluster_id" INTEGER NOT NULL,
    "label" TEXT,
    "top_keywords" TEXT,
    "ticket_count" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cluster_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ticket_clusters_cluster_id_idx" ON "ticket_clusters"("cluster_id");

-- CreateIndex
CREATE INDEX "ticket_clusters_method_idx" ON "ticket_clusters"("method");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_clusters_ticket_id_method_key" ON "ticket_clusters"("ticket_id", "method");

-- CreateIndex
CREATE INDEX "cluster_metadata_method_idx" ON "cluster_metadata"("method");

-- CreateIndex
CREATE UNIQUE INDEX "cluster_metadata_cluster_id_method_key" ON "cluster_metadata"("cluster_id", "method");
