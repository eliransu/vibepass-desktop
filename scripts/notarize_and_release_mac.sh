#!/bin/bash
set -euo pipefail

# This script builds the macOS app, submits the DMG for notarization,
# staples the ticket, and validates the result.
#
# Requirements (env vars):
#   APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID
# Optional:
#   CSC_NAME (Developer ID identity display name)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RELEASE_DIR="$REPO_ROOT/release"

echo "Using repo root: $REPO_ROOT"

APPLE_ID=${APPLE_ID:-}
APPLE_APP_SPECIFIC_PASSWORD=${APPLE_APP_SPECIFIC_PASSWORD:-}
APPLE_TEAM_ID=${APPLE_TEAM_ID:-}

if [[ -z "$APPLE_ID" || -z "$APPLE_APP_SPECIFIC_PASSWORD" || -z "$APPLE_TEAM_ID" ]]; then
  echo "ERROR: APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, and APPLE_TEAM_ID must be set in the environment." >&2
  exit 1
fi

echo "Step 1/5: Building macOS artifacts (electron-builder)"
pushd "$REPO_ROOT" >/dev/null
npm run dist:mac
popd >/dev/null

echo "Step 2/5: Locating latest DMG in $RELEASE_DIR"
DMG_PATH=$(ls -t "$RELEASE_DIR"/*.dmg 2>/dev/null | head -n1 || true)
if [[ -z "${DMG_PATH}" ]]; then
  echo "ERROR: No DMG found in $RELEASE_DIR" >&2
  exit 1
fi
echo "Found DMG: $DMG_PATH"

echo "Step 3/5: Submitting DMG for notarization (this may take a few minutes)"
xcrun notarytool submit "$DMG_PATH" \
  --apple-id "$APPLE_ID" \
  --team-id "$APPLE_TEAM_ID" \
  --password "$APPLE_APP_SPECIFIC_PASSWORD" \
  --wait

echo "Step 4/5: Stapling notarization ticket to DMG"
xcrun stapler staple "$DMG_PATH"

echo "Step 5/5: Validating stapled DMG"
xcrun stapler validate -v "$DMG_PATH"

# Optional: Gatekeeper assessment of the app inside the DMG
MOUNT_DIR=$(mktemp -d -t cloudpass_dmg_mount)
if hdiutil attach -nobrowse -mountpoint "$MOUNT_DIR" "$DMG_PATH" >/dev/null 2>&1; then
  APP_INSIDE="$MOUNT_DIR/cloudpass.dev.app"
  if [[ -d "$APP_INSIDE" ]]; then
    echo "Gatekeeper assessment of app inside DMG: $APP_INSIDE"
    spctl -a -vv "$APP_INSIDE" || true
  fi
  hdiutil detach "$MOUNT_DIR" >/dev/null 2>&1 || true
fi

echo "Done. Stapled DMG ready: $DMG_PATH"
echo "Upload this DMG to your distribution (e.g., S3)."


