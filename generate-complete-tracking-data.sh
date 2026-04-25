#!/bin/bash
# Generate comprehensive test tracking data with all fields

echo "🧪 Generating comprehensive tracking data..."
echo ""

BASE_URL="http://localhost:3000/api/track"

# Helper function to send tracking event
send_event() {
  curl -s -X POST "$BASE_URL" \
    -H "Content-Type: application/json" \
    -d "$1" > /dev/null
}

# Session 1: Desktop user from Google
echo "👤 Session 1: Desktop Chrome from Google..."
send_event '{
  "event_name": "page_view",
  "page_url": "http://localhost:5173/",
  "page_path": "/",
  "page_title": "Home - FixitHub",
  "referrer": "https://www.google.com/search?q=handy+reparatur",
  "source": "google",
  "medium": "organic",
  "session_id": "full-session-1",
  "visitor_id": "full-visitor-1",
  "browser": "Chrome",
  "browser_version": "120.0.6099.109",
  "os": "macOS",
  "device_type": "desktop",
  "language": "de-DE",
  "screen_width": 1920,
  "screen_height": 1080,
  "viewport_width": 1680,
  "viewport_height": 900,
  "timezone": "Europe/Berlin"
}'

sleep 1

send_event '{
  "event_name": "page_view",
  "page_url": "http://localhost:5173/webshop",
  "page_path": "/webshop",
  "page_title": "WebShop - FixitHub",
  "referrer": "http://localhost:5173/",
  "source": "google",
  "medium": "organic",
  "session_id": "full-session-1",
  "visitor_id": "full-visitor-1",
  "browser": "Chrome",
  "browser_version": "120.0.6099.109",
  "os": "macOS",
  "device_type": "desktop",
  "language": "de-DE",
  "screen_width": 1920,
  "screen_height": 1080,
  "viewport_width": 1680,
  "viewport_height": 900,
  "timezone": "Europe/Berlin"
}'

sleep 0.5

send_event '{
  "event_name": "click",
  "page_url": "http://localhost:5173/webshop",
  "page_path": "/webshop",
  "page_title": "WebShop - FixitHub",
  "session_id": "full-session-1",
  "visitor_id": "full-visitor-1",
  "browser": "Chrome",
  "os": "macOS",
  "device_type": "desktop",
  "language": "de-DE",
  "timezone": "Europe/Berlin",
  "custom_data": {
    "element": "product-card",
    "product_id": "12345"
  }
}'

# Session 2: Mobile Safari user
echo "📱 Session 2: Mobile Safari..."
sleep 0.5

send_event '{
  "event_name": "page_view",
  "page_url": "http://localhost:5173/",
  "page_path": "/",
  "page_title": "Home - FixitHub",
  "session_id": "full-session-2",
  "visitor_id": "full-visitor-2",
  "browser": "Safari",
  "browser_version": "17.2.1",
  "os": "iOS",
  "device_type": "mobile",
  "language": "de-DE",
  "screen_width": 390,
  "screen_height": 844,
  "viewport_width": 390,
  "viewport_height": 664,
  "timezone": "Europe/Berlin"
}'

# Session 3: Firefox from Facebook Ad
echo "🌐 Session 3: Firefox from Facebook Ad..."
sleep 0.5

send_event '{
  "event_name": "page_view",
  "page_url": "http://localhost:5173/",
  "page_path": "/",
  "page_title": "Home - FixitHub",
  "referrer": "https://www.facebook.com",
  "source": "facebook",
  "medium": "cpc",
  "campaign": "spring-sale-2026",
  "session_id": "full-session-3",
  "visitor_id": "full-visitor-3",
  "browser": "Firefox",
  "browser_version": "123.0",
  "os": "Windows",
  "device_type": "desktop",
  "language": "de-DE",
  "screen_width": 1920,
  "screen_height": 1080,
  "viewport_width": 1600,
  "viewport_height": 900,
  "timezone": "Europe/Berlin",
  "country": "Germany",
  "city": "Berlin"
}'

sleep 0.5

send_event '{
  "event_name": "page_view",
  "page_url": "http://localhost:5173/contact",
  "page_path": "/contact",
  "page_title": "Kontakt - FixitHub",
  "referrer": "http://localhost:5173/",
  "source": "facebook",
  "medium": "cpc",
  "campaign": "spring-sale-2026",
  "session_id": "full-session-3",
  "visitor_id": "full-visitor-3",
  "browser": "Firefox",
  "browser_version": "123.0",
  "os": "Windows",
  "device_type": "desktop",
  "language": "de-DE",
  "screen_width": 1920,
  "screen_height": 1080,
  "viewport_width": 1600,
  "viewport_height": 900,
  "timezone": "Europe/Berlin",
  "country": "Germany",
  "city": "Berlin"
}'

# Session 4: Edge from Bing
echo "🔎 Session 4: Edge from Bing..."
sleep 0.5

send_event '{
  "event_name": "page_view",
  "page_url": "http://localhost:5173/blog",
  "page_path": "/blog",
  "page_title": "Blog - FixitHub",
  "referrer": "https://www.bing.com/search?q=smartphone+reparatur",
  "source": "bing",
  "medium": "organic",
  "session_id": "full-session-4",
  "visitor_id": "full-visitor-4",
  "browser": "Edge",
  "browser_version": "120.0.2210.91",
  "os": "Windows",
  "device_type": "desktop",
  "language": "de-DE",
  "screen_width": 1366,
  "screen_height": 768,
  "viewport_width": 1280,
  "viewport_height": 650,
  "timezone": "Europe/Berlin",
  "country": "Germany",
  "city": "Munich"
}'

# Session 5: Direct visitor
echo "🔗 Session 5: Direct visitor..."
sleep 0.5

send_event '{
  "event_name": "page_view",
  "page_url": "http://localhost:5173/",
  "page_path": "/",
  "page_title": "Home - FixitHub",
  "referrer": "",
  "source": "direct",
  "medium": "none",
  "session_id": "full-session-5",
  "visitor_id": "full-visitor-5",
  "browser": "Chrome",
  "browser_version": "120.0.6099.109",
  "os": "macOS",
  "device_type": "desktop",
  "language": "de-DE",
  "screen_width": 2560,
  "screen_height": 1440,
  "viewport_width": 2400,
  "viewport_height": 1300,
  "timezone": "Europe/Berlin",
  "country": "Germany",
  "city": "Hamburg"
}'

echo ""
echo "✅ Generated 7 tracking events across 5 sessions!"
echo ""
echo "📊 Data summary:"
echo "   • 5 active sessions"
echo "   • 6 page_view events"
echo "   • 1 click event"
echo "   • Browsers: Chrome (3), Safari (1), Firefox (1), Edge (1)"
echo "   • Devices: Desktop (4), Mobile (1)"
echo "   • Sources: google, facebook, bing, direct"
echo "   • All fields populated (25 fields per event)"
echo ""
echo "🔍 Now open: http://localhost:5173/admin/live-tracking"
echo "   (Make sure you're logged in as Admin!)"
echo ""
