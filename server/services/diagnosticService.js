const { DiagnosticTest, DiagnosticForm, DiagnosticResult } = require('../models/Diagnostic');

class DiagnosticService {
  // Get all diagnostic tests with filtering
  static async getDiagnosticTests(filters = {}) {
    console.log('DiagnosticService: Getting diagnostic tests with filters:', filters);

    try {
      const query = { isActive: true };

      if (filters.deviceType) {
        query.deviceTypes = { $in: [filters.deviceType] };
      }

      if (filters.category) {
        query.category = filters.category;
      }

      if (filters.search) {
        query.$or = [
          { name: { $regex: filters.search, $options: 'i' } },
          { description: { $regex: filters.search, $options: 'i' } }
        ];
      }

      const tests = await DiagnosticTest.find(query)
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 });

      console.log('DiagnosticService: Found', tests.length, 'diagnostic tests');
      return tests;
    } catch (error) {
      console.error('DiagnosticService: Error getting diagnostic tests:', error);
      throw error;
    }
  }

  // Get single diagnostic test
  static async getDiagnosticTest(testId) {
    console.log('DiagnosticService: Getting diagnostic test:', testId);

    try {
      const test = await DiagnosticTest.findById(testId)
        .populate('createdBy', 'name email');

      if (!test) {
        throw new Error('Diagnostic test not found');
      }

      console.log('DiagnosticService: Found diagnostic test:', test.name);
      return test;
    } catch (error) {
      console.error('DiagnosticService: Error getting diagnostic test:', error);
      throw error;
    }
  }

  // Create new diagnostic test
  static async createDiagnosticTest(testData, createdBy) {
    console.log('DiagnosticService: Creating diagnostic test:', testData.name);

    try {
      const test = new DiagnosticTest({
        ...testData,
        createdBy
      });

      await test.save();
      await test.populate('createdBy', 'name email');

      console.log('DiagnosticService: Created diagnostic test:', test._id);
      return test;
    } catch (error) {
      console.error('DiagnosticService: Error creating diagnostic test:', error);
      throw error;
    }
  }

  // Update diagnostic test
  static async updateDiagnosticTest(testId, updateData) {
    console.log('DiagnosticService: Updating diagnostic test:', testId);

    try {
      const test = await DiagnosticTest.findByIdAndUpdate(
        testId,
        { ...updateData, updatedAt: new Date() },
        { new: true, runValidators: true }
      ).populate('createdBy', 'name email');

      if (!test) {
        throw new Error('Diagnostic test not found');
      }

      console.log('DiagnosticService: Updated diagnostic test:', test.name);
      return test;
    } catch (error) {
      console.error('DiagnosticService: Error updating diagnostic test:', error);
      throw error;
    }
  }

  // Delete diagnostic test
  static async deleteDiagnosticTest(testId) {
    console.log('DiagnosticService: Deleting diagnostic test:', testId);

    try {
      const test = await DiagnosticTest.findByIdAndUpdate(
        testId,
        { isActive: false },
        { new: true }
      );

      if (!test) {
        throw new Error('Diagnostic test not found');
      }

      console.log('DiagnosticService: Deleted diagnostic test:', test.name);
      return test;
    } catch (error) {
      console.error('DiagnosticService: Error deleting diagnostic test:', error);
      throw error;
    }
  }

  // Get all diagnostic forms with filtering
  static async getDiagnosticForms(filters = {}) {
    console.log('DiagnosticService: Getting diagnostic forms with filters:', filters);

    try {
      const query = { isActive: true };

      if (filters.deviceType) {
        query.deviceTypes = { $in: [filters.deviceType] };
      }

      if (filters.search) {
        query.$or = [
          { name: { $regex: filters.search, $options: 'i' } },
          { description: { $regex: filters.search, $options: 'i' } }
        ];
      }

      const forms = await DiagnosticForm.find(query)
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 });

      console.log('DiagnosticService: Found', forms.length, 'diagnostic forms');
      return forms;
    } catch (error) {
      console.error('DiagnosticService: Error getting diagnostic forms:', error);
      throw error;
    }
  }

  // Get single diagnostic form
  static async getDiagnosticForm(formId) {
    console.log('DiagnosticService: Getting diagnostic form:', formId);

    try {
      const form = await DiagnosticForm.findById(formId)
        .populate('createdBy', 'name email');

      if (!form) {
        throw new Error('Diagnostic form not found');
      }

      console.log('DiagnosticService: Found diagnostic form:', form.name);
      return form;
    } catch (error) {
      console.error('DiagnosticService: Error getting diagnostic form:', error);
      throw error;
    }
  }

  // Create new diagnostic form
  static async createDiagnosticForm(formData, createdBy) {
    console.log('DiagnosticService: Creating diagnostic form:', formData.name);

    try {
      const form = new DiagnosticForm({
        ...formData,
        createdBy
      });

      await form.save();
      await form.populate('createdBy', 'name email');

      console.log('DiagnosticService: Created diagnostic form:', form._id);
      return form;
    } catch (error) {
      console.error('DiagnosticService: Error creating diagnostic form:', error);
      throw error;
    }
  }

  // Update diagnostic form
  static async updateDiagnosticForm(formId, updateData) {
    console.log('DiagnosticService: Updating diagnostic form:', formId);

    try {
      const form = await DiagnosticForm.findByIdAndUpdate(
        formId,
        { ...updateData, updatedAt: new Date() },
        { new: true, runValidators: true }
      ).populate('createdBy', 'name email');

      if (!form) {
        throw new Error('Diagnostic form not found');
      }

      console.log('DiagnosticService: Updated diagnostic form:', form.name);
      return form;
    } catch (error) {
      console.error('DiagnosticService: Error updating diagnostic form:', error);
      throw error;
    }
  }

  // Delete diagnostic form
  static async deleteDiagnosticForm(formId) {
    console.log('DiagnosticService: Deleting diagnostic form:', formId);

    try {
      const form = await DiagnosticForm.findByIdAndUpdate(
        formId,
        { isActive: false },
        { new: true }
      );

      if (!form) {
        throw new Error('Diagnostic form not found');
      }

      console.log('DiagnosticService: Deleted diagnostic form:', form.name);
      return form;
    } catch (error) {
      console.error('DiagnosticService: Error deleting diagnostic form:', error);
      throw error;
    }
  }

  // Submit diagnostic result
  static async submitDiagnosticResult(resultData, performedBy) {
    console.log('DiagnosticService: Submitting diagnostic result for order:', resultData.orderId);

    try {
      const result = new DiagnosticResult({
        ...resultData,
        performedBy
      });

      await result.save();
      await result.populate([
        { path: 'orderId', select: 'orderNumber customerName' },
        { path: 'testId', select: 'name category' },
        { path: 'performedBy', select: 'name email' }
      ]);

      console.log('DiagnosticService: Submitted diagnostic result:', result._id);
      return result;
    } catch (error) {
      console.error('DiagnosticService: Error submitting diagnostic result:', error);
      throw error;
    }
  }

  // Get diagnostic results for an order
  static async getDiagnosticResults(orderId) {
    console.log('DiagnosticService: Getting diagnostic results for order:', orderId);

    try {
      const results = await DiagnosticResult.find({ orderId })
        .populate([
          { path: 'testId', select: 'name category' },
          { path: 'performedBy', select: 'name email' }
        ])
        .sort({ performedAt: -1 });

      console.log('DiagnosticService: Found', results.length, 'diagnostic results');
      return results;
    } catch (error) {
      console.error('DiagnosticService: Error getting diagnostic results:', error);
      throw error;
    }
  }

  // Get diagnostic statistics
  static async getDiagnosticStats() {
    console.log('DiagnosticService: Getting diagnostic statistics');

    try {
      const [testsCount, formsCount, resultsCount, avgTestTime] = await Promise.all([
        DiagnosticTest.countDocuments({ isActive: true }),
        DiagnosticForm.countDocuments({ isActive: true }),
        DiagnosticResult.countDocuments(),
        DiagnosticTest.aggregate([
          { $match: { isActive: true } },
          { $group: { _id: null, avgTime: { $avg: '$estimatedTime' } } }
        ])
      ]);

      const stats = {
        totalTests: testsCount,
        totalForms: formsCount,
        totalResults: resultsCount,
        averageTestTime: avgTestTime.length > 0 ? Math.round(avgTestTime[0].avgTime) : 0
      };

      console.log('DiagnosticService: Generated diagnostic statistics:', stats);
      return stats;
    } catch (error) {
      console.error('DiagnosticService: Error getting diagnostic statistics:', error);
      throw error;
    }
  }
}

module.exports = DiagnosticService;