#!/usr/bin/env bash
# Daily pg_dump — keep last 7 local copies as stopgap.
# TODO: add off-VPS transfer (S3, rsync, etc.) once a destination is chosen.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${REPO_DIR}/backups"
COMPOSE_FILE="${REPO_DIR}/docker-compose.prod.yml"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/mytradeledger_${TIMESTAMP}.sql.gz"
TMP_FILE="${BACKUP_FILE}.tmp"

mkdir -p "${BACKUP_DIR}"

# Load compose env vars for POSTGRES_USER / POSTGRES_DB
set -a
# shellcheck source=/dev/null
source "${REPO_DIR}/.env"
set +a

docker compose -f "${COMPOSE_FILE}" exec -T db \
  pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" \
  | gzip > "${TMP_FILE}"

mv "${TMP_FILE}" "${BACKUP_FILE}"
echo "Backup saved: ${BACKUP_FILE}"

# Prune local copies older than 7 days
find "${BACKUP_DIR}" -name "mytradeledger_*.sql.gz" -mtime +7 -delete
echo "Pruned backups older than 7 days"
