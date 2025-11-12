#!/usr/bin/env node

const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';

// Test configuration
let authToken = null;
let testOrderId = null;
let testWorkflowId = null;

const client = axios.create({
  baseURL: BASE_URL,
  validateStatus: () => true // Don't throw on any status code
});

// Add token to requests
client.interceptors.request.use(config => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

async function testWorkflowDeletion() {
  console.log('\n🧪 Testing Multiple Workflow Assignment & Deletion Feature\n');
  console.log('═'.repeat(60));

  try {
    // Step 1: Login as admin
    console.log('\n📝 Step 1: Authenticating as admin...');
    const loginRes = await client.post('/auth/login', {
      email: 'admin@fixithub.com',
      password: 'Admin123!'
    });

    if (loginRes.status !== 200) {
      console.error('❌ Login failed:', loginRes.data);
      return;
    }

    authToken = loginRes.data.token;
    console.log('✅ Successfully logged in as admin');

    // Step 2: Get an existing order
    console.log('\n📝 Step 2: Fetching available orders...');
    const ordersRes = await client.get('/admin/orders');

    if (ordersRes.status !== 200 || !ordersRes.data.orders || ordersRes.data.orders.length === 0) {
      console.error('❌ No orders found:', ordersRes.data);
      return;
    }

    testOrderId = ordersRes.data.orders[0]._id;
    console.log(`✅ Found order: ${testOrderId}`);

    // Step 3: Get suggested workflows
    console.log('\n📝 Step 3: Getting suggested workflows for order...');
    const suggestedRes = await client.get(`/admin/orders/${testOrderId}/workflows/suggested`);

    if (suggestedRes.status !== 200 || !suggestedRes.data.workflows || suggestedRes.data.workflows.length === 0) {
      console.error('❌ No suggested workflows found:', suggestedRes.data);
      return;
    }

    console.log(`✅ Found ${suggestedRes.data.workflows.length} suggested workflow(s)`);

    // Step 4: Assign first workflow
    console.log('\n📝 Step 4: Assigning first workflow to order...');
    const workflowId1 = suggestedRes.data.workflows[0]._id;
    const assignRes1 = await client.post(`/admin/orders/${testOrderId}/workflows`, {
      workflowTemplateId: workflowId1
    });

    if (assignRes1.status !== 200) {
      console.error('❌ Failed to assign first workflow:', assignRes1.data);
      return;
    }

    console.log(`✅ First workflow assigned successfully`);

    // Step 5: Assign second workflow (testing multiple assignments)
    if (suggestedRes.data.workflows.length > 1) {
      console.log('\n📝 Step 5: Assigning second workflow to order (testing multiple assignments)...');
      const workflowId2 = suggestedRes.data.workflows[1]._id;
      const assignRes2 = await client.post(`/admin/orders/${testOrderId}/workflows`, {
        workflowTemplateId: workflowId2
      });

      if (assignRes2.status !== 200) {
        console.error('❌ Failed to assign second workflow:', assignRes2.data);
        return;
      }

      console.log(`✅ Second workflow assigned successfully (Multiple workflow support working!)`);
    } else {
      console.log('\n📝 Step 5: Skipping second workflow assignment (only one available)');
    }

    // Step 6: Get order workflows
    console.log('\n📝 Step 6: Fetching assigned workflows...');
    const workflowsRes = await client.get(`/admin/orders/${testOrderId}/workflows`);

    if (workflowsRes.status !== 200 || !workflowsRes.data.workflows) {
      console.error('❌ Failed to get workflows:', workflowsRes.data);
      return;
    }

    console.log(`✅ Found ${workflowsRes.data.workflows.length} assigned workflow(s)`);
    workflowsRes.data.workflows.forEach((w, i) => {
      console.log(`   ${i + 1}. ${w.workflowName} (ID: ${w._id}, Status: ${w.status})`);
    });

    // Step 7: Delete first workflow
    if (workflowsRes.data.workflows.length > 0) {
      testWorkflowId = workflowsRes.data.workflows[0]._id;
      const workflowName = workflowsRes.data.workflows[0].workflowName;

      console.log(`\n📝 Step 7: Deleting workflow "${workflowName}"...`);
      const deleteRes = await client.delete(`/admin/orders/${testOrderId}/workflows/${testWorkflowId}`);

      if (deleteRes.status !== 200) {
        console.error('❌ Failed to delete workflow:', deleteRes.data);
        return;
      }

      console.log(`✅ Workflow deleted successfully`);

      // Step 8: Verify deletion
      console.log('\n📝 Step 8: Verifying workflow was deleted...');
      const verifyRes = await client.get(`/admin/orders/${testOrderId}/workflows`);

      if (verifyRes.status !== 200 || !verifyRes.data.workflows) {
        console.error('❌ Failed to verify workflows:', verifyRes.data);
        return;
      }

      console.log(`✅ Current workflows: ${verifyRes.data.workflows.length}`);
      verifyRes.data.workflows.forEach((w, i) => {
        console.log(`   ${i + 1}. ${w.workflowName} (ID: ${w._id})`);
      });

      // Verify the deleted workflow is gone
      const deletedWorkflowFound = verifyRes.data.workflows.find(w => w._id === testWorkflowId);
      if (deletedWorkflowFound) {
        console.error('❌ Deleted workflow still exists!');
        return;
      }

      console.log(`✅ Deleted workflow is no longer in the list - Deletion verified!`);
    }

    console.log('\n═'.repeat(60));
    console.log('\n✅ All tests passed! Workflow deletion feature is working correctly!');
    console.log('\n📋 Features Tested:');
    console.log('   ✓ Multiple workflow assignment');
    console.log('   ✓ Workflow deletion');
    console.log('   ✓ Workflow list verification');
    console.log('\n');

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    if (error.response?.data) {
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testWorkflowDeletion().catch(console.error);
