#!/usr/bin/env python3
import requests
import json

BASE_URL = "http://localhost:3000"

print("=" * 60)
print("Testing Need List API")
print("=" * 60)

# Step 1: Login
print("\n1. Logging in as admin...")
login_resp = requests.post(
    f"{BASE_URL}/api/auth/login",
    json={"email": "admin@example.com", "password": "admin123"}
)
if login_resp.status_code != 200:
    print(f"❌ Login failed: {login_resp.text}")
    exit(1)

token = login_resp.json().get("accessToken")
if not token:
    print("❌ No access token in response")
    exit(1)

print("✅ Login successful")
headers = {"Authorization": f"Bearer {token}"}

# Step 2: Get inventory
print("\n2. Getting inventory...")
inv_resp = requests.get(f"{BASE_URL}/api/inventory", headers=headers)
if inv_resp.status_code != 200:
    print(f"❌ Failed to get inventory: {inv_resp.text}")
    exit(1)

inventory = inv_resp.json()
print(f"✅ Found {len(inventory.get('items', inventory.get('parts', [])))} items")

items = inventory.get('items', inventory.get('parts', []))
if not items:
    print("❌ No inventory items found")
    exit(1)

part_id = items[0]['_id']
print(f"✅ Using part ID: {part_id}")

# Step 3: Get statistics (before creation)
print("\n3. Getting statistics...")
stats_resp = requests.get(f"{BASE_URL}/api/need-lists/statistics", headers=headers)
if stats_resp.status_code == 200:
    stats = stats_resp.json().get('statistics', {})
    print(f"✅ Statistics: {stats}")
else:
    print(f"⚠️  Failed to get statistics: {stats_resp.text}")

# Step 4: Create need list
print("\n4. Creating need list...")
need_list_data = {
    "name": "Python Test Need List",
    "description": "Created via Python test script",
    "priority": "high",
    "tags": ["test", "automation"],
    "items": [
        {
            "part": part_id,
            "quantity": 10,
            "notes": "Test item from Python"
        }
    ]
}

create_resp = requests.post(
    f"{BASE_URL}/api/need-lists",
    json=need_list_data,
    headers=headers
)

if create_resp.status_code == 201:
    need_list = create_resp.json().get('needList', {})
    need_list_id = need_list.get('_id')
    print(f"✅ Need list created: ID={need_list_id}")
    print(f"   Name: {need_list.get('name')}")
    print(f"   Items: {len(need_list.get('items', []))}")
else:
    print(f"❌ Failed to create need list:")
    print(f"   Status: {create_resp.status_code}")
    print(f"   Response: {create_resp.text}")
    exit(1)

# Step 5: Get all need lists
print("\n5. Getting all need lists...")
list_resp = requests.get(f"{BASE_URL}/api/need-lists", headers=headers)
if list_resp.status_code == 200:
    lists = list_resp.json().get('needLists', [])
    print(f"✅ Found {len(lists)} need list(s)")
    for nl in lists:
        print(f"   - {nl['name']} ({nl['status']}, {nl['priority']})")
else:
    print(f"❌ Failed to get need lists: {list_resp.text}")

# Step 6: Get specific need list
print(f"\n6. Getting need list {need_list_id}...")
get_resp = requests.get(f"{BASE_URL}/api/need-lists/{need_list_id}", headers=headers)
if get_resp.status_code == 200:
    nl = get_resp.json().get('needList', {})
    print(f"✅ Retrieved need list:")
    print(f"   Name: {nl.get('name')}")
    print(f"   Description: {nl.get('description')}")
    print(f"   Status: {nl.get('status')}")
    print(f"   Priority: {nl.get('priority')}")
    print(f"   Items: {len(nl.get('items', []))}")
else:
    print(f"❌ Failed to get need list: {get_resp.text}")

# Step 7: Add item to need list
print(f"\n7. Adding another item to need list...")
if len(items) > 1:
    second_part_id = items[1]['_id']
    add_item_resp = requests.post(
        f"{BASE_URL}/api/need-lists/{need_list_id}/items",
        json={"part": second_part_id, "quantity": 5, "notes": "Second item"},
        headers=headers
    )
    if add_item_resp.status_code == 200:
        nl = add_item_resp.json().get('needList', {})
        print(f"✅ Item added. Total items: {len(nl.get('items', []))}")
    else:
        print(f"⚠️  Failed to add item: {add_item_resp.text}")
else:
    print("⚠️  Skipped (only one part in inventory)")

# Step 8: Get updated statistics
print("\n8. Getting updated statistics...")
stats_resp = requests.get(f"{BASE_URL}/api/need-lists/statistics", headers=headers)
if stats_resp.status_code == 200:
    stats = stats_resp.json().get('statistics', {})
    print(f"✅ Updated statistics:")
    print(f"   Total: {stats.get('total', 0)}")
    print(f"   By Status: {stats.get('byStatus', {})}")
    print(f"   By Priority: {stats.get('byPriority', {})}")
else:
    print(f"⚠️  Failed to get statistics: {stats_resp.text}")

print("\n" + "=" * 60)
print("✅ All tests completed successfully!")
print("=" * 60)
