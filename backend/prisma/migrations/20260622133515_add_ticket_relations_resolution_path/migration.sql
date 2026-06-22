-- AlterTable
ALTER TABLE "evidences" ADD COLUMN     "conversation_id" BIGINT,
ADD COLUMN     "source" TEXT DEFAULT 'ticket';

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "parent_ticket_id" UUID,
ADD COLUMN     "resolution_path" TEXT DEFAULT 'unknown';

-- CreateIndex
CREATE INDEX "evidences_conversation_id_idx" ON "evidences"("conversation_id");

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_parent_ticket_id_fkey" FOREIGN KEY ("parent_ticket_id") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
