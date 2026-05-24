#!/bin/sh
# Try to connect Redis from api-gateway container
echo "=== Testing Redis from api-gateway ==="
# Use python if available
python3 -c "import socket; s=socket.socket(); s.connect(('redis', 6379)); s.send(b'AUTH redis_pass\r\n'); print(s.recv(100)); s.close()" 2>&1 || echo "python3 failed"
python -c "import socket; s=socket.socket(); s.connect(('redis', 6379)); s.send(b'AUTH redis_pass\r\n'); print(s.recv(100)); s.close()" 2>&1 || echo "python failed"
# Try bash TCP
echo "AUTH redis_pass" > /tmp/redis_test.txt
cat /tmp/redis_test.txt
