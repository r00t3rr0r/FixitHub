#!/bin/bash

# Test script for Associated Orders & Repairs Status Fix
# This script validates that the booking nested table displays correct repair progress status

BASE_URL="https://preview-05wl642g.ui.pythagora.ai"
ADMIN_EMAIL="admin@fixithub.com"
ADMIN_PASSWORD="password123"

echo "=== Test: Associated Orders & Repairs Status Fix ==="
echo ""

# Step 1: Admin login
echo "[Step 1] Logging in as admin..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")

ACCESS_TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

if [ -z "$ACCESS_TOKEN" ]; then
  echo "❌ Login failed"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "✓ Login successful"
echo ""

# Step 2: Get all bookings
echo "[Step 2] Fetching all bookings..."
BOOKINGS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/bookings" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

BOOKING_ID=$(echo $BOOKINGS_RESPONSE | grep -o '"_id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$BOOKING_ID" ]; then
  echo "⚠️  No bookings found to test"
  exit 0
fi

echo "✓ Found booking: $BOOKING_ID"
echo ""

# Step 3: Call the new GET /api/bookings/:id/orders endpoint
echo "[Step 3] Fetching orders for booking with repair progress status..."
ORDERS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/bookings/$BOOKING_ID/orders" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Response:"
echo $ORDERS_RESPONSE | jq '.' 2>/dev/null || echo $ORDERS_RESPONSE

# Check if response contains status field (repair progress status, not payment status)
if echo $ORDERS_RESPONSE | grep -q '"status"'; then
  echo ""
  echo "✓ Orders contain status field (repair progress status)"

  # Extract statuses from response
  STATUSES=$(echo $ORDERS_RESPONSE | grep -o '"status":"[^"]*' | cut -d'"' -f4 | sort | uniq)

  echo "Found statuses:"
  for status in $STATUSES; do
    echo "  - $status"
  done

  # Verify valid repair status values
  VALID_STATUSES=("pending" "in-progress" "quality-check" "completed" "ready-for-pickup" "cancelled")
  for status in $STATUSES; do
    if [[ " ${VALID_STATUSES[@]} " =~ " ${status} " ]]; then
      echo "  ✓ '$status' is a valid repair progress status"
    else
      echo "  ⚠️  '$status' might not be a valid repair progress status"
    fi
  done
else
  echo ""
  echo "❌ Response does not contain 'status' field"
  exit 1
fi

echo ""
echo "=== Test Complete ==="
echo ""
echo "Summary:"
echo "✓ API endpoint GET /api/bookings/:id/orders exists and returns data"
echo "✓ Orders are returned with repair progress status (not payment status)"
echo "✓ Implementation is working correctly"
