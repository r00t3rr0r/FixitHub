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

# Step 1: Login as admin
echo -e "\n${BLUE}📝 Step 1: Authenticating as admin...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@fixithub.com",
    "password": "Admin123!"
  }')

AUTH_TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$AUTH_TOKEN" ]; then
  echo -e "${RED}❌ Login failed${NC}"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Successfully logged in as admin${NC}"

# Step 2: Get an existing order
echo -e "\n${BLUE}📝 Step 2: Fetching available orders...${NC}"
ORDERS_RESPONSE=$(curl -s -X GET "$BASE_URL/admin/orders" \
  -H "Authorization: Bearer $AUTH_TOKEN")

ORDER_ID=$(echo $ORDERS_RESPONSE | grep -o '"_id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$ORDER_ID" ]; then
  echo -e "${RED}❌ No orders found${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Found order: $ORDER_ID${NC}"

# Step 3: Get suggested workflows
echo -e "\n${BLUE}📝 Step 3: Getting suggested workflows...${NC}"
WORKFLOWS_RESPONSE=$(curl -s -X GET "$BASE_URL/admin/orders/$ORDER_ID/workflows/suggested" \
  -H "Authorization: Bearer $AUTH_TOKEN")

WORKFLOW_ID=$(echo $WORKFLOWS_RESPONSE | grep -o '"_id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$WORKFLOW_ID" ]; then
  echo -e "${RED}❌ No suggested workflows found${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Found workflows to assign${NC}"

# Step 4: Assign first workflow
echo -e "\n${BLUE}📝 Step 4: Assigning first workflow...${NC}"
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
echo -e "   ✓ Workflow assignment to order"
echo -e "   ✓ Workflow deletion from order"
echo -e "   ✓ Workflow list verification"
echo -e "\n"
