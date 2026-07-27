#!/bin/bash
# Test script for Live Tracking system

BASE_URL="http://localhost:3000"

echo "🧪 Testing Live Tracking Backend..."
echo ""

# Test 1: Send a page_view event
echo "📄 Sending test events..."
curl -s -X POST "$BASE_URL/api/track" \
  -H "Content-Type: application/json" \
  -d '{
    "event_name": "page_view",
    "page_url": "http://localhost:5173/",
    "page_path": "/",
    "page_title": "Home - McRepair",
    "browser": "Chrome",
    "os": "macOS",
    "device_type": "desktop",
    "session_id": "test-session-001",
    "visitor_id": "test-visitor-001"
  }'

sleep 1

curl -s -X POST "$BASE_URL/api/track" \
  -H "Content-Type: application/json" \
  -d '{
    "event_name": "page_view",
    "page_url": "http://localhost:5173/webshop",
    "page_path": "/webshop",
    "page_title": "WebShop",
    "utm_source": "google",
    "browser": "Firefox",
    "os": "Windows",
    "device_type": "desktop",
    "session_id": "test-session-002",
    "visitor_id": "test-visitor-002"
  }'

echo ""
echo "✅ Test events sent! Check /admin/live-tracking"
