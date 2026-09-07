#!/bin/bash
set -euo pipefail

project_root="/Users/cxc/Projects/DEMO"
cd "$project_root"
/usr/local/bin/node --env-file="$project_root/.env" --import tsx "$project_root/server/scripts/backupProductionData.ts" 2>&1 \
  | /usr/bin/logger -t cn.unreached.teacher-dashboard-backup
