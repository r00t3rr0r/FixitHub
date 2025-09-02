const express = require('express');
const StaffService = require('../services/staffService');
const TeamService = require('../services/teamService');
const TaskService = require('../services/taskService');
const { requireUser } = require('./middleware/auth');

const router = express.Router();

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Staff Management Routes

// Get all staff members
router.get('/staff', requireUser, requireAdmin, async (req, res) => {
  console.log('Staff Management: Get staff members request from:', req.user.email);

  try {
    const filters = {
      role: req.query.role,
      status: req.query.status,
      specialization: req.query.specialization,
      search: req.query.search
    };

    const staff = await StaffService.getStaffMembers(filters);
    return res.status(200).json({ staff });
  } catch (error) {
    console.error('Staff Management: Error getting staff members:', error);
    return res.status(500).json({ error: error.message || 'Failed to get staff members' });
  }
});

// Create new staff member
router.post('/staff', requireUser, requireAdmin, async (req, res) => {
  console.log('Staff Management: Create staff member request from:', req.user.email);

  try {
    const staff = await StaffService.createStaffMember(req.body);
    return res.status(201).json({ success: true, staff });
  } catch (error) {
    console.error('Staff Management: Error creating staff member:', error);
    return res.status(400).json({ error: error.message || 'Failed to create staff member' });
  }
});

// Update staff member
router.put('/staff/:id', requireUser, requireAdmin, async (req, res) => {
  console.log('Staff Management: Update staff member request:', req.params.id);

  try {
    const staff = await StaffService.updateStaffMember(req.params.id, req.body);
    return res.status(200).json({ success: true, staff });
  } catch (error) {
    console.error('Staff Management: Error updating staff member:', error);
    if (error.message === 'Staff member not found') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(400).json({ error: error.message || 'Failed to update staff member' });
  }
});

// Delete staff member
router.delete('/staff/:id', requireUser, requireAdmin, async (req, res) => {
  console.log('Staff Management: Delete staff member request:', req.params.id);

  try {
    const result = await StaffService.deleteStaffMember(req.params.id);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Staff Management: Error deleting staff member:', error);
    if (error.message === 'Staff member not found') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(400).json({ error: error.message || 'Failed to delete staff member' });
  }
});

// Get workload distribution
router.get('/workload', requireUser, requireAdmin, async (req, res) => {
  console.log('Staff Management: Get workload distribution request from:', req.user.email);

  try {
    const workload = await StaffService.getWorkloadDistribution();
    return res.status(200).json({ workload });
  } catch (error) {
    console.error('Staff Management: Error getting workload distribution:', error);
    return res.status(500).json({ error: error.message || 'Failed to get workload distribution' });
  }
});

// Team Management Routes

// Get all teams
router.get('/teams', requireUser, requireAdmin, async (req, res) => {
  console.log('Staff Management: Get teams request from:', req.user.email);

  try {
    const filters = {
      active: req.query.active
    };

    const teams = await TeamService.getTeams(filters);
    return res.status(200).json({ teams });
  } catch (error) {
    console.error('Staff Management: Error getting teams:', error);
    return res.status(500).json({ error: error.message || 'Failed to get teams' });
  }
});

// Create new team
router.post('/teams', requireUser, requireAdmin, async (req, res) => {
  console.log('Staff Management: Create team request from:', req.user.email);

  try {
    const team = await TeamService.createTeam(req.body, req.user._id);
    return res.status(201).json({ success: true, team });
  } catch (error) {
    console.error('Staff Management: Error creating team:', error);
    return res.status(400).json({ error: error.message || 'Failed to create team' });
  }
});

// Update team
router.put('/teams/:id', requireUser, requireAdmin, async (req, res) => {
  console.log('Staff Management: Update team request:', req.params.id);

  try {
    const team = await TeamService.updateTeam(req.params.id, req.body);
    return res.status(200).json({ success: true, team });
  } catch (error) {
    console.error('Staff Management: Error updating team:', error);
    if (error.message === 'Team not found') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(400).json({ error: error.message || 'Failed to update team' });
  }
});

// Delete team
router.delete('/teams/:id', requireUser, requireAdmin, async (req, res) => {
  console.log('Staff Management: Delete team request:', req.params.id);

  try {
    const result = await TeamService.deleteTeam(req.params.id);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Staff Management: Error deleting team:', error);
    if (error.message === 'Team not found') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(400).json({ error: error.message || 'Failed to delete team' });
  }
});

// Add member to team
router.post('/teams/:id/members', requireUser, requireAdmin, async (req, res) => {
  console.log('Staff Management: Add member to team request:', req.params.id);

  try {
    const { userId, role } = req.body;
    const team = await TeamService.addMemberToTeam(req.params.id, userId, role);
    return res.status(200).json({ success: true, team });
  } catch (error) {
    console.error('Staff Management: Error adding member to team:', error);
    return res.status(400).json({ error: error.message || 'Failed to add member to team' });
  }
});

// Remove member from team
router.delete('/teams/:id/members/:userId', requireUser, requireAdmin, async (req, res) => {
  console.log('Staff Management: Remove member from team request:', req.params.id, req.params.userId);

  try {
    const team = await TeamService.removeMemberFromTeam(req.params.id, req.params.userId);
    return res.status(200).json({ success: true, team });
  } catch (error) {
    console.error('Staff Management: Error removing member from team:', error);
    return res.status(400).json({ error: error.message || 'Failed to remove member from team' });
  }
});

// Task Management Routes

// Get tasks
router.get('/tasks', requireUser, async (req, res) => {
  console.log('Staff Management: Get tasks request from:', req.user.email);

  try {
    const filters = {
      assignedTo: req.query.assignedTo,
      teamId: req.query.teamId,
      status: req.query.status,
      priority: req.query.priority,
      category: req.query.category,
      search: req.query.search,
      dueDateFrom: req.query.dueDateFrom,
      dueDateTo: req.query.dueDateTo
    };

    // Non-admin users can only see their own tasks or tasks in their teams
    if (req.user.role !== 'admin') {
      filters.assignedTo = req.user._id;
    }

    const tasks = await TaskService.getTasks(filters);
    return res.status(200).json({ tasks });
  } catch (error) {
    console.error('Staff Management: Error getting tasks:', error);
    return res.status(500).json({ error: error.message || 'Failed to get tasks' });
  }
});

// Create new task
router.post('/tasks', requireUser, async (req, res) => {
  console.log('Staff Management: Create task request from:', req.user.email);

  try {
    // Only admin and supervisors can create tasks
    if (!['admin', 'staff'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const task = await TaskService.createTask(req.body, req.user._id);
    return res.status(201).json({ success: true, task });
  } catch (error) {
    console.error('Staff Management: Error creating task:', error);
    return res.status(400).json({ error: error.message || 'Failed to create task' });
  }
});

// Update task
router.put('/tasks/:id', requireUser, async (req, res) => {
  console.log('Staff Management: Update task request:', req.params.id);

  try {
    const task = await TaskService.updateTask(req.params.id, req.body, req.user._id);
    return res.status(200).json({ success: true, task });
  } catch (error) {
    console.error('Staff Management: Error updating task:', error);
    if (error.message === 'Task not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Permission denied') {
      return res.status(403).json({ error: error.message });
    }
    return res.status(400).json({ error: error.message || 'Failed to update task' });
  }
});

// Delete task
router.delete('/tasks/:id', requireUser, async (req, res) => {
  console.log('Staff Management: Delete task request:', req.params.id);

  try {
    const result = await TaskService.deleteTask(req.params.id, req.user._id);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Staff Management: Error deleting task:', error);
    if (error.message === 'Task not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Permission denied') {
      return res.status(403).json({ error: error.message });
    }
    return res.status(400).json({ error: error.message || 'Failed to delete task' });
  }
});

// Add comment to task
router.post('/tasks/:id/comments', requireUser, async (req, res) => {
  console.log('Staff Management: Add comment to task request:', req.params.id);

  try {
    const { comment } = req.body;
    if (!comment) {
      return res.status(400).json({ error: 'Comment is required' });
    }

    const task = await TaskService.addTaskComment(req.params.id, req.user._id, comment);
    return res.status(200).json({ success: true, task });
  } catch (error) {
    console.error('Staff Management: Error adding comment:', error);
    if (error.message === 'Task not found') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(400).json({ error: error.message || 'Failed to add comment' });
  }
});

// Get task statistics
router.get('/tasks/statistics', requireUser, async (req, res) => {
  console.log('Staff Management: Get task statistics request from:', req.user.email);

  try {
    const filters = {};
    
    // Non-admin users can only see their own statistics
    if (req.user.role !== 'admin') {
      filters.assignedTo = req.user._id;
    } else if (req.query.assignedTo) {
      filters.assignedTo = req.query.assignedTo;
    }

    if (req.query.teamId) {
      filters.teamId = req.query.teamId;
    }

    const statistics = await TaskService.getTaskStatistics(filters);
    return res.status(200).json({ statistics });
  } catch (error) {
    console.error('Staff Management: Error getting task statistics:', error);
    return res.status(500).json({ error: error.message || 'Failed to get task statistics' });
  }
});

module.exports = router;