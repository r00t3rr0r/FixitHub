#!/bin/bash
# Test script for Live Tracking system
# Sends test tracking events to verify backend functionality

BASE_URL="http://localhost:3000"

echo "🧪 Testing Live Tracking Backend..."
echo "=================================="
echo ""

# Test 1: Send a page_view event
echo "📄 Test 1: Sending page_view event..."
curl -s -X POST "$BASE_URL/api/track" \
  -H "Content-Type: application/json" \
  -d '{
    "event_name": "page_view",
    "page_url": "http://localhost:5173/",
    "page_path": "/",
    "page_title": "Home - McRepair",
    "referrer": "",
    "source": "direct",
    "medium": "none",
    "campaign": "",
    "browser": "Chrome",
    "browser_version": "120.0",
    "os": "macOS",
    "device_type": "desktop",
    "viewport_width": 1920,
    "viewport_height": 1080,
    "language": "de-DE",
    "timezone": "Europe/Berlin",
    "session_id": "test-session-001",
    "visitor_id": "test-visitor-001"
  }' | jq '.' || echo "✅ Event sent (response may be empty)"

sleep 1

# Test 2: Send a click event
echo ""
echo "🖱️  Test 2: Sending click event..."
curl -s -X POST "$BASE_URL/api/track" \
  -H "Content-Type: application/json" \
  -d '{
    "event_name": "click",
    "page_url": "http://localhost:5173/",
    "page_path": "/",
    "page_title": "Home - McRepair",
    "custom_data": {
      "element": "button",
      "text": "Jetzt Reparatur anfragen"
    },
    "browser": "Chrome",
    "os": "macOS",
    "device_type": "desktop",
    "session_id": "test-session-001",
    "visitor_id": "test-visitor-001"
  }' | jq '.' || echo "✅ Event sent"

sleep 1

# Test 3: Send events from a different session
echo ""
echo "👤 Test 3: Creating second session..."
curl -s -X POST "$BASE_URL/api/track" \
  -H "Content-Type: application/json" \
  -d '{
    "event_name": "page_view",
    "page_url": "http://localhost:5173/webshop",
    "page_path": "/webshop",
    "page_title": "WebShop - McRepair",
    "referrer": "https://google.com",
    "utm_source": "google",
    "utm_medium": "organic",
    "browser": "Firefox",
    "os": "Windows",
    "device_type": "desktop",
    "session_id": "test-session-002",
    "visitor_id": "test-visitor-002"
  }' | jq '.' || echo "✅ Event sent"

sleep 1

# Test 4: Mobile session
echo ""
echo "📱 Test 4: Creating mobile session..."
curl -s -X POST "$BASE_URL/api/track" \
  -H "Content-Type: application/json" \
  -d '{
    "event_name": "page_view",
    "page_url": "http://localhost:5173/blog",
    "page_path": "/blog",
    "page_title": "Blog - McRepair",
    "browser": "Safari",
    "os": "iOS",
    "device_type": "mobile",
    "viewport_width": 390,
    "viewport_height": 844,
    "session_id": "test-session-003",
    "visitor_id": "test-visitor-003"
  }' | jq '.' || echo "✅ Event sent"

echo ""
echo "=================================="
echo "✅ Test complete!"
echo ""
echo "📊 Now check the Live Tracking admin page:"
echo "   http://localhost:5173/admin/live-tracking"
echo ""
echo "💡 You should see:"
echo "   - 3 active sessions"
echo "   - 4 page views"
echo "   - Top pages: /, /webshop, /blog"
echo "   - Devices: desktop, mobile"
echo "   - Browsers: Chrome, Firefox, Safari"
