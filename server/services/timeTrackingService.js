const { TimeEntry, WorkSession } = require('../models/TimeEntry');
const User = require('../models/User');
const Order = require('../models/Order');
const Task = require('../models/Task');
const { v4: uuidv4 } = require('uuid');

const MS_PER_MINUTE = 1000 * 60;

const getOverlapMinutes = (start, end, rangeStart, rangeEnd) => {
  const safeStart = new Date(start);
  const safeEnd = end ? new Date(end) : new Date();
  const overlapStart = Math.max(safeStart.getTime(), rangeStart.getTime());
  const overlapEnd = Math.min(safeEnd.getTime(), rangeEnd.getTime());

  if (!Number.isFinite(overlapStart) || !Number.isFinite(overlapEnd) || overlapEnd <= overlapStart) {
    return 0;
  }

  return Math.round((overlapEnd - overlapStart) / MS_PER_MINUTE);
};

const roundHours = (minutes) => Math.round(((minutes || 0) / 60) * 100) / 100;

const mapBreakInterval = (breakItem, rangeStart, rangeEnd) => {
  const durationMinutes = getOverlapMinutes(
    breakItem?.startTime,
    breakItem?.endTime || rangeEnd,
    rangeStart,
    rangeEnd
  );

  if (durationMinutes <= 0) {
    return null;
  }

  return {
    startTime: breakItem.startTime,
    endTime: breakItem.endTime || null,
    durationHours: roundHours(durationMinutes),
    reason: breakItem.reason || ''
  };
};

/**
 * TimeTrackingService
 * Handles automatic time tracking for staff members
 */
class TimeTrackingService {
  /**
   * Clock in a staff member
   * Automatically starts tracking work time
   */
  static async clockIn(staffId, ipAddress = null, userAgent = null) {
    try {
      console.log(`TimeTrackingService: Clock in request for staff ${staffId}`);

      // Find the staff member
      const staff = await User.findById(staffId);
      if (!staff) {
        throw new Error('Staff member not found');
      }

      if (staff.role !== 'staff' && staff.role !== 'admin') {
        throw new Error('Only staff members can clock in');
      }

      // Check if already clocked in
      if (staff.currentStatus === 'working' || staff.currentStatus === 'on_break') {
        throw new Error('Staff member is already clocked in');
      }

      // Generate session ID
      const sessionId = uuidv4();
      const clockInTime = new Date();

      // Create time entry
      const timeEntry = await TimeEntry.create({
        staffId: staff._id,
        staffName: staff.name || staff.email,
        type: 'clock_in',
        timestamp: clockInTime,
        sessionId,
        ipAddress,
        userAgent
      });

      console.log(`TimeTrackingService: Time entry created:`, timeEntry._id);

      // Create work session
      const workSession = await WorkSession.create({
        staffId: staff._id,
        staffName: staff.name || staff.email,
        sessionId,
        clockInTime,
        status: 'active'
      });

      console.log(`TimeTrackingService: Work session created:`, workSession._id);

      // Update user status
      staff.currentStatus = 'online';
      staff.currentSessionId = sessionId;
      staff.lastClockIn = clockInTime;
      staff.lastActivity = clockInTime;
      await staff.save();

      console.log(`TimeTrackingService: Staff status updated to online`);

      return {
        success: true,
        message: 'Clocked in successfully',
        session: {
          sessionId,
          clockInTime,
          status: 'active'
        }
      };
    } catch (error) {
      console.error('TimeTrackingService: Clock in error:', error);
      throw error;
    }
  }

  /**
   * Clock out a staff member
   * Automatically calculates total work time
   */
  static async clockOut(staffId, ipAddress = null, userAgent = null) {
    try {
      console.log(`TimeTrackingService: Clock out request for staff ${staffId}`);

      // Find the staff member
      const staff = await User.findById(staffId);
      if (!staff) {
        throw new Error('Staff member not found');
      }

      // Check if clocked in
      if (!staff.currentSessionId) {
        throw new Error('Staff member is not clocked in');
      }

      const clockOutTime = new Date();

      // Find active work session
      const workSession = await WorkSession.findOne({
        sessionId: staff.currentSessionId,
        status: { $in: ['active', 'on_break'] }
      });

      if (!workSession) {
        throw new Error('No active work session found');
      }

      // If currently working on an order, end that tracking
      if (staff.currentOrderId) {
        await this.endOrderTracking(staffId, staff.currentOrderId);
      }

      // End any active break
      if (workSession.status === 'on_break') {
        const lastBreak = workSession.breaks[workSession.breaks.length - 1];
        if (lastBreak && !lastBreak.endTime) {
          lastBreak.endTime = clockOutTime;
          lastBreak.duration = Math.round((clockOutTime - lastBreak.startTime) / (1000 * 60));
        }
      }

      // Create clock out entry
      await TimeEntry.create({
        staffId: staff._id,
        staffName: staff.name || staff.email,
        type: 'clock_out',
        timestamp: clockOutTime,
        sessionId: staff.currentSessionId,
        ipAddress,
        userAgent
      });

      // Update work session
      workSession.clockOutTime = clockOutTime;
      workSession.status = 'completed';
      await workSession.save(); // This triggers pre-save hook to calculate durations

      console.log(`TimeTrackingService: Work session completed. Duration: ${workSession.workDuration} minutes`);

      // Update user status
      staff.currentStatus = 'offline';
      staff.lastClockOut = clockOutTime;
      staff.currentSessionId = null;
      staff.currentOrderId = null;
      staff.currentOrderNumber = null;
      staff.lastActivity = clockOutTime;

      // Update aggregated hours
      await this.updateAggregatedHours(staffId);

      await staff.save();

      console.log(`TimeTrackingService: Staff status updated to offline`);

      return {
        success: true,
        message: 'Clocked out successfully',
        session: {
          sessionId: workSession.sessionId,
          clockInTime: workSession.clockInTime,
          clockOutTime: workSession.clockOutTime,
          totalDuration: workSession.totalDuration,
          workDuration: workSession.workDuration,
          breakDuration: workSession.breakDuration,
          ordersWorked: workSession.ordersWorked.length,
          tasksWorked: workSession.tasksWorked.length
        }
      };
    } catch (error) {
      console.error('TimeTrackingService: Clock out error:', error);
      throw error;
    }
  }

  /**
   * Start a break period
   */
  static async startBreak(staffId, reason = null) {
    try {
      console.log(`TimeTrackingService: Start break for staff ${staffId}`);

      const staff = await User.findById(staffId);
      if (!staff || !staff.currentSessionId) {
        throw new Error('Staff member is not clocked in');
      }

      // If working on an order, pause that tracking
      if (staff.currentOrderId) {
        await this.endOrderTracking(staffId, staff.currentOrderId);
      }

      const breakStartTime = new Date();

      // Create break entry
      await TimeEntry.create({
        staffId: staff._id,
        staffName: staff.name || staff.email,
        type: 'break_start',
        timestamp: breakStartTime,
        sessionId: staff.currentSessionId,
        notes: reason
      });

      // Update work session
      const workSession = await WorkSession.findOne({
        sessionId: staff.currentSessionId
      });

      if (workSession) {
        workSession.breaks.push({
          startTime: breakStartTime,
          reason
        });
        workSession.status = 'on_break';
        await workSession.save();
      }

      // Update user status
      staff.currentStatus = 'on_break';
      staff.lastActivity = breakStartTime;
      await staff.save();

      console.log(`TimeTrackingService: Break started`);

      return {
        success: true,
        message: 'Break started',
        breakStartTime
      };
    } catch (error) {
      console.error('TimeTrackingService: Start break error:', error);
      throw error;
    }
  }

  /**
   * End a break period
   */
  static async endBreak(staffId) {
    try {
      console.log(`TimeTrackingService: End break for staff ${staffId}`);

      const staff = await User.findById(staffId);
      if (!staff || !staff.currentSessionId) {
        throw new Error('Staff member is not clocked in');
      }

      if (staff.currentStatus !== 'on_break') {
        throw new Error('Staff member is not on break');
      }

      const breakEndTime = new Date();

      // Create break end entry
      await TimeEntry.create({
        staffId: staff._id,
        staffName: staff.name || staff.email,
        type: 'break_end',
        timestamp: breakEndTime,
        sessionId: staff.currentSessionId
      });

      // Update work session
      const workSession = await WorkSession.findOne({
        sessionId: staff.currentSessionId
      });

      if (workSession) {
        const lastBreak = workSession.breaks[workSession.breaks.length - 1];
        if (lastBreak && !lastBreak.endTime) {
          lastBreak.endTime = breakEndTime;
          lastBreak.duration = Math.round((breakEndTime - lastBreak.startTime) / (1000 * 60));
        }
        workSession.status = 'active';
        await workSession.save();
      }

      // Update user status
      staff.currentStatus = 'online';
      staff.lastActivity = breakEndTime;
      await staff.save();

      console.log(`TimeTrackingService: Break ended`);

      return {
        success: true,
        message: 'Break ended',
        breakEndTime
      };
    } catch (error) {
      console.error('TimeTrackingService: End break error:', error);
      throw error;
    }
  }

  /**
   * Start tracking work on an order (automatic)
   * Called when staff opens/starts working on an order
   */
  static async startOrderTracking(staffId, orderId) {
    try {
      console.log(`TimeTrackingService: Start order tracking for staff ${staffId}, order ${orderId}`);

      const staff = await User.findById(staffId);
      if (!staff) {
        throw new Error('Staff member not found');
      }

      // Auto clock in if not already clocked in
      if (!staff.currentSessionId) {
        console.log(`TimeTrackingService: Auto-clocking in staff`);
        await this.clockIn(staffId);
        // Re-fetch staff after clock in
        const updatedStaff = await User.findById(staffId);
        Object.assign(staff, updatedStaff.toObject());
      }

      // If already working on another order, end that tracking first
      if (staff.currentOrderId && staff.currentOrderId.toString() !== orderId.toString()) {
        await this.endOrderTracking(staffId, staff.currentOrderId);
      }

      const order = await Order.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      const startTime = new Date();

      // Create order start entry
      await TimeEntry.create({
        staffId: staff._id,
        staffName: staff.name || staff.email,
        type: 'order_start',
        timestamp: startTime,
        sessionId: staff.currentSessionId,
        orderId: order._id,
        orderNumber: order.orderNumber
      });

      // Update work session
      const workSession = await WorkSession.findOne({
        sessionId: staff.currentSessionId
      });

      if (workSession) {
        workSession.ordersWorked.push({
          orderId: order._id,
          orderNumber: order.orderNumber,
          startTime
        });
        workSession.currentOrderId = order._id;
        await workSession.save();
      }

      // Update user status
      staff.currentStatus = 'working';
      staff.currentOrderId = order._id;
      staff.currentOrderNumber = order.orderNumber;
      staff.lastActivity = startTime;
      await staff.save();

      console.log(`TimeTrackingService: Order tracking started for order ${order.orderNumber}`);

      return {
        success: true,
        message: 'Order tracking started',
        orderId: order._id,
        orderNumber: order.orderNumber,
        startTime
      };
    } catch (error) {
      console.error('TimeTrackingService: Start order tracking error:', error);
      throw error;
    }
  }

  /**
   * End tracking work on an order (automatic)
   * Called when staff closes/completes work on an order
   */
  static async endOrderTracking(staffId, orderId) {
    try {
      console.log(`TimeTrackingService: End order tracking for staff ${staffId}, order ${orderId}`);

      const staff = await User.findById(staffId);
      if (!staff || !staff.currentSessionId) {
        console.log(`TimeTrackingService: Staff not clocked in, skipping order tracking end`);
        return { success: true, message: 'Not clocked in' };
      }

      const endTime = new Date();

      // Create order end entry
      await TimeEntry.create({
        staffId: staff._id,
        staffName: staff.name || staff.email,
        type: 'order_end',
        timestamp: endTime,
        sessionId: staff.currentSessionId,
        orderId
      });

      // Update work session
      const workSession = await WorkSession.findOne({
        sessionId: staff.currentSessionId
      });

      if (workSession) {
        const orderWork = workSession.ordersWorked.find(
          ow => ow.orderId && ow.orderId.toString() === orderId.toString() && !ow.endTime
        );

        if (orderWork) {
          orderWork.endTime = endTime;
          orderWork.duration = Math.round((endTime - orderWork.startTime) / (1000 * 60));
          console.log(`TimeTrackingService: Order work duration: ${orderWork.duration} minutes`);
        }

        workSession.currentOrderId = null;
        await workSession.save();
      }

      // Update user status
      if (staff.currentOrderId && staff.currentOrderId.toString() === orderId.toString()) {
        staff.currentStatus = 'online';
        staff.currentOrderId = null;
        staff.currentOrderNumber = null;
        staff.lastActivity = endTime;
        await staff.save();
      }

      console.log(`TimeTrackingService: Order tracking ended`);

      return {
        success: true,
        message: 'Order tracking ended',
        endTime
      };
    } catch (error) {
      console.error('TimeTrackingService: End order tracking error:', error);
      throw error;
    }
  }

  /**
   * Get current status of a staff member
   */
  static async getCurrentStatus(staffId) {
    try {
      const staff = await User.findById(staffId).select(
        'currentStatus currentSessionId lastClockIn lastClockOut currentOrderId currentOrderNumber lastActivity'
      );

      if (!staff) {
        throw new Error('Staff member not found');
      }

      let activeSession = null;
      if (staff.currentSessionId) {
        activeSession = await WorkSession.findOne({
          sessionId: staff.currentSessionId
        }).select('clockInTime status breaks ordersWorked');
      }

      return {
        success: true,
        status: staff.currentStatus,
        sessionId: staff.currentSessionId,
        lastClockIn: staff.lastClockIn,
        lastClockOut: staff.lastClockOut,
        currentOrder: staff.currentOrderId ? {
          orderId: staff.currentOrderId,
          orderNumber: staff.currentOrderNumber
        } : null,
        lastActivity: staff.lastActivity,
        activeSession
      };
    } catch (error) {
      console.error('TimeTrackingService: Get current status error:', error);
      throw error;
    }
  }

  /**
   * Get time entries for a staff member with filters
   */
  static async getTimeEntries(staffId, filters = {}) {
    try {
      const {
        startDate,
        endDate,
        type,
        orderId,
        page = 1,
        limit = 50
      } = filters;

      const query = { staffId };

      if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) query.timestamp.$gte = new Date(startDate);
        if (endDate) query.timestamp.$lte = new Date(endDate);
      }

      if (type) query.type = type;
      if (orderId) query.orderId = orderId;

      const skip = (page - 1) * limit;

      const [entries, total] = await Promise.all([
        TimeEntry.find(query)
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(limit)
          .populate('orderId', 'orderNumber status')
          .lean(),
        TimeEntry.countDocuments(query)
      ]);

      return {
        success: true,
        entries,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('TimeTrackingService: Get time entries error:', error);
      throw error;
    }
  }

  /**
   * Get work sessions for a staff member
   */
  static async getWorkSessions(staffId, filters = {}) {
    try {
      const {
        startDate,
        endDate,
        status,
        page = 1,
        limit = 20
      } = filters;

      const query = { staffId };

      if (startDate || endDate) {
        query.clockInTime = {};
        if (startDate) query.clockInTime.$gte = new Date(startDate);
        if (endDate) query.clockInTime.$lte = new Date(endDate);
      }

      if (status) query.status = status;

      const skip = (page - 1) * limit;

      const [sessions, total] = await Promise.all([
        WorkSession.find(query)
          .sort({ clockInTime: -1 })
          .skip(skip)
          .limit(limit)
          .populate('ordersWorked.orderId', 'orderNumber status')
          .lean(),
        WorkSession.countDocuments(query)
      ]);

      return {
        success: true,
        sessions,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('TimeTrackingService: Get work sessions error:', error);
      throw error;
    }
  }

  /**
   * Update aggregated hours for a staff member
   */
  static async updateAggregatedHours(staffId) {
    try {
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Calculate hours this week
      const weekSessions = await WorkSession.find({
        staffId,
        clockInTime: { $gte: startOfWeek },
        status: 'completed'
      });

      const hoursThisWeek = weekSessions.reduce((sum, session) =>
        sum + (session.workDuration || 0), 0) / 60;

      // Calculate hours this month
      const monthSessions = await WorkSession.find({
        staffId,
        clockInTime: { $gte: startOfMonth },
        status: 'completed'
      });

      const hoursThisMonth = monthSessions.reduce((sum, session) =>
        sum + (session.workDuration || 0), 0) / 60;

      // Calculate total hours
      const allSessions = await WorkSession.find({
        staffId,
        status: 'completed'
      });

      const totalHoursWorked = allSessions.reduce((sum, session) =>
        sum + (session.workDuration || 0), 0) / 60;

      // Update user
      await User.findByIdAndUpdate(staffId, {
        hoursThisWeek: Math.round(hoursThisWeek * 100) / 100,
        hoursThisMonth: Math.round(hoursThisMonth * 100) / 100,
        totalHoursWorked: Math.round(totalHoursWorked * 100) / 100
      });

      console.log(`TimeTrackingService: Updated aggregated hours for staff ${staffId}`);

      return {
        success: true,
        hoursThisWeek,
        hoursThisMonth,
        totalHoursWorked
      };
    } catch (error) {
      console.error('TimeTrackingService: Update aggregated hours error:', error);
      throw error;
    }
  }

  /**
   * Get all staff with their current status (for admin dashboard)
   */
  static async getAllStaffStatus() {
    try {
      const staff = await User.find({
        role: { $in: ['staff', 'admin'] },
        isActive: true
      }).select(
        'name email avatar currentStatus lastActivity currentOrderNumber hoursThisWeek hoursThisMonth'
      ).sort({ name: 1 });

      return {
        success: true,
        staff: staff.map(s => ({
          _id: s._id,
          name: s.name || s.email,
          email: s.email,
          avatar: s.avatar,
          currentStatus: s.currentStatus || 'offline',
          lastActivity: s.lastActivity,
          currentOrder: s.currentOrderNumber,
          hoursThisWeek: s.hoursThisWeek || 0,
          hoursThisMonth: s.hoursThisMonth || 0
        }))
      };
    } catch (error) {
      console.error('TimeTrackingService: Get all staff status error:', error);
      throw error;
    }
  }

  /**
   * Get time tracking summary for a staff member
   */
  static async getTimeTrackingSummary(staffId, filters = {}) {
    try {
      const staff = await User.findById(staffId).select(
        'currentStatus lastClockIn lastClockOut hoursThisWeek hoursThisMonth totalHoursWorked'
      );

      if (!staff) {
        throw new Error('Staff member not found');
      }

      const requestedDate = filters?.date ? new Date(filters.date) : null;
      const hasRequestedDate = requestedDate && Number.isFinite(requestedDate.getTime());
      const dayReference = hasRequestedDate ? requestedDate : new Date();
      const now = new Date();
      const rangeEnd = hasRequestedDate
        ? new Date(dayReference.getFullYear(), dayReference.getMonth(), dayReference.getDate(), 23, 59, 59, 999)
        : now;
      const startOfDay = new Date(dayReference);
      startOfDay.setHours(0, 0, 0, 0);

      const [todaySessions, allSessions] = await Promise.all([
        WorkSession.find({
          staffId,
          $or: [
            { clockInTime: { $gte: startOfDay, $lte: rangeEnd } },
            { clockOutTime: { $gte: startOfDay } },
            { status: { $in: ['active', 'on_break'] }, clockInTime: { $lte: rangeEnd } }
          ]
        }).lean(),
        WorkSession.find({ staffId }).select('breakDuration status breaks').lean()
      ]);

      let workMinutesToday = 0;
      let breakMinutesToday = 0;
      const breaksToday = [];
      const ordersTodayMap = new Map();

      todaySessions.forEach((session) => {
        const sessionEnd = session.clockOutTime || now;
        const sessionMinutesToday = getOverlapMinutes(session.clockInTime, sessionEnd, startOfDay, rangeEnd);

        if (sessionMinutesToday <= 0) {
          return;
        }

        const sessionBreakMinutes = (session.breaks || []).reduce((sum, breakItem) => {
          const mappedBreak = mapBreakInterval(breakItem, startOfDay, rangeEnd);
          if (mappedBreak) {
            breaksToday.push(mappedBreak);
            return sum + Math.round((mappedBreak.durationHours || 0) * 60);
          }
          return sum;
        }, 0);

        breakMinutesToday += sessionBreakMinutes;
        workMinutesToday += Math.max(sessionMinutesToday - sessionBreakMinutes, 0);

        (session.ordersWorked || []).forEach((orderWork) => {
          const orderMinutesToday = getOverlapMinutes(
            orderWork.startTime,
            orderWork.endTime || now,
            startOfDay,
            rangeEnd
          );

          if (orderMinutesToday <= 0) {
            return;
          }

          const orderKey = String(orderWork.orderId || orderWork.orderNumber || `order-${ordersTodayMap.size}`);
          const existing = ordersTodayMap.get(orderKey);

          if (existing) {
            existing.durationMinutes += orderMinutesToday;
            existing.startTime = new Date(existing.startTime) < new Date(orderWork.startTime)
              ? existing.startTime
              : orderWork.startTime;
            existing.endTime = orderWork.endTime || existing.endTime;
            return;
          }

          ordersTodayMap.set(orderKey, {
            orderId: orderWork.orderId || null,
            orderNumber: orderWork.orderNumber || 'Ohne Nummer',
            startTime: orderWork.startTime,
            endTime: orderWork.endTime || null,
            durationMinutes: orderMinutesToday
          });
        });
      });

      const totalBreakMinutes = allSessions.reduce((sum, session) => {
        const sessionBreakMinutes = (session.breaks || []).reduce((breakSum, breakItem) => {
          if (!breakItem?.startTime) {
            return breakSum;
          }

          if (breakItem.duration && breakItem.endTime) {
            return breakSum + breakItem.duration;
          }

          return breakSum + getOverlapMinutes(breakItem.startTime, breakItem.endTime || now, breakItem.startTime, now);
        }, 0);

        return sum + sessionBreakMinutes;
      }, 0);

      const ordersToday = Array.from(ordersTodayMap.values())
        .map((orderWork) => ({
          orderId: orderWork.orderId,
          orderNumber: orderWork.orderNumber,
          startTime: orderWork.startTime,
          endTime: orderWork.endTime,
          durationHours: roundHours(orderWork.durationMinutes)
        }))
        .sort((a, b) => b.durationHours - a.durationHours);

      breaksToday.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

      // Calculate average hours per day this month
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const daysInMonth = Math.ceil((new Date() - startOfMonth) / (1000 * 60 * 60 * 24)) || 1;
      const averageHoursPerDay = (staff.hoursThisMonth || 0) / daysInMonth;

      return {
        success: true,
        summary: {
          currentStatus: staff.currentStatus || 'offline',
          lastClockIn: staff.lastClockIn,
          lastClockOut: staff.lastClockOut,
          hoursToday: roundHours(workMinutesToday),
          hoursThisWeek: staff.hoursThisWeek || 0,
          hoursThisMonth: staff.hoursThisMonth || 0,
          totalHoursWorked: staff.totalHoursWorked || 0,
          totalBreakHours: roundHours(totalBreakMinutes),
          breakHoursToday: roundHours(breakMinutesToday),
          averageHoursPerDay: Math.round(averageHoursPerDay * 100) / 100,
          selectedDate: startOfDay,
          breaksToday,
          ordersToday
        }
      };
    } catch (error) {
      console.error('TimeTrackingService: Get time tracking summary error:', error);
      throw error;
    }
  }
}

module.exports = TimeTrackingService;
