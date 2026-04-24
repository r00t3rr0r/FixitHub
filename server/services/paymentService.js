// PaymentService.js
const Payment = require('../models/Payment');

module.exports = {
  // Delete all payments
  async deleteAllPayments() {
    try {
      const result = await Payment.deleteMany({});
      return { success: true, deletedCount: result.deletedCount };
    } catch (error) {
      console.error('PaymentService: Error deleting all payments:', error);
      throw error;
    }
  },
};
