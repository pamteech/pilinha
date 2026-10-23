#!/bin/bash
# Gera Pilinha.app (release) só com as Command Line Tools — sem Xcode.
# Uso:  ./Support/build-app.sh            → build/Pilinha.app
#       ./Support/build-app.sh --install  → também copia para ~/Applications e aponta o LaunchAgent
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"
APP="$ROOT/build/Pilinha.app"
VERSION="${VERSION:-0.2.0}"
BUNDLE_ID="com.pamtech.pilinha"

echo "▸ swift build -c release"
swift build -c release --product NotchInvestApp
BIN_DIR="$(swift build -c release --show-bin-path)"

echo "▸ montando $APP"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$BIN_DIR/NotchInvestApp" "$APP/Contents/MacOS/Pilinha"
# bundle de recursos do SwiftPM (sprites do porquinho)
if [ -d "$BIN_DIR/NotchInvest_NotchInvestApp.bundle" ]; then
  cp -R "$BIN_DIR/NotchInvest_NotchInvestApp.bundle" "$APP/Contents/Resources/"
fi
cp Support/AppIcon.icns "$APP/Contents/Resources/AppIcon.icns"

cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Pilinha</string>
  <key>CFBundleDisplayName</key><string>Pilinha</string>
  <key>CFBundleIdentifier</key><string>$BUNDLE_ID</string>
  <key>CFBundleExecutable</key><string>Pilinha</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>$VERSION</string>
  <key>CFBundleVersion</key><string>$VERSION</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>LSMinimumSystemVersion</key><string>14.0</string>
  <key>LSUIElement</key><true/>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSHumanReadableCopyright</key><string>MIT — Pam Tech</string>
</dict>
</plist>
PLIST

# assinatura ad-hoc (local; sem conta de desenvolvedor). Sem sandbox, igual ao swift run.
codesign --force --deep --sign - "$APP" >/dev/null 2>&1 && echo "▸ assinado (ad-hoc)" || echo "! codesign falhou (o app roda mesmo assim)"
echo "✓ $APP"

if [ "${1:-}" = "--install" ]; then
  DEST="$HOME/Applications/Pilinha.app"
  mkdir -p "$HOME/Applications"
  # remove a instalação antiga (NotchInvest), se existir
  OLD_LA="$HOME/Library/LaunchAgents/com.pamtech.notchinvest.plist"
  if [ -f "$OLD_LA" ]; then
    launchctl bootout "gui/$(id -u)" "$OLD_LA" 2>/dev/null || true
    rm -f "$OLD_LA"
  fi
  rm -rf "$HOME/Applications/NotchInvest.app"
  PLIST_LA="$HOME/Library/LaunchAgents/com.pamtech.pilinha.plist"
  launchctl bootout "gui/$(id -u)" "$PLIST_LA" 2>/dev/null || true
  pkill -x Pilinha 2>/dev/null || true; pkill -x NotchInvest 2>/dev/null || true; pkill -x NotchInvestApp 2>/dev/null || true
  rm -rf "$DEST"; cp -R "$APP" "$DEST"
  mkdir -p "$HOME/.notchinvest" "$HOME/Library/LaunchAgents"; chmod 700 "$HOME/.notchinvest"
  cat > "$PLIST_LA" <<LA
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.pamtech.pilinha</string>
  <key>ProgramArguments</key><array><string>$DEST/Contents/MacOS/Pilinha</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
  <key>StandardOutPath</key><string>$HOME/.notchinvest/app.log</string>
  <key>StandardErrorPath</key><string>$HOME/.notchinvest/app.log</string>
</dict>
</plist>
LA
  launchctl bootstrap "gui/$(id -u)" "$PLIST_LA"
  echo "✓ instalado em $DEST e LaunchAgent atualizado (abre sozinho no login)"
fi
