CREATE TABLE "reference_emails" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "name" TEXT,
    "group_id" TEXT,
    "role" TEXT NOT NULL DEFAULT 'to',
    "source" TEXT NOT NULL DEFAULT 'manual'
);

CREATE UNIQUE INDEX IF NOT EXISTS "reference_emails_email_group_id_role_key" ON "reference_emails" ("email", "group_id", "role");
CREATE INDEX IF NOT EXISTS "reference_emails_group_id_idx" ON "reference_emails" ("group_id");
CREATE INDEX IF NOT EXISTS "reference_emails_email_idx" ON "reference_emails" ("email");
