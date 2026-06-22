-- AlterTable
ALTER TABLE "attachments" ADD COLUMN     "escalation_id" UUID,
ALTER COLUMN "ticket_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_escalation_id_fkey" FOREIGN KEY ("escalation_id") REFERENCES "escalations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
