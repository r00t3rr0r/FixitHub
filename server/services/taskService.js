const Task = require('../models/Task');
const User = require('../models/User');
const Team = require('../models/Team');

class TaskService {
  // Get tasks with filtering
  static async getTasks(filters = {}) {
    console.log('TaskService: Getting tasks with filters:', filters);

    try {
      const query = {};

      // Apply filters
      if (filters.assignedTo) {
        query.assignedTo = filters.assignedTo;
      }

      if (filters.teamId) {
        query.teamId = filters.teamId;
      }

      if (filters.status && filters.status !== 'all') {
        query.status = filters.status;
      }

      if (filters.priority && filters.priority !== 'all') {
        query.priority = filters.priority;
      }

      if (filters.category && filters.category !== 'all') {
        query.category = filters.category;
      }

      if (filters.search) {
        query.$or = [
          { title: { $regex: filters.search, $options: 'i' } },
          { description: { $regex: filters.search, $options: 'i' } }
        ];
      }

      // Date range filters
      if (filters.dueDateFrom || filters.dueDateTo) {
        query.dueDate = {};
        if (filters.dueDateFrom) {
          query.dueDate.$gte = new Date(filters.dueDateFrom);
        }
        if (filters.dueDateTo) {
          query.dueDate.$lte = new Date(filters.dueDateTo);
        }
      }

      const tasks = await Task.find(query)
        .populate('assignedTo', 'name email avatar')
        .populate('assignedBy', 'name email')
        .populate('teamId', 'name')
        .populate('orderId', 'orderNumber')
        .sort({ dueDate: 1, priority: 1 });

      console.log('TaskService: Found', tasks.length, 'tasks');
      return tasks;
    } catch (error) {
      console.error('TaskService: Error getting tasks:', error);
      throw error;
    }
  }

  // Create new task
  static async createTask(taskData, creatorId) {
    console.log('TaskService: Creating new task:', taskData.title);

    try {
      // Validate assigned user exists
      const assignedUser = await User.findById(taskData.assignedTo);
      if (!assignedUser || !['staff', 'admin'].includes(assignedUser.role)) {
        throw new Error('Invalid assigned user');
      }

      // Validate team if provided
      if (taskData.teamId) {
        const team = await Team.findById(taskData.teamId);
        if (!team) {
          throw new Error('Invalid team');
        }
      }

      const newTask = new Task({
        ...taskData,
        assignedBy: creatorId
      });

      await newTask.save();

      const populatedTask = await Task.findById(newTask._id)
        .populate('assignedTo', 'name email avatar')
        .populate('assignedBy', 'name email')
        .populate('teamId', 'name')
        .populate('orderId', 'orderNumber');

      console.log('TaskService: Task created successfully');
      return populatedTask;
    } catch (error) {
      console.error('TaskService: Error creating task:', error);
      throw error;
    }
  }

  // Update task
  static async updateTask(taskId, updateData, userId) {
    console.log('TaskService: Updating task:', taskId);

    try {
      const task = await Task.findById(taskId);
      if (!task) {
        throw new Error('Task not found');
      }

      // Check permissions (assigned user, creator, or admin can update)
      const user = await User.findById(userId);
      const canUpdate = task.assignedTo.toString() === userId ||
                       task.assignedBy.toString() === userId ||
                       user.role === 'admin';

      if (!canUpdate) {
        throw new Error('Permission denied');
      }

      const updatedTask = await Task.findByIdAndUpdate(
        taskId,
        updateData,
        { new: true, runValidators: true }
      )
      .populate('assignedTo', 'name email avatar')
      .populate('assignedBy', 'name email')
      .populate('teamId', 'name')
      .populate('orderId', 'orderNumber');

      console.log('TaskService: Task updated successfully');
      return updatedTask;
    } catch (error) {
      console.error('TaskService: Error updating task:', error);
      throw error;
    }
  }

  // Delete task
  static async deleteTask(taskId, userId) {
    console.log('TaskService: Deleting task:', taskId);

    try {
      const task = await Task.findById(taskId);
      if (!task) {
        throw new Error('Task not found');
      }

      // Check permissions
      const user = await User.findById(userId);
      const canDelete = task.assignedBy.toString() === userId || user.role === 'admin';

      if (!canDelete) {
        throw new Error('Permission denied');
      }

      await Task.findByIdAndDelete(taskId);
      console.log('TaskService: Task deleted successfully');
      return { success: true, message: 'Task deleted successfully' };
    } catch (error) {
      console.error('TaskService: Error deleting task:', error);
      throw error;
    }
  }

  // Add comment to task
  static async addTaskComment(taskId, userId, comment) {
    console.log('TaskService: Adding comment to task:', taskId);

    try {
      const task = await Task.findById(taskId);
      if (!task) {
        throw new Error('Task not found');
      }

      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      task.comments.push({
        userId: userId,
        userName: user.name,
        comment: comment,
        createdAt: new Date()
      });

      await task.save();

      const updatedTask = await Task.findById(taskId)
        .populate('assignedTo', 'name email avatar')
        .populate('assignedBy', 'name email')
        .populate('teamId', 'name')
        .populate('orderId', 'orderNumber');

      console.log('TaskService: Comment added successfully');
      return updatedTask;
    } catch (error) {
      console.error('TaskService: Error adding comment:', error);
      throw error;
    }
  }

  // Get task statistics
  static async getTaskStatistics(filters = {}) {
    console.log('TaskService: Getting task statistics');

    try {
      const query = {};
      
      if (filters.assignedTo) {
        query.assignedTo = filters.assignedTo;
      }

      if (filters.teamId) {
        query.teamId = filters.teamId;
      }

      const [
        totalTasks,
        pendingTasks,
        inProgressTasks,
        completedTasks,
        overdueTasks
      ] = await Promise.all([
        Task.countDocuments(query),
        Task.countDocuments({ ...query, status: 'pending' }),
        Task.countDocuments({ ...query, status: 'in_progress' }),
        Task.countDocuments({ ...query, status: 'completed' }),
        Task.countDocuments({
          ...query,
          status: { $in: ['pending', 'in_progress'] },
          dueDate: { $lt: new Date() }
        })
      ]);

      const statistics = {
        totalTasks,
        pendingTasks,
        inProgressTasks,
        completedTasks,
        overdueTasks,
        completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
      };

      console.log('TaskService: Task statistics calculated');
      return statistics;
    } catch (error) {
      console.error('TaskService: Error getting task statistics:', error);
      throw error;
    }
  }
}

module.exports = TaskService;