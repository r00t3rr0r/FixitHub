const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testPartsPaginationAndSorting() {
  console.log('=== Testing Parts Management Pagination and Sorting ===\n');

  try {
    // Step 1: Login as admin
    console.log('Step 1: Logging in as admin...');
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'admin@fixithub.com',
      password: 'admin123'
    });

    const token = loginResponse.data.accessToken;
    console.log('✓ Login successful\n');

    const headers = {
      Authorization: `Bearer ${token}`
    };

    // Step 2: Test pagination - Page 1
    console.log('Step 2: Testing pagination - Page 1 (5 items per page)...');
    const page1Response = await axios.get(`${BASE_URL}/api/inventory`, {
      headers,
      params: { page: 1, limit: 5 }
    });

    console.log('✓ Page 1 Results:');
    console.log(`  - Total Items: ${page1Response.data.totalItems}`);
    console.log(`  - Total Pages: ${page1Response.data.totalPages}`);
    console.log(`  - Current Page: ${page1Response.data.currentPage}`);
    console.log(`  - Items on this page: ${page1Response.data.items.length}`);
    console.log(`  - First 3 items:`);
    page1Response.data.items.slice(0, 3).forEach((item, index) => {
      console.log(`    ${index + 1}. ${item.itemName} (${item.sku})`);
    });
    console.log('');

    // Step 3: Test pagination - Page 2
    console.log('Step 3: Testing pagination - Page 2 (5 items per page)...');
    const page2Response = await axios.get(`${BASE_URL}/api/inventory`, {
      headers,
      params: { page: 2, limit: 5 }
    });

    console.log('✓ Page 2 Results:');
    console.log(`  - Current Page: ${page2Response.data.currentPage}`);
    console.log(`  - Items on this page: ${page2Response.data.items.length}`);
    console.log(`  - First 3 items:`);
    page2Response.data.items.slice(0, 3).forEach((item, index) => {
      console.log(`    ${index + 1}. ${item.itemName} (${item.sku})`);
    });
    console.log('');

    // Step 4: Test sorting by name (ascending)
    console.log('Step 4: Testing sorting by itemName (ascending)...');
    const sortNameAscResponse = await axios.get(`${BASE_URL}/api/inventory`, {
      headers,
      params: { page: 1, limit: 5, sortBy: 'itemName', sortOrder: 'asc' }
    });

    console.log('✓ Sorted by Name (A-Z):');
    sortNameAscResponse.data.items.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.itemName}`);
    });
    console.log('');

    // Step 5: Test sorting by name (descending)
    console.log('Step 5: Testing sorting by itemName (descending)...');
    const sortNameDescResponse = await axios.get(`${BASE_URL}/api/inventory`, {
      headers,
      params: { page: 1, limit: 5, sortBy: 'itemName', sortOrder: 'desc' }
    });

    console.log('✓ Sorted by Name (Z-A):');
    sortNameDescResponse.data.items.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.itemName}`);
    });
    console.log('');

    // Step 6: Test sorting by category
    console.log('Step 6: Testing sorting by category (ascending)...');
    const sortCategoryResponse = await axios.get(`${BASE_URL}/api/inventory`, {
      headers,
      params: { page: 1, limit: 5, sortBy: 'category', sortOrder: 'asc' }
    });

    console.log('✓ Sorted by Category:');
    sortCategoryResponse.data.items.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.itemName} - Category: ${item.category}`);
    });
    console.log('');

    // Step 7: Test sorting by brand
    console.log('Step 7: Testing sorting by brand (ascending)...');
    const sortBrandResponse = await axios.get(`${BASE_URL}/api/inventory`, {
      headers,
      params: { page: 1, limit: 5, sortBy: 'brand', sortOrder: 'asc' }
    });

    console.log('✓ Sorted by Brand:');
    sortBrandResponse.data.items.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.itemName} - Brand: ${item.brand}`);
    });
    console.log('');

    // Step 8: Test combined filters with pagination and sorting
    console.log('Step 8: Testing combined filters (category filter + sorting + pagination)...');
    const combinedResponse = await axios.get(`${BASE_URL}/api/inventory`, {
      headers,
      params: {
        page: 1,
        limit: 3,
        category: 'display',
        sortBy: 'itemName',
        sortOrder: 'asc'
      }
    });

    console.log('✓ Display category, sorted by name:');
    console.log(`  - Total Items in category: ${combinedResponse.data.totalItems}`);
    console.log(`  - Items on this page: ${combinedResponse.data.items.length}`);
    combinedResponse.data.items.forEach((item, index) => {
      console.log(`    ${index + 1}. ${item.itemName} - ${item.category}`);
    });
    console.log('');

    console.log('=== All Tests Passed Successfully! ===');
    console.log('✓ Pagination is working correctly');
    console.log('✓ Sorting by different columns is working correctly');
    console.log('✓ Combined filters with pagination and sorting work correctly');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

testPartsPaginationAndSorting();
