-- CreateTable
CREATE TABLE "ticket_histories" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "actor_id" TEXT,
    "actor_name" TEXT,
    "changed_field" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_conversations" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "conversation_id" BIGINT NOT NULL,
    "body" TEXT,
    "body_text" TEXT,
    "from_email" TEXT,
    "actor_name" TEXT,
    "is_agent" BOOLEAN NOT NULL DEFAULT false,
    "response_time_minutes" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_group_movements" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "from_group_id" TEXT,
    "to_group_id" TEXT,
    "moved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "moved_by" TEXT,

    CONSTRAINT "ticket_group_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ticket_histories_ticket_id_idx" ON "ticket_histories"("ticket_id");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_conversations_conversation_id_key" ON "ticket_conversations"("conversation_id");

-- CreateIndex
CREATE INDEX "ticket_conversations_ticket_id_idx" ON "ticket_conversations"("ticket_id");

-- CreateIndex
CREATE INDEX "ticket_group_movements_ticket_id_idx" ON "ticket_group_movements"("ticket_id");

-- AddForeignKey
ALTER TABLE "ticket_histories" ADD CONSTRAINT "ticket_histories_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_conversations" ADD CONSTRAINT "ticket_conversations_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_group_movements" ADD CONSTRAINT "ticket_group_movements_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
