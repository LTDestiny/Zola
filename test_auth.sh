#!/bin/sh
# Login
LOGIN=$(wget -q -O- --post-data='{"email":"seed1@zola.app","password":"password123"}' --header='Content-Type: application/json' http://localhost:8081/api/v1/auth/login 2>/dev/null)
TOKEN=$(echo "$LOGIN" | awk -F'"accessToken":"' '{print $2}' | awk -F'"' '{print $1}')
echo "Token: $(echo $TOKEN | cut -c1-60)"

# Call gateway and show response body
echo "--- Gateway Response ---"
wget -q -O- --header="Authorization: Bearer $TOKEN" http://api-gateway:18080/api/v1/chat/conversations 2>/dev/null
echo ""
echo "--- With server response headers ---"
wget -q -O/dev/null -S --header="Authorization: Bearer $TOKEN" http://api-gateway:18080/api/v1/chat/conversations 2>&1
