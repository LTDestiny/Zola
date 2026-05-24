#!/bin/sh
set -e

# Login via auth-service directly
echo "=== Step 1: Login ==="
LOGIN=$(wget -q -O- --post-data='{"email":"seed1@zola.app","password":"password123"}' \
    --header='Content-Type: application/json' \
    http://localhost:8081/api/v1/auth/login 2>/dev/null)
echo "$LOGIN" | head -c 200

# Extract token and sessionId using awk  
TOKEN=$(echo "$LOGIN" | awk -F'"accessToken":"' '{print $2}' | awk -F'"' '{print $1}')
SESSION_ID=$(echo "$LOGIN" | awk -F'"sessionId":"' '{print $2}' | awk -F'"' '{print $1}')
USER_ID=$(echo "$LOGIN" | awk -F'"userId":"' '{print $2}' | awk -F'"' '{print $1}')

echo ""
echo "=== Session Info ==="
echo "UserId: $USER_ID"
echo "SessionId: $SESSION_ID"
echo "SessionKey: session:${USER_ID}:${SESSION_ID}"

echo ""
echo "=== Step 2: Call Gateway ==="
RESP=$(wget -q -O- --header="Authorization: Bearer $TOKEN" \
    http://api-gateway:18080/api/v1/chat/conversations 2>/dev/null || echo "WGET_FAILED")
echo "Response: $RESP"
