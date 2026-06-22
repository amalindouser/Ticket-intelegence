CREATE TABLE "evidences" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "ticket_id" BIGINT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "file_size" INTEGER,
    "file_path" TEXT NOT NULL,
    "extracted_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "evidences_ticket_id_idx" ON "evidences" ("ticket_id");
CREATE INDEX "evidences_file_type_idx" ON "evidences" ("file_type");
