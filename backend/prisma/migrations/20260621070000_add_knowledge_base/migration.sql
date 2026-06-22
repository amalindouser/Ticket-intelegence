CREATE TABLE "knowledge_base" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "ticket_id" TEXT NOT NULL,
    "timestamp" TEXT,
    "response_time" TEXT,
    "client_name" TEXT,
    "pic" TEXT,
    "kategori_kendala" TEXT,
    "prioritas" TEXT,
    "deskripsi_masalah" TEXT,
    "status" TEXT,
    "nama_helpdesk" TEXT,
    "root_cause" TEXT,
    "penyelesaian" TEXT,
    "resolution_time" TEXT,
    "close_time" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "knowledge_base_kategori_kendala_idx" ON "knowledge_base" ("kategori_kendala");
CREATE INDEX IF NOT EXISTS "knowledge_base_client_name_idx" ON "knowledge_base" ("client_name");
CREATE INDEX IF NOT EXISTS "knowledge_base_ticket_id_idx" ON "knowledge_base" ("ticket_id");
