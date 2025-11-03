#!/bin/bash

# Step 1: Login and get token
echo "Step 1: Logging in..."
LOGIN_RESP=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}')

TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys, json; print(json.load(sys.stdin)['accessToken'])" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to get token"
  exit 1
fi

echo "✅ Token obtained"

# Step 2: Get a part ID
echo ""
echo "Step 2: Getting part ID..."
PART_RESP=$(curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/inventory)
PART_ID=$(echo "$PART_RESP" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['parts'][0]['_id'] if data.get('parts') else '')" 2>/dev/null)

if [ -z "$PART_ID" ]; then
  echo "❌ No parts found"
  exit 1
fi

echo "✅ Part ID: $PART_ID"

# Step 3: Create need list
echo ""
echo "Step 3: Creating need list..."
CREATE_RESP=$(curl -s -X POST http://localhost:3000/api/need-lists \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Test Need List\",\"description\":\"API Test\",\"priority\":\"medium\",\"tags\":[\"test\"],\"items\":[{\"part\":\"$PART_ID\",\"quantity\":5,\"notes\":\"Test item\"}]}")

echo "$CREATE_RESP" | python3 -m json.tool 2>/dev/null || echo "$CREATE_RESP"

# Step 4: Get statistics
echo ""
echo "Step 4: Getting statistics..."
STATS_RESP=$(curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/need-lists/statistics)
echo "$STATS_RESP" | python3 -m json.tool 2>/dev/null || echo "$STATS_RESP"

# Step 5: Get all need lists
echo ""
echo "Step 5: Getting all need lists..."
LIST_RESP=$(curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/need-lists)
echo "$LIST_RESP" | python3 -m json.tool 2>/dev/null || echo "$LIST_RESP"

echo ""
echo "✅ Test completed!"
