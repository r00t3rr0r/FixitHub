const ScheduleEvent = require('../models/Schedule');
const User = require('../models/User');

class ScheduleService {
  // Get schedule events for a staff member
  static async getStaffSchedule(staffId, filters = {}) {
    console.log('ScheduleService: Getting schedule for staff:', staffId);

    try {
      const query = { staffId };

      // Date range filter
      if (filters.startDate && filters.endDate) {
        query.startTime = {
          $gte: new Date(filters.startDate),
          $lte: new Date(filters.endDate)
        };
      }

      // Status filter
      if (filters.status) {
        query.status = filters.status;
      }

      const events = await ScheduleEvent.find(query)
        .populate('orderId', 'orderNumber deviceBrand deviceModel')
        .populate('createdBy', 'name')
        .sort({ startTime: 1 });

      console.log('ScheduleService: Found', events.length, 'schedule events');
      return events;
    } catch (error) {
      console.error('ScheduleService: Error getting staff schedule:', error);
      throw error;
    }
  }

  // Create a new schedule event
  static async createScheduleEvent(eventData, creatorId) {
    console.log('ScheduleService: Creating schedule event:', eventData.title);

    try {
      // Validate staff member exists
      const staff = await User.findById(eventData.staffId);
      if (!staff || !['staff', 'admin'].includes(staff.role)) {
        throw new Error('Invalid staff member');
      }

      // Check for conflicts
      const conflicts = await this.checkScheduleConflicts(
        eventData.staffId,
        eventData.startTime,
        eventData.endTime
      );

      if (conflicts.length > 0) {
        throw new Error('Schedule conflict detected');
      }

      const event = new ScheduleEvent({
        ...eventData,
        createdBy: creatorId
      });

      const savedEvent = await event.save();
      console.log('ScheduleService: Schedule event created successfully');
      return savedEvent;
    } catch (error) {
      console.error('ScheduleService: Error creating schedule event:', error);
      throw error;
    }
  }

  // Update schedule event
  static async updateScheduleEvent(eventId, updateData, userId) {
    console.log('ScheduleService: Updating schedule event:', eventId);

    try {
      const event = await ScheduleEvent.findById(eventId);
      if (!event) {
        throw new Error('Schedule event not found');
      }

      // Check permissions (only creator, assigned staff, or admin can update)
      const user = await User.findById(userId);
      const canUpdate = event.createdBy.toString() === userId ||
                       event.staffId.toString() === userId ||
                       user.role === 'admin';

      if (!canUpdate) {
        throw new Error('Permission denied');
      }

      // Check for conflicts if time is being changed
      if (updateData.startTime || updateData.endTime) {
        const startTime = updateData.startTime || event.startTime;
        const endTime = updateData.endTime || event.endTime;

        const conflicts = await this.checkScheduleConflicts(
          event.staffId,
          startTime,
          endTime,
          eventId
        );

        if (conflicts.length > 0) {
          throw new Error('Schedule conflict detected');
        }
      }

      const updatedEvent = await ScheduleEvent.findByIdAndUpdate(
        eventId,
        updateData,
        { new: true, runValidators: true }
      );

      console.log('ScheduleService: Schedule event updated successfully');
      return updatedEvent;
    } catch (error) {
      console.error('ScheduleService: Error updating schedule event:', error);
      throw error;
    }
  }

  // Delete schedule event
  static async deleteScheduleEvent(eventId, userId) {
    console.log('ScheduleService: Deleting schedule event:', eventId);

    try {
      const event = await ScheduleEvent.findById(eventId);
      if (!event) {
        throw new Error('Schedule event not found');
      }

      // Check permissions
      const user = await User.findById(userId);
      const canDelete = event.createdBy.toString() === userId ||
                       event.staffId.toString() === userId ||
                       user.role === 'admin';

      if (!canDelete) {
        throw new Error('Permission denied');
      }

      await ScheduleEvent.findByIdAndDelete(eventId);
      console.log('ScheduleService: Schedule event deleted successfully');
      return { success: true, message: 'Schedule event deleted successfully' };
    } catch (error) {
      console.error('ScheduleService: Error deleting schedule event:', error);
      throw error;
    }
  }

  // Check for schedule conflicts
  static async checkScheduleConflicts(staffId, startTime, endTime, excludeEventId = null) {
    console.log('ScheduleService: Checking schedule conflicts for staff:', staffId);

    try {
      const query = {
        staffId,
        status: { $ne: 'cancelled' },
        $or: [
          {
            startTime: { $lt: endTime },
            endTime: { $gt: startTime }
          }
        ]
      };

      if (excludeEventId) {
        query._id = { $ne: excludeEventId };
      }

      const conflicts = await ScheduleEvent.find(query);
      console.log('ScheduleService: Found', conflicts.length, 'conflicts');
      return conflicts;
    } catch (error) {
      console.error('ScheduleService: Error checking conflicts:', error);
      throw error;
    }
  }

  // Get team schedule overview
  static async getTeamSchedule(filters = {}) {
    console.log('ScheduleService: Getting team schedule');

    try {
      const query = {};

      // Date range filter
      if (filters.startDate && filters.endDate) {
        query.startTime = {
          $gte: new Date(filters.startDate),
          $lte: new Date(filters.endDate)
        };
      }

      const events = await ScheduleEvent.find(query)
        .populate('staffId', 'name avatar role')
        .populate('orderId', 'orderNumber deviceBrand deviceModel')
        .populate('createdBy', 'name')
        .sort({ startTime: 1 });

      console.log('ScheduleService: Found', events.length, 'team schedule events');
      return events;
    } catch (error) {
      console.error('ScheduleService: Error getting team schedule:', error);
      throw error;
    }
  }
}

module.exports = ScheduleService;