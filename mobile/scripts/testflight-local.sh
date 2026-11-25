#!/bin/bash
# Gera o build de produção do iPhone NESTE Mac (build local não gasta o limite mensal do Expo) e envia ao TestFlight.
# Uso, no Terminal, dentro da pasta do projeto:  ./mobile/scripts/testflight-local.sh
# Precisa: Xcode (App Store), CocoaPods e fastlane (brew install cocoapods fastlane), Node e login na conta Expo (`eas login`).
set -euo pipefail
cd "$(dirname "$0")/.."
if ! xcodebuild -version >/dev/null 2>&1; then
  echo "Falta o Xcode completo (só as Command Line Tools não bastam para app de iPhone)."
  echo "1) Instale o Xcode pela App Store e abra uma vez para aceitar a licença."
  echo "2) Rode: sudo xcode-select -s /Applications/Xcode.app/Contents/Developer"
  exit 1
fi
command -v pod >/dev/null || { echo "Falta o CocoaPods: brew install cocoapods"; exit 1; }
command -v fastlane >/dev/null || { echo "Falta o fastlane: brew install fastlane"; exit 1; }
git pull --ff-only
npm install
npx --yes eas-cli@latest whoami >/dev/null 2>&1 || npx --yes eas-cli@latest login
OUT="$HOME/Desktop/pilinvest-$(date +%Y%m%d-%H%M).ipa"
npx --yes eas-cli@latest build -p ios --profile production --local --non-interactive --output "$OUT"
npx --yes eas-cli@latest submit -p ios --profile production --path "$OUT" --non-interactive
echo "Pronto: enviado ao App Store Connect. Em uns 10 minutos aparece no TestFlight. (Arquivo: $OUT)"
