-- CreateTable
CREATE TABLE "group_mappings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "group_id" TEXT NOT NULL,
    "group_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "group_mappings_group_id_key" ON "group_mappings"("group_id");
