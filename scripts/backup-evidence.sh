#!/bin/bash
# Backup evidence files + database
# Usage: ./scripts/backup-evidence.sh [output_dir]

set -e
OUTPUT="${1:-/tmp/fti-backup-$(date +%Y%m%d)}"
mkdir -p "$OUTPUT"

echo "=== FTI Backup to $OUTPUT ==="

# 1. Evidence files
EVIDENCE_DIR="backend/uploads/evidence"
if [ -d "$EVIDENCE_DIR" ]; then
  echo "Archiving evidence files..."
  tar czf "$OUTPUT/evidence.tar.gz" -C "$(dirname "$EVIDENCE_DIR")" "$(basename "$EVIDENCE_DIR")"
  echo "  -> $(du -h "$OUTPUT/evidence.tar.gz" | cut -f1)"
fi

# 2. Database dump
echo "Dumping database..."
PGPASSWORD="${DB_PASSWORD:?DB_PASSWORD environment variable required}" pg_dump \
  -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5433}" \
  -U "${DB_USER:-fti_user}" -d "${DB_NAME:-freshdesk_ticket_intelegence}" \
  -F c -f "$OUTPUT/database.dump"
echo "  -> $(du -h "$OUTPUT/database.dump" | cut -f1)"

# 3. Cleanup: remove evidence files not referenced in DB (optional)
echo ""
echo "Backup complete: $OUTPUT"
echo "  $(du -sh "$OUTPUT" | cut -f1) total"
