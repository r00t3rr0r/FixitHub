const PerformanceMetric = require('../models/Performance');
const Order = require('../models/Order');
const User = require('../models/User');

class PerformanceService {
  // Get performance metrics for a staff member
  static async getStaffPerformance(staffId, period = null) {
    console.log('PerformanceService: Getting performance for staff:', staffId, 'period:', period);

    try {
      let query = { staffId };
      if (period) {
        query.period = period;
      }

      const metrics = await PerformanceMetric.find(query)
        .sort({ period: -1 })
        .limit(12); // Last 12 months

      if (metrics.length === 0) {
        // Calculate and create metrics if they don't exist
        const currentPeriod = period || new Date().toISOString().slice(0, 7); // YYYY-MM
        const calculatedMetrics = await this.calculateStaffMetrics(staffId, currentPeriod);
        return [calculatedMetrics];
      }

      console.log('PerformanceService: Found', metrics.length, 'performance records');
      return metrics;
    } catch (error) {
      console.error('PerformanceService: Error getting staff performance:', error);
      throw error;
    }
  }

  // Calculate performance metrics for a staff member for a specific period
  static async calculateStaffMetrics(staffId, period) {
    console.log('PerformanceService: Calculating metrics for staff:', staffId, 'period:', period);

    try {
      const [year, month] = period.split('-');
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      // Get orders for the period
      const orders = await Order.find({
        'assignedStaff.staffId': staffId,
        createdAt: { $gte: startDate, $lte: endDate }
      });

      const completedOrders = orders.filter(order => order.status === 'completed');
      
      // Calculate metrics
      const ordersCompleted = completedOrders.length;
      const totalRevenue = completedOrders.reduce((sum, order) => sum + order.totalCost, 0);
      
      // Calculate average completion time
      let totalCompletionTime = 0;
      let completionTimeCount = 0;
      
      completedOrders.forEach(order => {
        if (order.actualCompletion && order.createdAt) {
          const completionTime = (new Date(order.actualCompletion) - new Date(order.createdAt)) / (1000 * 60 * 60); // hours
          totalCompletionTime += completionTime;
          completionTimeCount++;
        }
      });

      const averageCompletionTime = completionTimeCount > 0 ? totalCompletionTime / completionTimeCount : 0;

      // Mock other metrics (in real implementation, these would come from actual data)
      const customerSatisfaction = 4.2 + Math.random() * 0.6; // 4.2-4.8
      const efficiency = 85 + Math.random() * 10; // 85-95%
      const qualityScore = 90 + Math.random() * 8; // 90-98%

      const metrics = {
        staffId,
        period,
        metrics: {
          ordersCompleted,
          averageCompletionTime: Math.round(averageCompletionTime * 10) / 10,
          customerSatisfaction: Math.round(customerSatisfaction * 10) / 10,
          efficiency: Math.round(efficiency),
          qualityScore: Math.round(qualityScore),
          revenue: totalRevenue,
          hoursWorked: ordersCompleted * 2.5 // Estimate
        },
        goals: {
          ordersTarget: 50,
          revenueTarget: 5000,
          satisfactionTarget: 4.5
        },
        achievements: this.generateAchievements(ordersCompleted, totalRevenue, customerSatisfaction)
      };

      // Save to database
      const performanceMetric = new PerformanceMetric(metrics);
      await performanceMetric.save();

      console.log('PerformanceService: Calculated and saved metrics');
      return performanceMetric;
    } catch (error) {
      console.error('PerformanceService: Error calculating staff metrics:', error);
      throw error;
    }
  }

  // Generate achievements based on performance
  static generateAchievements(ordersCompleted, revenue, satisfaction) {
    const achievements = [];

    if (ordersCompleted >= 50) {
      achievements.push({
        title: 'Order Master',
        description: 'Completed 50+ orders this month',
        earnedAt: new Date(),
        icon: '🏆'
      });
    }

    if (revenue >= 5000) {
      achievements.push({
        title: 'Revenue Star',
        description: 'Generated $5000+ in revenue',
        earnedAt: new Date(),
        icon: '⭐'
      });
    }

    if (satisfaction >= 4.5) {
      achievements.push({
        title: 'Customer Favorite',
        description: 'Maintained 4.5+ customer satisfaction',
        earnedAt: new Date(),
        icon: '❤️'
      });
    }

    return achievements;
  }

  // Get team performance overview
  static async getTeamPerformance(period = null) {
    console.log('PerformanceService: Getting team performance for period:', period);

    try {
      const currentPeriod = period || new Date().toISOString().slice(0, 7);
      
      // Get all staff members
      const staffMembers = await User.find({ role: { $in: ['staff', 'admin'] } });
      
      const teamPerformance = await Promise.all(
        staffMembers.map(async (staff) => {
          const performance = await this.getStaffPerformance(staff._id, currentPeriod);
          return {
            staffId: staff._id,
            staffName: staff.name,
            avatar: staff.avatar,
            performance: performance[0] || null
          };
        })
      );

      console.log('PerformanceService: Calculated team performance for', staffMembers.length, 'staff members');
      return teamPerformance;
    } catch (error) {
      console.error('PerformanceService: Error getting team performance:', error);
      throw error;
    }
  }

  // Update performance goals
  static async updatePerformanceGoals(staffId, period, goals) {
    console.log('PerformanceService: Updating goals for staff:', staffId);

    try {
      const metric = await PerformanceMetric.findOneAndUpdate(
        { staffId, period },
        { $set: { goals } },
        { new: true, upsert: true }
      );

      console.log('PerformanceService: Goals updated successfully');
      return metric;
    } catch (error) {
      console.error('PerformanceService: Error updating goals:', error);
      throw error;
    }
  }
}

module.exports = PerformanceService;