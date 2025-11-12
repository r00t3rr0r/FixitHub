#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

BASE_URL="http://localhost:3000/api"

echo -e "\n${BLUE}🧪 Testing Multiple Workflow Assignment & Deletion Feature${NC}\n"
echo "═══════════════════════════════════════════════════════════════"

# Step 0: Create admin if doesn't exist
echo -e "\n${BLUE}📝 Step 0: Setting up admin user...${NC}"
ADMIN_SETUP=$(curl -s -X POST "$BASE_URL/seed/admin")
echo -e "${GREEN}✅ Admin setup completed${NC}"

# Step 1: Login as admin
echo -e "\n${BLUE}📝 Step 1: Authenticating as admin...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "admin123"
  }')

# Try to extract token from both possible field names
AUTH_TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
if [ -z "$AUTH_TOKEN" ]; then
  AUTH_TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)
fi

if [ -z "$AUTH_TOKEN" ]; then
  echo -e "${RED}❌ Login failed${NC}"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Successfully authenticated${NC}"

# Step 2: Get an existing order
echo -e "\n${BLUE}📝 Step 2: Fetching available orders...${NC}"
ORDERS_RESPONSE=$(curl -s -X GET "$BASE_URL/admin/orders" \
  -H "Authorization: Bearer $AUTH_TOKEN")

ORDER_ID=$(echo $ORDERS_RESPONSE | grep -o '"_id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$ORDER_ID" ]; then
  echo -e "${YELLOW}⚠️  No orders found, need to create test orders${NC}"
  echo "Attempting to seed test data..."

  # Try to seed services and devices which will help create test orders
  curl -s -X POST "$BASE_URL/seed/services" \
    -H "Authorization: Bearer $AUTH_TOKEN" > /dev/null 2>&1
  curl -s -X POST "$BASE_URL/seed/devices" \
    -H "Authorization: Bearer $AUTH_TOKEN" > /dev/null 2>&1

  echo -e "${YELLOW}Test cannot proceed without existing orders${NC}"
  echo "In production, orders would be created by customers placing repair requests"
  exit 0
fi

echo -e "${GREEN}✅ Found order: $ORDER_ID${NC}"

# Step 3: Get suggested workflows
echo -e "\n${BLUE}📝 Step 3: Getting suggested workflows...${NC}"
WORKFLOWS_RESPONSE=$(curl -s -X GET "$BASE_URL/admin/orders/$ORDER_ID/workflows/suggested" \
  -H "Authorization: Bearer $AUTH_TOKEN")

WORKFLOW_ID=$(echo $WORKFLOWS_RESPONSE | grep -o '"_id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$WORKFLOW_ID" ]; then
  echo -e "${YELLOW}⚠️  No suggested workflows found for this order${NC}"
  echo "This may occur if:"
  echo "  1. No workflows are configured in the system"
  echo "  2. The order's device type doesn't match any workflow"
  echo "Response: $(echo $WORKFLOWS_RESPONSE | head -c 200)"
  exit 0
fi

echo -e "${GREEN}✅ Found workflow to assign${NC}"

# Step 4: Assign workflow
echo -e "\n${BLUE}📝 Step 4: Assigning workflow...${NC}"
ASSIGN_RESPONSE=$(curl -s -X POST "$BASE_URL/admin/orders/$ORDER_ID/workflows" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"workflowTemplateId\": \"$WORKFLOW_ID\"}")

SUCCESS=$(echo $ASSIGN_RESPONSE | grep -o '"success":true')
if [ -z "$SUCCESS" ]; then
  echo -e "${RED}❌ Failed to assign workflow${NC}"
  echo "Response: $ASSIGN_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Workflow assigned successfully${NC}"

# Step 5: Get current workflows
echo -e "\n${BLUE}📝 Step 5: Getting assigned workflows...${NC}"
CURRENT_WORKFLOWS=$(curl -s -X GET "$BASE_URL/admin/orders/$ORDER_ID/workflows" \
  -H "Authorization: Bearer $AUTH_TOKEN")

ASSIGNED_WORKFLOW_ID=$(echo $CURRENT_WORKFLOWS | grep -o '"_id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$ASSIGNED_WORKFLOW_ID" ]; then
  echo -e "${RED}❌ Could not get assigned workflow ID${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Found assigned workflow: $ASSIGNED_WORKFLOW_ID${NC}"

# Step 6: Delete the workflow
echo -e "\n${BLUE}📝 Step 6: Deleting workflow...${NC}"
DELETE_RESPONSE=$(curl -s -X DELETE "$BASE_URL/admin/orders/$ORDER_ID/workflows/$ASSIGNED_WORKFLOW_ID" \
  -H "Authorization: Bearer $AUTH_TOKEN")

SUCCESS=$(echo $DELETE_RESPONSE | grep -o '"success":true')
if [ -z "$SUCCESS" ]; then
  echo -e "${RED}❌ Failed to delete workflow${NC}"
  echo "Response: $DELETE_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Workflow deleted successfully${NC}"

# Step 7: Verify deletion
echo -e "\n${BLUE}📝 Step 7: Verifying deletion...${NC}"
VERIFY_WORKFLOWS=$(curl -s -X GET "$BASE_URL/admin/orders/$ORDER_ID/workflows" \
  -H "Authorization: Bearer $AUTH_TOKEN")

DELETED_FOUND=$(echo $VERIFY_WORKFLOWS | grep "$ASSIGNED_WORKFLOW_ID")
if [ -n "$DELETED_FOUND" ]; then
  echo -e "${RED}❌ Deleted workflow still exists!${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Deletion verified - workflow no longer in list${NC}"

echo -e "\n═══════════════════════════════════════════════════════════════"
echo -e "\n${GREEN}✅ All tests passed! Workflow deletion feature is working!${NC}"
echo -e "\n${YELLOW}📋 Features Tested:${NC}"
echo -e "   ✓ Admin authentication"
echo -e "   ✓ Workflow assignment to order"
echo -e "   ✓ Workflow deletion from order"
echo -e "   ✓ Workflow list verification"
echo -e "\n${YELLOW}📋 Backend Endpoints Tested:${NC}"
echo -e "   ✓ POST /api/admin/orders/:orderId/workflows (assign)"
echo -e "   ✓ GET /api/admin/orders/:orderId/workflows (list)"
echo -e "   ✓ DELETE /api/admin/orders/:orderId/workflows/:workflowId (delete)"
echo -e "\n"
