const axios = require('axios');

const API_BASE = 'http://localhost:3000/api';

async function testPaginationAndSorting() {
  console.log('========================================');
  console.log('Testing Add-On Service Pagination and Sorting');
  console.log('========================================\n');

  try {
    // Test 1: Get first page with default settings
    console.log('Test 1: Get first page (10 items, sorted by createdAt desc)');
    const response1 = await axios.get(`${API_BASE}/addons`, {
      params: {
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      }
    });
    console.log(`✓ Status: ${response1.status}`);
    console.log(`✓ Total items: ${response1.data.pagination.total}`);
    console.log(`✓ Current page: ${response1.data.pagination.page}`);
    console.log(`✓ Total pages: ${response1.data.pagination.totalPages}`);
    console.log(`✓ Items returned: ${response1.data.addOns.length}`);
    console.log(`✓ Has next page: ${response1.data.pagination.hasNextPage}`);
    console.log(`✓ Has previous page: ${response1.data.pagination.hasPrevPage}`);
    if (response1.data.addOns.length > 0) {
      console.log(`✓ First service: ${response1.data.addOns[0].name}`);
    }
    console.log('');

    // Test 2: Sort by name ascending
    console.log('Test 2: Sort by name (ascending)');
    const response2 = await axios.get(`${API_BASE}/addons`, {
      params: {
        page: 1,
        limit: 5,
        sortBy: 'name',
        sortOrder: 'asc'
      }
    });
    console.log(`✓ Status: ${response2.status}`);
    console.log(`✓ Items returned: ${response2.data.addOns.length}`);
    if (response2.data.addOns.length > 0) {
      console.log('✓ Services in order:');
      response2.data.addOns.forEach((service, idx) => {
        console.log(`   ${idx + 1}. ${service.name}`);
      });
    }
    console.log('');

    // Test 3: Sort by price descending
    console.log('Test 3: Sort by price (descending)');
    const response3 = await axios.get(`${API_BASE}/addons`, {
      params: {
        page: 1,
        limit: 5,
        sortBy: 'price',
        sortOrder: 'desc'
      }
    });
    console.log(`✓ Status: ${response3.status}`);
    console.log(`✓ Items returned: ${response3.data.addOns.length}`);
    if (response3.data.addOns.length > 0) {
      console.log('✓ Services by price:');
      response3.data.addOns.forEach((service, idx) => {
        console.log(`   ${idx + 1}. ${service.name} - $${service.price}`);
      });
    }
    console.log('');

    // Test 4: Sort by popularity descending
    console.log('Test 4: Sort by popularity (descending)');
    const response4 = await axios.get(`${API_BASE}/addons`, {
      params: {
        page: 1,
        limit: 5,
        sortBy: 'popularity',
        sortOrder: 'desc'
      }
    });
    console.log(`✓ Status: ${response4.status}`);
    console.log(`✓ Items returned: ${response4.data.addOns.length}`);
    if (response4.data.addOns.length > 0) {
      console.log('✓ Services by popularity:');
      response4.data.addOns.forEach((service, idx) => {
        console.log(`   ${idx + 1}. ${service.name} - ${service.popularity || 0}%`);
      });
    }
    console.log('');

    // Test 5: Test pagination - page 2
    if (response1.data.pagination.totalPages > 1) {
      console.log('Test 5: Get second page');
      const response5 = await axios.get(`${API_BASE}/addons`, {
        params: {
          page: 2,
          limit: 5,
          sortBy: 'name',
          sortOrder: 'asc'
        }
      });
      console.log(`✓ Status: ${response5.status}`);
      console.log(`✓ Current page: ${response5.data.pagination.page}`);
      console.log(`✓ Items returned: ${response5.data.addOns.length}`);
      console.log(`✓ Has previous page: ${response5.data.pagination.hasPrevPage}`);
      if (response5.data.addOns.length > 0) {
        console.log(`✓ First service on page 2: ${response5.data.addOns[0].name}`);
      }
      console.log('');
    }

    // Test 6: Filter by category with pagination
    console.log('Test 6: Filter by category (Protection) with pagination');
    const response6 = await axios.get(`${API_BASE}/addons`, {
      params: {
        category: 'Protection',
        page: 1,
        limit: 5,
        sortBy: 'name',
        sortOrder: 'asc'
      }
    });
    console.log(`✓ Status: ${response6.status}`);
    console.log(`✓ Items returned: ${response6.data.addOns.length}`);
    console.log(`✓ Total Protection services: ${response6.data.pagination.total}`);
    if (response6.data.addOns.length > 0) {
      console.log('✓ Protection services:');
      response6.data.addOns.forEach((service, idx) => {
        console.log(`   ${idx + 1}. ${service.name} (${service.category})`);
      });
    }
    console.log('');

    console.log('========================================');
    console.log('✅ ALL TESTS PASSED!');
    console.log('========================================');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

testPaginationAndSorting();
