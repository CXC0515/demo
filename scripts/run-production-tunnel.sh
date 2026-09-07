#!/bin/bash
set -euo pipefail

/opt/homebrew/bin/cloudflared tunnel --config /Users/cxc/.cloudflared/config.yml run 2>&1 \
  | /usr/bin/logger -t cn.unreached.teacher-dashboard-tunnel
