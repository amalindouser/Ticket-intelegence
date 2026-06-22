-- AlterTable
ALTER TABLE "attachments" ADD COLUMN     "file_size" INTEGER;

-- AlterTable
ALTER TABLE "escalations" ADD COLUMN     "agent_name" TEXT;

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "assigned_agent" TEXT,
ADD COLUMN     "assigned_group" TEXT,
ADD COLUMN     "tags" TEXT;

-- CreateTable
CREATE TABLE "ticket_history" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "field_name" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_logs" (
    "id" UUID NOT NULL,
    "sync_type" TEXT NOT NULL,
    "total_ticket" INTEGER NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "finished_at" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "error_message" TEXT,

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ticket_history" ADD CONSTRAINT "ticket_history_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
