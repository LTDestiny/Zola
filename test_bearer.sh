#!/bin/sh
LOGIN=$(wget -q -O- --post-data='{"email":"seed1@zola.app","password":"password123"}' \
    --header='Content-Type: application/json' \
    http://localhost:8081/api/v1/auth/login 2>/dev/null)

TOKEN=$(echo "$LOGIN" | awk -F'"accessToken":"' '{print $2}' | awk -F'"' '{print $1}')
echo "Token starts: $(echo "$TOKEN" | cut -c1-40)"

echo "=== Testing via gateway with Bearer token ==="
wget --auth-no-challenge -q -S -O- \
    --header="Authorization: Bearer $TOKEN" \
    http://api-gateway:18080/api/v1/chat/conversations 2>&1
echo "Done"
