#!/bin/sh
LOGIN=$(wget -q -O- --post-data='{"email":"seed1@zola.app","password":"password123"}' \
    --header='Content-Type: application/json' \
    http://localhost:8081/api/v1/auth/login 2>/dev/null)

TOKEN=$(echo "$LOGIN" | awk -F'"accessToken":"' '{print $2}' | awk -F'"' '{print $1}')
echo "Token starts: $(echo "$TOKEN" | cut -c1-40)"

echo "=== Step 2: Fetching Conversations ==="
CONVS=$(wget --auth-no-challenge -q -O- \
    --header="Authorization: Bearer $TOKEN" \
    http://api-gateway:18080/api/v1/chat/conversations 2>/dev/null)

CONV_ID=$(echo "$CONVS" | awk -F'"id":"' '{print $2}' | awk -F'"' '{print $1}')
echo "Conversation ID: $CONV_ID"

if [ -z "$CONV_ID" ]; then
    echo "No conversations found"
    exit 1
fi

echo "=== Step 3: Sending Message ==="
wget --auth-no-challenge -q -S -O- \
    --post-data='{"type":"TEXT","content":"Hello world!"}' \
    --header="Authorization: Bearer $TOKEN" \
    --header='Content-Type: application/json' \
    http://api-gateway:18080/api/v1/chat/conversations/$CONV_ID/messages 2>&1

echo "Done"
