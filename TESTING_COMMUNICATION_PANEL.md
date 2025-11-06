# Quick Testing Guide - Communication Panel API

This guide provides ready-to-use curl commands to test the Communication Panel functionality.

## Prerequisites

1. Application running: `npm start`
2. Backend API available at: `http://localhost:3000`
3. Test with existing order ID

## Step 1: Authenticate & Get Token

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "password123"
  }' | jq
```

**Expected Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "...",
    "name": "Admin User",
    "email": "admin@example.com",
    "role": "admin"
  }
}
```

Save the token:
```bash
TOKEN="your_token_here"
ORDER_ID="your_order_id_here"
```

## Step 2: Fetch Communication Thread

```bash
curl -X GET http://localhost:3000/api/inspection-communication/$ORDER_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq
```

**Expected Response:**
```json
{
  "communication": {
    "_id": "...",
    "orderId": "...",
    "messages": [],
    "pendingFeedbackCount": 0,
    "pendingActionsCount": 0
  }
}
```

## Step 3: Create a Feedback Request

This is what staff/admin would do to ask customer for approval.

```bash
curl -X POST http://localhost:3000/api/inspection-communication/$ORDER_ID/feedback-request \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "inspectionId": null,
    "question": "Do you approve the $45 battery replacement?",
    "options": [
      {
        "label": "Yes, proceed with the repair",
        "value": "approve"
      },
      {
        "label": "No, I need to think about it",
        "value": "decline"
      },
      {
        "label": "No, cancel this repair",
        "value": "cancel"
      }
    ]
  }' | jq
```

**Expected Response:**
```json
{
  "communication": {
    "_id": "...",
    "messages": [
      {
        "_id": "message_id_here",
        "messageType": "feedback_request",
        "feedbackRequest": {
          "question": "Do you approve the $45 battery replacement?",
          "status": "pending",
          "options": [...]
        }
      }
    ],
    "pendingFeedbackCount": 1
  }
}
```

**Save the message ID:**
```bash
MESSAGE_ID="message_id_from_response"
```

## Step 4: View in UI

1. Open browser to: `http://localhost:3000/orders`
2. Find the test order
3. Click to view order details
4. Scroll to "Device Inspection Report" section
5. You should see the feedback question with Accept/Decline buttons!

## Step 5: Customer Responds to Feedback

This is what customer would do when clicking Accept/Decline button. Use customer token here!

First, get customer token:
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "customer@example.com",
    "password": "password123"
  }' | jq

CUSTOMER_TOKEN="customer_token_here"
```

Then submit response:
```bash
curl -X POST http://localhost:3000/api/inspection-communication/$ORDER_ID/feedback-response \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messageId": "'$MESSAGE_ID'",
    "response": {
      "label": "Yes, proceed with the repair",
      "value": "approve"
    }
  }' | jq
```

**Expected Response:**
```json
{
  "communication": {
    "_id": "...",
    "messages": [
      {
        "_id": "message_id",
        "messageType": "feedback_request",
        "feedbackRequest": {
          "question": "Do you approve the $45 battery replacement?",
          "status": "responded",
          "response": {
            "label": "Yes, proceed with the repair",
            "value": "approve"
          }
        }
      }
    ],
    "pendingFeedbackCount": 0
  }
}
```

## Step 6: Verify UI Update

1. Refresh the order details page in browser
2. Scroll to Device Inspection section
3. Feedback card should now show: "You responded: Yes, proceed with the repair" with green checkmark

## Step 7: Create a Quick Action

```bash
curl -X POST http://localhost:3000/api/inspection-communication/$ORDER_ID/quick-action \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "inspectionId": null,
    "actionType": "part_replacement",
    "description": "Your device requires a battery replacement. This will add $45 to the repair cost.",
    "metadata": {
      "partName": "Battery",
      "estimatedCost": 45
    }
  }' | jq
```

**Valid Action Types:**
- `part_replacement`
- `incorrect_device`
- `incorrect_unlock_code`
- `additional_costs`

**Expected Response:**
```json
{
  "communication": {
    "_id": "...",
    "messages": [
      {
        "_id": "action_message_id",
        "messageType": "quick_action",
        "quickAction": {
          "actionType": "part_replacement",
          "description": "Your device requires a battery replacement...",
          "status": "pending"
        }
      }
    ]
  }
}
```

## Step 8: Verify Quick Action in UI

1. Refresh the order details page
2. Scroll to Device Inspection section
3. You should see the blue quick action card with:
   - Action label
   - Description
   - Sender name
   - Status badge

## Step 9: Get Pending Counts

```bash
curl -X GET http://localhost:3000/api/inspection-communication/$ORDER_ID/pending-feedback \
  -H "Authorization: Bearer $TOKEN" | jq

curl -X GET http://localhost:3000/api/inspection-communication/$ORDER_ID/pending-actions \
  -H "Authorization: Bearer $TOKEN" | jq
```

**Expected Response:**
```json
{
  "count": 0  // or number of pending items
}
```

## Step 10: Mark Messages as Read

```bash
curl -X PUT http://localhost:3000/api/inspection-communication/$ORDER_ID/mark-read \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq
```

---

## Complete Test Flow (Bash Script)

Save this as `test-communication.sh` and run `bash test-communication.sh`:

```bash
#!/bin/bash

# Configuration
API_URL="http://localhost:3000"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="password123"
CUSTOMER_EMAIL="customer@example.com"
CUSTOMER_PASSWORD="password123"

echo "🧪 Testing Communication Panel API"
echo "=================================="

# Step 1: Login as admin
echo -e "\n1️⃣ Authenticating as admin..."
ADMIN_AUTH=$(curl -s -X POST $API_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")

ADMIN_TOKEN=$(echo $ADMIN_AUTH | jq -r '.token')
echo "✅ Admin token received"

# Step 2: Get orders
echo -e "\n2️⃣ Fetching orders..."
ORDERS=$(curl -s -X GET $API_URL/api/orders \
  -H "Authorization: Bearer $ADMIN_TOKEN")

ORDER_ID=$(echo $ORDERS | jq -r '.orders[0]._id')
echo "✅ Using order: $ORDER_ID"

# Step 3: Get communication thread
echo -e "\n3️⃣ Fetching communication thread..."
THREAD=$(curl -s -X GET $API_URL/api/inspection-communication/$ORDER_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN")

echo "✅ Communication thread retrieved"
echo "Current messages: $(echo $THREAD | jq '.communication.messages | length')"

# Step 4: Create feedback request
echo -e "\n4️⃣ Creating feedback request..."
FEEDBACK=$(curl -s -X POST $API_URL/api/inspection-communication/$ORDER_ID/feedback-request \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "inspectionId": null,
    "question": "Do you approve the $45 battery replacement?",
    "options": [
      {"label": "Yes, proceed", "value": "approve"},
      {"label": "No, decline", "value": "decline"}
    ]
  }')

MESSAGE_ID=$(echo $FEEDBACK | jq -r '.communication.messages[-1]._id')
echo "✅ Feedback request created: $MESSAGE_ID"

# Step 5: Login as customer
echo -e "\n5️⃣ Authenticating as customer..."
CUSTOMER_AUTH=$(curl -s -X POST $API_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$CUSTOMER_EMAIL\",\"password\":\"$CUSTOMER_PASSWORD\"}")

CUSTOMER_TOKEN=$(echo $CUSTOMER_AUTH | jq -r '.token')
echo "✅ Customer token received"

# Step 6: Customer responds
echo -e "\n6️⃣ Customer responding to feedback..."
RESPONSE=$(curl -s -X POST $API_URL/api/inspection-communication/$ORDER_ID/feedback-response \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"messageId\": \"$MESSAGE_ID\",
    \"response\": {\"label\": \"Yes, proceed\", \"value\": \"approve\"}
  }")

echo "✅ Response recorded"
echo "Response status: $(echo $RESPONSE | jq '.communication.messages[-1].feedbackRequest.status')"

# Step 7: Create quick action
echo -e "\n7️⃣ Creating quick action..."
ACTION=$(curl -s -X POST $API_URL/api/inspection-communication/$ORDER_ID/quick-action \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "inspectionId": null,
    "actionType": "part_replacement",
    "description": "Battery replacement needed"
  }')

echo "✅ Quick action created"

# Step 8: Get final state
echo -e "\n8️⃣ Final communication state..."
FINAL=$(curl -s -X GET $API_URL/api/inspection-communication/$ORDER_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN")

TOTAL_MESSAGES=$(echo $FINAL | jq '.communication.messages | length')
echo "✅ Total messages: $TOTAL_MESSAGES"
echo "✅ Pending feedback: $(echo $FINAL | jq '.communication.pendingFeedbackCount')"
echo "✅ Pending actions: $(echo $FINAL | jq '.communication.pendingActionsCount')"

echo -e "\n✅ All tests completed successfully!"
```

---

## Troubleshooting

### 401 Unauthorized
- Token has expired
- User not found
- Invalid Bearer token format

**Solution:** Re-authenticate with login endpoint

### 400 Bad Request
- Missing required fields
- Invalid action type
- Invalid option format

**Solution:** Check JSON format and required fields in documentation

### 404 Not Found
- Order ID doesn't exist
- Communication thread not found

**Solution:** Verify order exists and has inspection data

### 500 Server Error
- Database connection issue
- API error

**Solution:** Check server logs and verify MongoDB connection

---

## UI Testing Checklist

After each API call, verify in browser UI:

- [ ] Feedback request card appears with question
- [ ] Accept/Decline buttons display correctly
- [ ] Clicking button shows loading state
- [ ] Response updates UI to show confirmation
- [ ] Quick action card appears with description
- [ ] Multiple messages display properly
- [ ] Panel returns null if no messages
- [ ] Responsive on mobile/tablet

---

## Performance Testing

Test with multiple requests:

```bash
# Create 5 feedback requests
for i in {1..5}; do
  curl -s -X POST http://localhost:3000/api/inspection-communication/$ORDER_ID/feedback-request \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"inspectionId\": null,
      \"question\": \"Test question $i?\",
      \"options\": [{\"label\": \"Yes\", \"value\": \"yes\"}, {\"label\": \"No\", \"value\": \"no\"}]
    }" > /dev/null
  echo "✅ Created feedback request $i"
done
```

Then verify:
- [ ] All 5 messages appear in Communication Panel
- [ ] UI remains responsive
- [ ] No console errors
- [ ] Messages load within acceptable time

---

## Next Steps

1. Run through all test scenarios in COMMUNICATION_PANEL_INTEGRATION_GUIDE.md
2. Test on different browsers and screen sizes
3. Verify error handling with invalid data
4. Check backend logs for any errors or warnings
5. Confirm production deployment is ready
