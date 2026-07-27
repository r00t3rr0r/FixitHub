const RepairWorkflowService = require('../services/repairWorkflowService');

async function checkRepairWorkflowInactivity() {
  try {
    console.log(`[${new Date().toISOString()}] Checking for inactive repair workflows...`);

    const inactiveWorkflows = await RepairWorkflowService.checkAndNotifyInactiveWorkflows(
      3 * 60 * 60 * 1000 // 3 hours
    );

    if (inactiveWorkflows.length > 0) {
      console.log(
        `Found ${inactiveWorkflows.length} inactive workflow(s). Alerts sent.`
      );
    } else {
      console.log('No inactive workflows found.');
    }

    return {
      success: true,
      inactiveCount: inactiveWorkflows.length,
      timestamp: new Date(),
    };
  } catch (error) {
    console.error('[RepairWorkflowMonitor] Error during inactivity check:', error);
    return {
      success: false,
      error: error.message,
      timestamp: new Date(),
    };
  }
}

module.exports = {
  checkRepairWorkflowInactivity,
};
