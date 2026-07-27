const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');

async function testWorkflowAssignment() {
  try {
    await mongoose.connect(process.env.DATABASE_URL);
    
    const Order = require('./server/models/Order').default;
    const Workflow = require('./server/models/Workflow').default;
    
    // Get first order
    const order = await Order.findOne().limit(1);
    if (!order) {
      console.log('❌ No orders found');
      process.exit(1);
    }
    
    console.log('✓ Found order:', order.orderNumber);
    
    // Create a test workflow
    const workflow = new Workflow({
      orderRef: order._id,
      workflowName: 'Test Workflow',
      workflowTemplateId: 'test-template-123',
      status: 'in-progress',
      steps: [
        { name: 'Step 1', status: 'completed' },
        { name: 'Step 2', status: 'in-progress' },
        { name: 'Step 3', status: 'not-started' }
      ],
      assignedStaffId: order.assignedStaffId,
      startedAt: new Date()
    });
    
    await workflow.save();
    console.log('✓ Created workflow:', workflow._id);
    
    // Add workflow to order
    order.workflows.push(workflow._id);
    await order.save();
    console.log('✓ Added workflow to order');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
  }
}

testWorkflowAssignment();
