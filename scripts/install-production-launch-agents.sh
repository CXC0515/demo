#!/bin/bash
set -euo pipefail

project_root="/Users/cxc/Projects/DEMO"
launch_agents_root="/Users/cxc/Library/LaunchAgents"
templates_root="$project_root/ops/launchd"
data_root="$project_root/var-product"

test -x /usr/local/bin/node
test -x /opt/homebrew/bin/cloudflared
test -f "$project_root/.env"
test -f "$project_root/dist/index.html"
test -f "/Users/cxc/.cloudflared/config.yml"
test -d "$data_root/system"
test -d "$data_root/workspaces"

mkdir -p "$launch_agents_root"
for name in cn.unreached.teacher-dashboard cn.unreached.teacher-dashboard-tunnel cn.unreached.teacher-dashboard-backup; do
  source="$templates_root/$name.plist"
  target="$launch_agents_root/$name.plist"
  /usr/bin/plutil -lint "$source"
  /usr/bin/install -m 600 "$source" "$target"
  /bin/launchctl bootout "gui/$(id -u)" "$target" 2>/dev/null || true
  /bin/launchctl bootstrap "gui/$(id -u)" "$target"
done

echo '{"event":"production_launch_agents_installed"}'
