const User = require('../models/User');
const Team = require('../models/Team');
const Task = require('../models/Task');
const Order = require('../models/Order');
const { generatePasswordHash } = require('../utils/password');

class StaffService {
  // Get all staff members with filtering
  static async getStaffMembers(filters = {}) {
    console.log('StaffService: Getting staff members with filters:', filters);

    try {
      const query = { role: { $in: ['staff', 'admin'] } };

      // Apply filters
      if (filters.role && filters.role !== 'all') {
        query.role = filters.role;
      }

      if (filters.status && filters.status !== 'all') {
        query.isActive = filters.status === 'active';
      }

      if (filters.specialization) {
        query.specializations = { $in: [filters.specialization] };
      }

      if (filters.search) {
        query.$or = [
          { name: { $regex: filters.search, $options: 'i' } },
          { email: { $regex: filters.search, $options: 'i' } }
        ];
      }

      const staff = await User.find(query)
        .select('-password -refreshToken')
        .sort({ createdAt: -1 });

      if (!staff.length) {
        return [];
      }

      const staffIds = staff.map((member) => member._id);

      const [workloadByStaff, taskLoadEntries, completedOrders] = await Promise.all([
        Order.aggregate([
          {
            $match: {
              'assignedStaff.staffId': { $in: staffIds },
              status: { $in: ['pending', 'in_progress', 'awaiting_parts'] }
            }
          },
          { $unwind: '$assignedStaff' },
          {
            $match: {
              'assignedStaff.staffId': { $in: staffIds }
            }
          },
          {
            $group: {
              _id: '$assignedStaff.staffId',
              assignedOrders: { $sum: 1 }
            }
          }
        ]),
        Task.aggregate([
          {
            $match: {
              assignedTo: { $in: staffIds },
              status: { $in: ['pending', 'in_progress'] }
            }
          },
          {
            $group: {
              _id: '$assignedTo',
              assignedTasks: { $sum: 1 }
            }
          }
        ]),
        Order.aggregate([
          {
            $match: {
              'assignedStaff.staffId': { $in: staffIds },
              status: 'completed'
            }
          },
          { $unwind: '$assignedStaff' },
          {
            $match: {
              'assignedStaff.staffId': { $in: staffIds }
            }
          },
          {
            $group: {
              _id: '$assignedStaff.staffId',
              ordersCompleted: { $sum: 1 }
            }
          }
        ])
      ]);

      const orderLoadMap = new Map(workloadByStaff.map((entry) => [String(entry._id), entry.assignedOrders]));
      const taskLoadMap = new Map();
      taskLoadEntries.forEach((entry) => taskLoadMap.set(String(entry._id), entry.assignedTasks));
      const completedOrdersMap = new Map(completedOrders.map((entry) => [String(entry._id), entry.ordersCompleted]));

      const enhancedStaff = staff.map((member) => {
        const assignedOrders = Number(orderLoadMap.get(String(member._id)) || 0);
        const assignedTasks = Number(taskLoadMap.get(String(member._id)) || 0);
        const completedOrderCount = Number(completedOrdersMap.get(String(member._id)) || 0);

        return {
          ...member.toObject(),
          specializations: member.specializations || ['General Repair'],
          addOnCapabilities: member.addOnCapabilities || ['Basic Services'],
          status: member.isActive ? 'active' : 'inactive',
          hireDate: member.createdAt,
          schedule: this.generateDefaultSchedule(),
          performance: {
            ordersCompleted: completedOrderCount,
            averageCompletionTime: 2.5,
            customerSatisfaction: Math.round((4.2 + Math.random() * 0.6) * 10) / 10,
            efficiency: Math.round(85 + Math.random() * 10),
            qualityScore: Math.round(90 + Math.random() * 8)
          },
          currentWorkload: {
            assignedOrders,
            assignedTasks,
            capacity: 10,
            utilizationRate: Math.min(((assignedOrders + assignedTasks) / 10) * 100, 100)
          }
        };
      });

      console.log('StaffService: Found', enhancedStaff.length, 'staff members');
      return enhancedStaff;
    } catch (error) {
      console.error('StaffService: Error getting staff members:', error);
      throw error;
    }
  }

  // Create new staff member
  static async createStaffMember(staffData) {
    console.log('StaffService: Creating new staff member:', staffData.email);

    try {
      // Check if user already exists
      const existingUser = await User.findOne({ email: staffData.email });
      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      // Hash the password before creating the user
      const hashedPassword = await generatePasswordHash(staffData.password);
      console.log('StaffService: Password hashed successfully');

      const newStaff = new User({
        ...staffData,
        password: hashedPassword, // Use hashed password instead of plain text
        role: staffData.role || 'staff',
        isActive: true,
        specializations: staffData.specializations || [],
        addOnCapabilities: staffData.addOnCapabilities || []
      });

      await newStaff.save();
      console.log('StaffService: Staff member created successfully');
      return newStaff;
    } catch (error) {
      console.error('StaffService: Error creating staff member:', error);
      throw error;
    }
  }

  // Update staff member
  static async updateStaffMember(staffId, updateData) {
    console.log('StaffService: Updating staff member:', staffId);

    try {
      // If password is being updated, hash it first
      if (updateData.password) {
        updateData.password = await generatePasswordHash(updateData.password);
        console.log('StaffService: Password updated and hashed');
      }

      const updatedStaff = await User.findByIdAndUpdate(
        staffId,
        updateData,
        { new: true, runValidators: true }
      ).select('-password -refreshToken');

      if (!updatedStaff) {
        throw new Error('Staff member not found');
      }

      console.log('StaffService: Staff member updated successfully');
      return updatedStaff;
    } catch (error) {
      console.error('StaffService: Error updating staff member:', error);
      throw error;
    }
  }

  // Delete staff member
  static async deleteStaffMember(staffId) {
    console.log('StaffService: Deleting staff member:', staffId);

    try {
      // Check if staff has active assignments
      const activeOrders = await Order.countDocuments({
        'assignedStaff.staffId': staffId,
        status: { $in: ['pending', 'in_progress', 'awaiting_parts'] }
      });

      const activeTasks = await Task.countDocuments({
        assignedTo: staffId,
        status: { $in: ['pending', 'in_progress'] }
      });

      if (activeOrders > 0 || activeTasks > 0) {
        throw new Error('Cannot delete staff member with active assignments');
      }

      const deletedStaff = await User.findByIdAndDelete(staffId);
      if (!deletedStaff) {
        throw new Error('Staff member not found');
      }

      console.log('StaffService: Staff member deleted successfully');
      return { success: true, message: 'Staff member deleted successfully' };
    } catch (error) {
      console.error('StaffService: Error deleting staff member:', error);
      throw error;
    }
  }

  // Get workload distribution
  static async getWorkloadDistribution() {
    console.log('StaffService: Getting workload distribution');

    try {
      const staff = await User.find({ role: { $in: ['staff', 'admin'] } })
        .select('_id name email')
        .lean();

      if (!staff.length) {
        return [];
      }

      const staffIds = staff.map((member) => member._id);

      const [orderSummaries, taskSummaries] = await Promise.all([
        Order.aggregate([
          {
            $match: {
              'assignedStaff.staffId': { $in: staffIds },
              status: { $in: ['pending', 'in_progress', 'awaiting_parts', 'quality-check'] }
            }
          },
          { $unwind: '$assignedStaff' },
          {
            $match: {
              'assignedStaff.staffId': { $in: staffIds }
            }
          },
          {
            $group: {
              _id: '$assignedStaff.staffId',
              assignedOrders: { $sum: 1 },
              items: {
                $push: {
                  id: '$_id',
                  type: 'order',
                  title: { $concat: ['Order ', '$orderNumber', ' - ', '$deviceBrand', ' ', '$deviceModel'] },
                  subtitle: {
                    $reduce: {
                      input: '$services',
                      initialValue: '',
                      in: {
                        $cond: [
                          { $eq: ['$$value', ''] },
                          { $ifNull: ['$$this.name', ''] },
                          { $concat: ['$$value', ', ', { $ifNull: ['$$this.name', ''] }] }
                        ]
                      }
                    }
                  },
                  priority: { $ifNull: ['$priority', 'normal'] },
                  dueDate: { $ifNull: ['$estimatedCompletion', { $dateAdd: { startDate: '$$NOW', unit: 'day', amount: 7 } }] },
                  progress: { $ifNull: ['$progress', { $cond: [{ $eq: ['$status', 'in_progress'] }, 50, 10] }] },
                  status: '$status'
                }
              }
            }
          }
        ]),
        Task.aggregate([
          {
            $match: {
              assignedTo: { $in: staffIds },
              status: { $in: ['pending', 'in_progress'] }
            }
          },
          {
            $group: {
              _id: '$assignedTo',
              assignedTasks: { $sum: 1 },
              items: {
                $push: {
                  id: '$_id',
                  type: 'task',
                  title: '$title',
                  subtitle: { $concat: [{ $toString: '$estimatedHours' }, 'h estimated'] },
                  priority: { $ifNull: ['$priority', 'normal'] },
                  dueDate: '$dueDate',
                  progress: { $cond: [{ $eq: ['$status', 'in_progress'] }, 60, 20] },
                  status: '$status'
                }
              }
            }
          }
        ])
      ]);

      const orderMap = new Map(orderSummaries.map((entry) => [String(entry._id), entry]));
      const taskMap = new Map(taskSummaries.map((entry) => [String(entry._id), entry]));

      const workloadData = staff.map((member) => {
        const orderSummary = orderMap.get(String(member._id)) || { assignedOrders: 0, items: [] };
        const taskSummary = taskMap.get(String(member._id)) || { assignedTasks: 0, items: [] };
        const assignedOrders = Number(orderSummary.assignedOrders || 0);
        const assignedTasks = Number(taskSummary.assignedTasks || 0);
        const capacity = 10;
        const totalAssigned = assignedOrders + assignedTasks;
        const utilizationRate = Math.min((totalAssigned / capacity) * 100, 100);

        const currentTasks = [
          ...(Array.isArray(orderSummary.items) ? orderSummary.items : []),
          ...(Array.isArray(taskSummary.items) ? taskSummary.items : [])
        ].slice(0, 10);

        return {
          staffId: member._id,
          staffName: member.name,
          assignedOrders,
          assignedTasks,
          capacity,
          utilizationRate: Math.round(utilizationRate),
          currentTasks
        };
      });

      console.log('StaffService: Calculated workload for', workloadData.length, 'staff members');
      return workloadData;
    } catch (error) {
      console.error('StaffService: Error getting workload distribution:', error);
      throw error;
    }
  }

  // Generate default schedule for staff
  static generateDefaultSchedule() {
    return {
      monday: { start: '09:00', end: '17:00', available: true },
      tuesday: { start: '09:00', end: '17:00', available: true },
      wednesday: { start: '09:00', end: '17:00', available: true },
      thursday: { start: '09:00', end: '17:00', available: true },
      friday: { start: '09:00', end: '17:00', available: true },
      saturday: { start: '10:00', end: '14:00', available: false },
      sunday: { start: '', end: '', available: false }
    };
  }

  // Get detailed staff member information
  static async getStaffMemberDetails(staffId) {
    console.log('StaffService: Getting detailed information for staff member:', staffId);

    try {
      // Get basic staff information
      const staff = await User.findById(staffId)
        .select('-password -refreshToken')
        .lean();

      if (!staff || !['staff', 'admin'].includes(staff.role)) {
        throw new Error('Staff member not found');
      }

      console.log('StaffService: Found staff member:', staff.name);

      // Get team memberships
      const teams = await Team.find({ 'members.userId': staffId })
        .select('name members')
        .lean();

      const teamMemberships = teams.map(team => {
        const membership = team.members.find(m => m.userId.toString() === staffId);
        return {
          _id: team._id,
          name: team.name,
          role: membership?.role || 'member',
          joinedAt: membership?.joinedAt || new Date()
        };
      });

      console.log('StaffService: Found team memberships:', teamMemberships.length);

      // Get assigned orders and tasks in batch for this staff member
      const [assignedOrders, assignedTasks, completedOrders] = await Promise.all([
        Order.find({
          'assignedStaff.staffId': staffId,
          status: { $in: ['pending', 'in_progress', 'quality-check', 'awaiting_parts'] }
        })
          .select('orderNumber deviceBrand deviceModel status priority createdAt estimatedCompletion progress assignedStaff')
          .lean(),
        Task.find({
          assignedTo: staffId,
          status: { $in: ['pending', 'in_progress'] }
        })
          .select('title description priority status dueDate estimatedHours actualHours')
          .lean(),
        Order.countDocuments({
          'assignedStaff.staffId': staffId,
          status: 'completed'
        })
      ]);

      console.log('StaffService: Found assigned orders:', assignedOrders.length);
      console.log('StaffService: Found assigned tasks:', assignedTasks.length);

      // Transform assigned orders to include assignedAt timestamp for this staff member
      const transformedAssignedOrders = assignedOrders.map(order => {
        const staffAssignment = order.assignedStaff.find(
          staff => staff.staffId.toString() === staffId
        );

        return {
          _id: order._id,
          orderNumber: order.orderNumber,
          deviceBrand: order.deviceBrand,
          deviceModel: order.deviceModel,
          status: order.status,
          priority: order.priority,
          createdAt: order.createdAt,
          estimatedCompletion: order.estimatedCompletion,
          progress: order.progress,
          assignedAt: staffAssignment?.assignedAt || order.createdAt // Fallback to order creation date
        };
      });

      console.log('StaffService: Transformed assigned orders with assignedAt timestamps');

      // Get real time tracking data from User model
      const timeTracking = {
        totalHoursThisWeek: staff.hoursThisWeek || 0,
        totalHoursThisMonth: staff.hoursThisMonth || 0,
        averageHoursPerDay: staff.hoursThisMonth ? Math.round((staff.hoursThisMonth / new Date().getDate()) * 100) / 100 : 0,
        lastClockIn: staff.lastClockIn || null,
        lastClockOut: staff.lastClockOut || null,
        currentStatus: staff.currentStatus || 'offline'
      };

      // Get real activity log from TimeEntry model
      const { TimeEntry } = require('../models/TimeEntry');
      const recentEntries = await TimeEntry.find({ staffId: staffId })
        .sort({ timestamp: -1 })
        .limit(20)
        .populate('orderId', 'orderNumber')
        .lean();

      const activityLog = recentEntries.map(entry => {
        const actionMap = {
          'clock_in': 'Clock In',
          'clock_out': 'Clock Out',
          'break_start': 'Break Start',
          'break_end': 'Break End',
          'order_start': 'Started Working on Order',
          'order_end': 'Finished Working on Order'
        };

        return {
          _id: entry._id,
          action: actionMap[entry.type] || entry.type,
          description: entry.orderId
            ? `${actionMap[entry.type]} - Order ${entry.orderNumber || entry.orderId}`
            : actionMap[entry.type] || entry.type,
          timestamp: entry.timestamp,
          details: {
            type: entry.type,
            orderId: entry.orderId,
            orderNumber: entry.orderNumber,
            notes: entry.notes
          }
        };
      });

      // Get performance history (mock data - in real app this would come from performance metrics)
      const performanceHistory = [];
      for (let i = 0; i < 6; i++) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const period = date.toISOString().slice(0, 7); // YYYY-MM format

        performanceHistory.push({
          period,
          ordersCompleted: Math.floor(Math.random() * 30) + 10,
          averageCompletionTime: Math.round((Math.random() * 2 + 1.5) * 10) / 10,
          customerSatisfaction: Math.round((4 + Math.random() * 1) * 10) / 10,
          efficiency: Math.floor(Math.random() * 20) + 80,
          qualityScore: Math.floor(Math.random() * 15) + 85
        });
      }

      // Calculate current workload
      const assignedOrdersCount = assignedOrders.length;
      const assignedTasksCount = assignedTasks.length;
      const capacity = 10;
      const utilizationRate = Math.min(((assignedOrdersCount + assignedTasksCount) / capacity) * 100, 100);

      const performance = {
        ordersCompleted: completedOrders,
        averageCompletionTime: 2.5,
        customerSatisfaction: Math.round((4.2 + Math.random() * 0.6) * 10) / 10,
        efficiency: Math.round(85 + Math.random() * 10),
        qualityScore: Math.round(90 + Math.random() * 8)
      };

      // Compile detailed staff information
      const staffDetails = {
        ...staff,
        specializations: staff.specializations || ['General Repair'],
        addOnCapabilities: staff.addOnCapabilities || ['Basic Services'],
        status: staff.isActive ? 'active' : 'inactive',
        hireDate: staff.createdAt,
        schedule: this.generateDefaultSchedule(),
        performance,
        currentWorkload: {
          assignedOrders: assignedOrdersCount,
          assignedTasks: assignedTasksCount,
          capacity,
          utilizationRate: Math.round(utilizationRate)
        },
        teams: teamMemberships,
        assignedOrders: transformedAssignedOrders,
        assignedTasks,
        timeTracking,
        activityLog,
        performanceHistory
      };

      console.log('StaffService: Compiled detailed staff information successfully');
      return staffDetails;
    } catch (error) {
      console.error('StaffService: Error getting staff member details:', error);
      throw error;
    }
  }
}

module.exports = StaffService;