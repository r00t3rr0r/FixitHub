const Reminder = require('../models/Reminder');
const Booking = require('../models/Booking');
const User = require('../models/User');

class ReminderService {
  // Create a new reminder
  static async create(reminderData) {
    console.log('ReminderService: Creating new reminder with data:', reminderData);

    try {
      // Validate booking exists
      const booking = await Booking.findById(reminderData.bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }

      // Validate customer exists
      const customer = await User.findById(reminderData.customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }

      // Get creator info
      const creator = await User.findById(reminderData.createdBy);
      const createdByName = creator
        ? `${creator.firstName || creator.name || ''} ${creator.lastName || ''}`.trim()
        : 'System';

      const reminder = new Reminder({
        bookingId: reminderData.bookingId,
        orderId: reminderData.orderId,
        customerId: reminderData.customerId,
        type: reminderData.type,
        title: reminderData.title,
        message: reminderData.message,
        scheduledDate: reminderData.scheduledDate,
        notificationMethod: reminderData.notificationMethod || ['email', 'in-app'],
        priority: reminderData.priority || 'medium',
        createdBy: reminderData.createdBy,
        createdByName: createdByName,
        recurring: reminderData.recurring || { enabled: false },
        metadata: reminderData.metadata || {}
      });

      const savedReminder = await reminder.save();
      console.log('ReminderService: Reminder created successfully with ID:', savedReminder._id);

      return savedReminder;
    } catch (error) {
      console.error('ReminderService: Error creating reminder:', error);
      throw error;
    }
  }

  // Get reminder by ID
  static async getById(reminderId) {
    console.log('ReminderService: Getting reminder:', reminderId);

    try {
      const reminder = await Reminder.findById(reminderId);

      if (!reminder) {
        console.log('ReminderService: Reminder not found:', reminderId);
        return null;
      }

      console.log('ReminderService: Reminder retrieved successfully');
      return reminder;
    } catch (error) {
      console.error('ReminderService: Error getting reminder:', error);
      throw error;
    }
  }

  // Get all reminders for a booking
  static async getByBooking(bookingId) {
    console.log('ReminderService: Getting reminders for booking:', bookingId);

    try {
      const reminders = await Reminder.find({ bookingId })
        .sort({ scheduledDate: 1 });

      console.log('ReminderService: Found', reminders.length, 'reminders for booking');
      return reminders;
    } catch (error) {
      console.error('ReminderService: Error getting reminders:', error);
      throw error;
    }
  }

  // Get all reminders (admin view)
  static async getAll(filters = {}) {
    console.log('ReminderService: Getting all reminders with filters:', filters);

    try {
      const query = {};

      // Apply status filter
      if (filters.status) {
        query.status = filters.status;
      }

      // Apply type filter
      if (filters.type) {
        query.type = filters.type;
      }

      // Apply date range filter
      if (filters.dateFrom || filters.dateTo) {
        query.scheduledDate = {};
        if (filters.dateFrom) {
          query.scheduledDate.$gte = new Date(filters.dateFrom);
        }
        if (filters.dateTo) {
          query.scheduledDate.$lte = new Date(filters.dateTo);
        }
      }

      const reminders = await Reminder.find(query)
        .sort({ scheduledDate: 1 })
        .limit(filters.limit || 50)
        .skip(filters.skip || 0);

      console.log('ReminderService: Found', reminders.length, 'total reminders');
      return reminders;
    } catch (error) {
      console.error('ReminderService: Error getting all reminders:', error);
      throw error;
    }
  }

  // Update reminder status
  static async updateStatus(reminderId, status) {
    console.log('ReminderService: Updating reminder status:', reminderId, 'to:', status);

    try {
      const reminder = await Reminder.findById(reminderId);
      if (!reminder) {
        throw new Error('Reminder not found');
      }

      reminder.status = status;

      if (status === 'sent') {
        reminder.sentAt = new Date();
      } else if (status === 'delivered') {
        reminder.deliveredAt = new Date();
      }

      const savedReminder = await reminder.save();
      console.log('ReminderService: Reminder status updated successfully');

      return savedReminder;
    } catch (error) {
      console.error('ReminderService: Error updating reminder status:', error);
      throw error;
    }
  }

  // Update reminder details
  static async update(reminderId, updateData) {
    console.log('ReminderService: Updating reminder:', reminderId);

    try {
      const reminder = await Reminder.findById(reminderId);
      if (!reminder) {
        throw new Error('Reminder not found');
      }

      // Update allowed fields
      if (updateData.title) reminder.title = updateData.title;
      if (updateData.message) reminder.message = updateData.message;
      if (updateData.scheduledDate) reminder.scheduledDate = updateData.scheduledDate;
      if (updateData.notificationMethod) reminder.notificationMethod = updateData.notificationMethod;
      if (updateData.priority) reminder.priority = updateData.priority;
      if (updateData.recurring) reminder.recurring = updateData.recurring;

      const savedReminder = await reminder.save();
      console.log('ReminderService: Reminder updated successfully');

      return savedReminder;
    } catch (error) {
      console.error('ReminderService: Error updating reminder:', error);
      throw error;
    }
  }

  // Cancel reminder
  static async cancel(reminderId) {
    console.log('ReminderService: Cancelling reminder:', reminderId);

    try {
      const reminder = await Reminder.findById(reminderId);
      if (!reminder) {
        throw new Error('Reminder not found');
      }

      reminder.status = 'cancelled';

      const savedReminder = await reminder.save();
      console.log('ReminderService: Reminder cancelled successfully');

      return savedReminder;
    } catch (error) {
      console.error('ReminderService: Error cancelling reminder:', error);
      throw error;
    }
  }

  // Delete reminder
  static async delete(reminderId) {
    console.log('ReminderService: Deleting reminder:', reminderId);

    try {
      const result = await Reminder.findByIdAndDelete(reminderId);

      if (!result) {
        throw new Error('Reminder not found');
      }

      console.log('ReminderService: Reminder deleted successfully');
      return result;
    } catch (error) {
      console.error('ReminderService: Error deleting reminder:', error);
      throw error;
    }
  }

  // Get due reminders (for scheduled notifications)
  static async getDueReminders() {
    console.log('ReminderService: Getting due reminders');

    try {
      const now = new Date();
      const reminders = await Reminder.find({
        status: 'scheduled',
        scheduledDate: { $lte: now }
      }).sort({ scheduledDate: 1 });

      console.log('ReminderService: Found', reminders.length, 'due reminders');
      return reminders;
    } catch (error) {
      console.error('ReminderService: Error getting due reminders:', error);
      throw error;
    }
  }
}

module.exports = ReminderService;
