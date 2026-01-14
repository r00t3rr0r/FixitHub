#!/bin/bash

API_BASE="http://localhost:3000/api"

echo "========================================"
echo "Testing Add-On Service Pagination and Sorting"
echo "========================================"
echo ""

echo "Test 1: Get first page (10 items, sorted by createdAt desc)"
echo "GET /api/addons?page=1&limit=10&sortBy=createdAt&sortOrder=desc"
curl -s "${API_BASE}/addons?page=1&limit=10&sortBy=createdAt&sortOrder=desc" | jq '{
  success: .success,
  totalItems: .pagination.total,
  currentPage: .pagination.page,
  totalPages: .pagination.totalPages,
  itemsReturned: (.addOns | length),
  hasNextPage: .pagination.hasNextPage,
  hasPrevPage: .pagination.hasPrevPage,
  firstService: .addOns[0].name
}'
echo ""

echo "Test 2: Sort by name (ascending)"
echo "GET /api/addons?page=1&limit=5&sortBy=name&sortOrder=asc"
curl -s "${API_BASE}/addons?page=1&limit=5&sortBy=name&sortOrder=asc" | jq '{
  success: .success,
  itemsReturned: (.addOns | length),
  services: [.addOns[] | .name]
}'
echo ""

echo "Test 3: Sort by price (descending)"
echo "GET /api/addons?page=1&limit=5&sortBy=price&sortOrder=desc"
curl -s "${API_BASE}/addons?page=1&limit=5&sortBy=price&sortOrder=desc" | jq '{
  success: .success,
  itemsReturned: (.addOns | length),
  services: [.addOns[] | {name: .name, price: .price}]
}'
echo ""

echo "Test 4: Sort by popularity (descending)"
echo "GET /api/addons?page=1&limit=5&sortBy=popularity&sortOrder=desc"
curl -s "${API_BASE}/addons?page=1&limit=5&sortBy=popularity&sortOrder=desc" | jq '{
  success: .success,
  itemsReturned: (.addOns | length),
  services: [.addOns[] | {name: .name, popularity: .popularity}]
}'
echo ""

echo "Test 5: Get second page"
echo "GET /api/addons?page=2&limit=5&sortBy=name&sortOrder=asc"
curl -s "${API_BASE}/addons?page=2&limit=5&sortBy=name&sortOrder=asc" | jq '{
  success: .success,
  currentPage: .pagination.page,
  itemsReturned: (.addOns | length),
  hasPrevPage: .pagination.hasPrevPage,
  firstServiceOnPage2: .addOns[0].name
}'
echo ""

echo "Test 6: Filter by category (Protection) with pagination"
echo "GET /api/addons?category=Protection&page=1&limit=5&sortBy=name&sortOrder=asc"
curl -s "${API_BASE}/addons?category=Protection&page=1&limit=5&sortBy=name&sortOrder=asc" | jq '{
  success: .success,
  itemsReturned: (.addOns | length),
  totalProtectionServices: .pagination.total,
  services: [.addOns[] | {name: .name, category: .category}]
}'
echo ""

echo "========================================"
echo "✅ ALL TESTS COMPLETED!"
echo "========================================"
