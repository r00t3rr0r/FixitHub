#!/bin/bash
# Live Tracking Test Script
# Sends test events to populate the dashboard

echo "🧪 Sending test tracking events..."
echo ""

# Session 1: Desktop Chrome user browsing multiple pages
echo "👤 Session 1: Desktop Chrome user..."
curl -s -X POST 'http://localhost:3000/api/track' -H "Content-Type: application/json" -d '{"event_name":"page_view","page_url":"http://localhost:5173/","page_path":"/","page_title":"Home","session_id":"demo-session-1","visitor_id":"demo-visitor-1"}'
sleep 0.5
curl -s -X POST 'http://localhost:3000/api/track' -H "Content-Type: application/json" -d '{"event_name":"page_view","page_url":"http://localhost:5173/webshop","page_path":"/webshop","page_title":"WebShop","session_id":"demo-session-1","visitor_id":"demo-visitor-1"}'
sleep 0.5
curl -s -X POST 'http://localhost:3000/api/track' -H "Content-Type: application/json" -d '{"event_name":"click","page_url":"http://localhost:5173/webshop","page_path":"/webshop","custom_data":{"element":"product-card"},"session_id":"demo-session-1","visitor_id":"demo-visitor-1"}'

# Session 2: Firefox from Google
echo "👤 Session 2: Firefox from Google..."
sleep 0.5
curl -s -X POST 'http://localhost:3000/api/track' -H "Content-Type: application/json" -d '{"event_name":"page_view","page_url":"http://localhost:5173/blog","page_path":"/blog","page_title":"Blog","utm_source":"google","utm_medium":"organic","browser":"Firefox","os":"Windows","device_type":"desktop","session_id":"demo-session-2","visitor_id":"demo-visitor-2"}'

# Session 3: Mobile Safari
echo "👤 Session 3: Mobile Safari user..."
sleep 0.5
curl -s -X POST 'http://localhost:3000/api/track' -H "Content-Type: application/json" -d '{"event_name":"page_view","page_url":"http://localhost:5173/","page_path":"/","page_title":"Home","browser":"Safari","os":"iOS","device_type":"mobile","session_id":"demo-session-3","visitor_id":"demo-visitor-3"}'

# Session 4: Desktop from Facebook
echo "👤 Session 4: From Facebook Ad..."
sleep 0.5
curl -s -X POST 'http://localhost:3000/api/track' -H "Content-Type: application/json" -d '{"event_name":"page_view","page_url":"http://localhost:5173/","page_path":"/","page_title":"Home","utm_source":"facebook","utm_medium":"cpc","utm_campaign":"summer-sale","referrer":"https://facebook.com","session_id":"demo-session-4","visitor_id":"demo-visitor-4"}'

# Session 5: Another page view
echo "👤 Session 5: Contact page visitor..."
sleep 0.5
curl -s -X POST 'http://localhost:3000/api/track' -H "Content-Type: application/json" -d '{"event_name":"page_view","page_url":"http://localhost:5173/contact","page_path":"/contact","page_title":"Kontakt","session_id":"demo-session-5","visitor_id":"demo-visitor-5"}'

echo ""
echo "✅ Test events created!"
echo ""
echo "📊 Now open: http://localhost:5173/admin/live-tracking"
echo ""
echo "You should see:"
echo "  • 5 active sessions"
echo "  • Multiple page views"
echo "  • Top pages: /, /webshop, /blog, /contact"
echo "  • Top referrers: google, facebook"
echo "  • Devices: desktop (4), mobile (1)"
echo "  • Different browsers: Chrome, Firefox, Safari"
echo ""
