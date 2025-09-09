echo "==> Polling for access token (approve in the browser if you haven't yet)..."
ACCESS_TOKEN=""
ATTEMPTS=0
MAX_ATTEMPTS=200  # ~10-15 minutes depending on INTERVAL

while (( ATTEMPTS < MAX_ATTEMPTS )); do
  set +e
  TOKEN_JSON=$(aws sso-oidc create-token \
    --client-id "$CLIENT_ID" \
    --client-secret "$CLIENT_SECRET" \
    --grant-type "urn:ietf:params:oauth:grant-type:device_code" \
    --device-code "$DEVICE_CODE" \
    --region "$REGION" 2>&1)
  STATUS=$?
  set -e

  if [ $STATUS -eq 0 ]; then
    ACCESS_TOKEN=$(jq -r '.accessToken // empty' <<<"$TOKEN_JSON")
    if [ -n "$ACCESS_TOKEN" ]; then
      echo "    Got access token."
      break
    fi
  else
    # Normalize to lower for matching
    L=$(tr '[:upper:]' '[:lower:]' <<<"$TOKEN_JSON")
    if grep -q "authorizationpendingexception\|authorization_pending" <<<"$L"; then
      sleep "$INTERVAL"
      ((ATTEMPTS++))
      continue
    elif grep -q "slowdownexception\|slow_down" <<<"$L"; then
      sleep $((INTERVAL + 2))
      ((ATTEMPTS++))
      continue
    elif grep -q "expiredtokenexception" <<<"$L"; then
      echo "Device code expired. Re-run the script to start a new device flow." >&2
      exit 1
    else
      echo "ERROR from create-token:"
      echo "$TOKEN_JSON" >&2
      exit 1
    fi
  fi
done

if [ -z "$ACCESS_TOKEN" ]; then
  echo "Timed out waiting for device authorization." >&2
  exit 1
fi
