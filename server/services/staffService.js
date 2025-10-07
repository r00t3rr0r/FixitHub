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

      // Enhance staff data with performance and workload info
      const enhancedStaff = await Promise.all(
        staff.map(async (member) => {
          // Get current workload
          const assignedTasks = await Task.countDocuments({
            assignedTo: member._id,
            status: { $in: ['pending', 'in_progress'] }
          });

          const assignedOrders = await Order.countDocuments({
            'assignedStaff.staffId': member._id,
            status: { $in: ['pending', 'in_progress', 'awaiting_parts'] }
          });

          // Calculate performance metrics
          const completedOrders = await Order.countDocuments({
            'assignedStaff.staffId': member._id,
            status: 'completed'
          });

          return {
            ...member.toObject(),
            specializations: member.specializations || ['General Repair'],
            addOnCapabilities: member.addOnCapabilities || ['Basic Services'],
            status: member.isActive ? 'active' : 'inactive',
            hireDate: member.createdAt,
            schedule: this.generateDefaultSchedule(),
            performance: {
              ordersCompleted: completedOrders,
              averageCompletionTime: 2.5,
              customerSatisfaction: 4.2 + Math.random() * 0.6,
              efficiency: 85 + Math.random() * 10,
              qualityScore: 90 + Math.random() * 8
            },
            currentWorkload: {
              assignedOrders: assignedOrders,
              assignedTasks: assignedTasks,
              capacity: 10,
              utilizationRate: Math.min(((assignedOrders + assignedTasks) / 10) * 100, 100)
            }
          };
        })
      );

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
        .select('name email');

      const workloadData = await Promise.all(
        staff.map(async (member) => {
          const assignedOrders = await Order.find({
            'assignedStaff.staffId': member._id,
            status: { $in: ['pending', 'in_progress', 'awaiting_parts', 'quality-check'] }
          }).select('orderNumber status priority estimatedCompletion progress deviceBrand deviceModel services');

          const assignedTasks = await Task.find({
            assignedTo: member._id,
            status: { $in: ['pending', 'in_progress'] }
          }).select('title priority dueDate status estimatedHours actualHours');

          const capacity = 10; // Default capacity
          const totalAssigned = assignedOrders.length + assignedTasks.length;
          const utilizationRate = Math.min((totalAssigned / capacity) * 100, 100);

          console.log(`StaffService: Member ${member.name} - Orders: ${assignedOrders.length}, Tasks: ${assignedTasks.length}`);

          return {
            staffId: member._id,
            staffName: member.name,
            assignedOrders: assignedOrders.length,
            assignedTasks: assignedTasks.length,
            capacity,
            utilizationRate: Math.round(utilizationRate),
            currentTasks: [
              ...assignedOrders.map(order => ({
                id: order._id,
                type: 'order',
                title: `Order ${order.orderNumber} - ${order.deviceBrand} ${order.deviceModel}`,
                subtitle: order.services.join(', '),
                priority: order.priority || 'normal',
                dueDate: order.estimatedCompletion || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default to 7 days from now
                progress: order.progress || (order.status === 'in_progress' ? 50 : 10),
                status: order.status
              })),
              ...assignedTasks.map(task => ({
                id: task._id,
                type: 'task',
                title: task.title,
                subtitle: `${task.estimatedHours}h estimated`,
                priority: task.priority,
                dueDate: task.dueDate,
                progress: task.status === 'in_progress' ? 60 : 20,
                status: task.status
              }))
            ].slice(0, 10) // Increased limit to show more items
          };
        })
      );

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

      // Get assigned orders
      const assignedOrders = await Order.find({
        'assignedStaff.staffId': staffId,
        status: { $in: ['pending', 'in-progress', 'quality-check', 'awaiting_parts'] }
      })
      .select('orderNumber deviceBrand deviceModel status priority createdAt estimatedCompletion progress')
      .lean();

      console.log('StaffService: Found assigned orders:', assignedOrders.length);

      // Get assigned tasks
      const assignedTasks = await Task.find({
        assignedTo: staffId,
        status: { $in: ['pending', 'in_progress'] }
      })
      .select('title description priority status dueDate estimatedHours actualHours')
      .lean();

      console.log('StaffService: Found assigned tasks:', assignedTasks.length);

      // Calculate time tracking data (mock data for now - in real app this would come from time tracking system)
      const timeTracking = {
        totalHoursThisWeek: Math.floor(Math.random() * 40) + 20,
        totalHoursThisMonth: Math.floor(Math.random() * 160) + 80,
        averageHoursPerDay: Math.floor(Math.random() * 4) + 6,
        lastClockIn: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),
        lastClockOut: new Date(Date.now() - Math.random() * 12 * 60 * 60 * 1000),
        currentStatus: ['clocked_in', 'clocked_out', 'on_break'][Math.floor(Math.random() * 3)]
      };

      // Generate activity log (mock data - in real app this would come from audit logs)
      const activityLog = [
        {
          _id: 'activity1',
          action: 'Clock In',
          description: 'Clocked in for work',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
          details: { location: 'Main Office' }
        },
        {
          _id: 'activity2',
          action: 'Order Assignment',
          description: 'Assigned to new repair order',
          timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
          details: { orderId: assignedOrders[0]?._id }
        },
        {
          _id: 'activity3',
          action: 'Task Completion',
          description: 'Completed quality check task',
          timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
          details: { taskType: 'Quality Check' }
        },
        {
          _id: 'activity4',
          action: 'Profile Update',
          description: 'Updated profile information',
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
          details: { field: 'specializations' }
        }
      ];

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

      // Calculate current performance metrics
      const completedOrders = await Order.countDocuments({
        'assignedStaff.staffId': staffId,
        status: 'completed'
      });

      const performance = {
        ordersCompleted: completedOrders,
        averageCompletionTime: 2.5,
        customerSatisfaction: 4.2 + Math.random() * 0.6,
        efficiency: 85 + Math.random() * 10,
        qualityScore: 90 + Math.random() * 8
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
        assignedOrders,
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