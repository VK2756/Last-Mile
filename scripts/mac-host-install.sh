#!/usr/bin/env bash
# Installs (or removes with "uninstall") three macOS launch agents: the engine supervisor and two Tailscale funnels.
set -eu
REPO="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$HOME/Library/LaunchAgents"; LOG="$HOME/Library/Logs"
TS="$(command -v tailscale || echo /Applications/Tailscale.app/Contents/MacOS/Tailscale)"
E=com.lastmile.engine; F=com.lastmile.funnel; P=com.lastmile.phone-funnel
if [ "${1:-}" = "uninstall" ]; then
  for l in $E $F $P; do launchctl bootout "gui/$(id -u)/$l" 2>/dev/null || true; rm -f "$DIR/$l.plist"; done
  "$TS" funnel --https=443 off 2>/dev/null || true
  "$TS" funnel --https=8443 off 2>/dev/null || true
  echo "removed"; exit 0
fi
mkdir -p "$DIR" "$LOG"
cat > "$DIR/$E.plist" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>$E</string>
<key>ProgramArguments</key><array><string>/bin/bash</string><string>$REPO/scripts/mac-host.sh</string></array>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
<key>StandardOutPath</key><string>$LOG/lastmile-engine.log</string><key>StandardErrorPath</key><string>$LOG/lastmile-engine.log</string>
</dict></plist>
PL
cat > "$DIR/$F.plist" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>$F</string>
<key>ProgramArguments</key><array><string>$TS</string><string>funnel</string><string>--bg</string><string>8080</string></array>
<key>RunAtLoad</key><true/>
<key>StandardOutPath</key><string>$LOG/lastmile-funnel.log</string><key>StandardErrorPath</key><string>$LOG/lastmile-funnel.log</string>
</dict></plist>
PL
cat > "$DIR/$P.plist" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>$P</string>
<key>ProgramArguments</key><array><string>$TS</string><string>funnel</string><string>--bg</string><string>--https=8443</string><string>8443</string></array>
<key>RunAtLoad</key><true/>
<key>StandardOutPath</key><string>$LOG/lastmile-phone-funnel.log</string><key>StandardErrorPath</key><string>$LOG/lastmile-phone-funnel.log</string>
</dict></plist>
PL
for l in $E $F $P; do launchctl bootout "gui/$(id -u)/$l" 2>/dev/null || true; launchctl bootstrap "gui/$(id -u)" "$DIR/$l.plist"; done
echo "installed. logs: $LOG/lastmile-engine.log"
