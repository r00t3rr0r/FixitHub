#!/bin/bash

echo "Testing Need List API endpoints..."
echo ""

# First, let's login as admin to get the token
echo "1. Logging in as admin..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to login - no access token found"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Login successful"
echo ""

# Test 1: Get statistics
echo "2. Getting need list statistics..."
STATS_RESPONSE=$(curl -s -X GET http://localhost:3000/api/need-lists/statistics \
  -H "Authorization: Bearer $TOKEN")

echo "Response: $STATS_RESPONSE"
echo ""

# Test 2: Get all need lists
echo "3. Getting all need lists..."
LIST_RESPONSE=$(curl -s -X GET http://localhost:3000/api/need-lists \
  -H "Authorization: Bearer $TOKEN")

echo "Response: $LIST_RESPONSE"
echo ""

# Test 3: Get parts for creating need list
echo "4. Getting parts list..."
PARTS_RESPONSE=$(curl -s -X GET http://localhost:3000/api/inventory \
  -H "Authorization: Bearer $TOKEN")

FIRST_PART_ID=$(echo $PARTS_RESPONSE | grep -o '"_id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$FIRST_PART_ID" ]; then
  echo "⚠️  No parts found in inventory. Need list creation will require parts."
else
  echo "✅ Found part ID: $FIRST_PART_ID"

  # Test 4: Create a need list
  echo ""
  echo "5. Creating a test need list..."
  CREATE_RESPONSE=$(curl -s -X POST http://localhost:3000/api/need-lists \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"name\": \"Test Need List\",
      \"description\": \"This is a test need list\",
      \"priority\": \"medium\",
      \"tags\": [\"test\"],
      \"items\": [
        {
          \"part\": \"$FIRST_PART_ID\",
          \"quantity\": 5,
          \"notes\": \"Test item\"
        }
      ]
    }")

  echo "Response: $CREATE_RESPONSE"

  NEED_LIST_ID=$(echo $CREATE_RESPONSE | grep -o '"_id":"[^"]*' | head -1 | cut -d'"' -f4)

  if [ -z "$NEED_LIST_ID" ]; then
    echo "⚠️  Failed to create need list"
  else
    echo "✅ Need list created with ID: $NEED_LIST_ID"
  fi
fi

echo ""
echo "API test completed!"
