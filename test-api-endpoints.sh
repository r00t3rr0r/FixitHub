#!/bin/bash
echo "🔐 Step 1: Creating admin user if needed..."
cd server && npm run seed 2>&1 | grep -E "(Admin|Successfully)" | head -5
cd ..

echo ""
echo "🔐 Step 2: Logging in as admin..."
TOKEN_RESPONSE=$(curl -s -X POST 'http://localhost:3000/api/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@fixithub.com","password":"admin123"}')

echo "$TOKEN_RESPONSE" | head -c 200
echo ""
echo ""

TOKEN=$(echo "$TOKEN_RESPONSE" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Login failed! No token received."
  echo "Full response:"
  echo "$TOKEN_RESPONSE"
  exit 1
fi

echo "✅ Token received: ${TOKEN:0:30}..."
echo ""

echo "📡 Step 3: Testing /api/admin/live-tracking/summary..."
SUMMARY=$(curl -s "http://localhost:3000/api/admin/live-tracking/summary?minutes=30" \
  -H "Authorization: Bearer $TOKEN")
echo "$SUMMARY" | head -c 500
echo ""
echo ""

echo "📡 Step 4: Testing /api/admin/live-tracking/active-sessions..."
SESSIONS=$(curl -s "http://localhost:3000/api/admin/live-tracking/active-sessions?minutes=30" \
  -H "Authorization: Bearer $TOKEN")
echo "Sessions response (first 500 chars):"
echo "$SESSIONS" | head -c 500
echo ""
echo ""

echo "📡 Step 5: Testing /api/admin/live-tracking/events..."
EVENTS=$(curl -s "http://localhost:3000/api/admin/live-tracking/events?limit=5&minutes=30" \
  -H "Authorization: Bearer $TOKEN")
echo "Events response (first 500 chars):"
echo "$EVENTS" | head -c 500
echo ""

