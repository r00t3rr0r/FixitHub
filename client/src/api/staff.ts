import api from './api';

export interface StaffMember {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: 'technician' | 'supervisor' | 'manager' | 'staff' | 'admin';
  specializations: string[];
  addOnCapabilities: string[];
  avatar: string;
  status: 'active' | 'inactive' | 'on_leave';
  hireDate: string;
  schedule: {
    monday: { start: string; end: string; available: boolean };
    tuesday: { start: string; end: string; available: boolean };
    wednesday: { start: string; end: string; available: boolean };
    thursday: { start: string; end: string; available: boolean };
    friday: { start: string; end: string; available: boolean };
    saturday: { start: string; end: string; available: boolean };
    sunday: { start: string; end: string; available: boolean };
  };
  performance: {
    ordersCompleted: number;
    averageCompletionTime: number;
    customerSatisfaction: number;
    efficiency: number;
    qualityScore: number;
  };
  currentWorkload: {
    assignedOrders: number;
    assignedTasks?: number;
    capacity: number;
    utilizationRate: number;
  };
}

export interface Team {
  _id: string;
  name: string;
  description: string;
  leaderId: string;
  leaderName: string;
  members: StaffMember[];
  specializations: string[];
  permissions: string[];
  department?: string;
  createdAt: string;
  isActive: boolean;
  performance: {
    totalOrders: number;
    averageCompletionTime: number;
    customerSatisfaction: number;
    efficiency: number;
  };
}

export interface WorkloadDistribution {
  staffId: string;
  staffName: string;
  assignedOrders: number;
  assignedTasks?: number;
  capacity: number;
  utilizationRate: number;
  currentTasks: {
    id: string;
    type: 'order' | 'task';
    title: string;
    subtitle?: string;
    priority: 'low' | 'normal' | 'high' | 'urgent';
    dueDate: string;
    progress: number;
    status?: string;
  }[];
}

export interface PerformanceMetrics {
  individual: {
    staffId: string;
    staffName: string;
    ordersCompleted: number;
    averageCompletionTime: number;
    customerSatisfaction: number;
    efficiency: number;
    qualityScore: number;
    goals: {
      target: number;
      achieved: number;
      percentage: number;
    };
  }[];
  team: {
    teamId: string;
    teamName: string;
    totalOrders: number;
    averageCompletionTime: number;
    customerSatisfaction: number;
    efficiency: number;
    memberCount: number;
  }[];
}

export interface Task {
  _id: string;
  title: string;
  description: string;
  assignedTo: {
    _id: string;
    name: string;
    email: string;
    avatar: string;
  };
  assignedBy: {
    _id: string;
    name: string;
    email: string;
  };
  teamId?: {
    _id: string;
    name: string;
  };
  orderId?: {
    _id: string;
    orderNumber: string;
  };
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  category: 'repair' | 'maintenance' | 'training' | 'meeting' | 'other';
  dueDate: string;
  startDate?: string;
  completedDate?: string;
  estimatedHours: number;
  actualHours: number;
  attachments: Array<{
    name: string;
    url: string;
    type: string;
    size: number;
  }>;
  comments: Array<{
    userId: string;
    userName: string;
    comment: string;
    createdAt: string;
  }>;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// Description: Get all staff members
// Endpoint: GET /api/admin/staff-management/staff
// Request: { role?: string, status?: string, specialization?: string, search?: string }
// Response: { staff: StaffMember[] }
export const getStaffMembers = async (filters: any = {}) => {
  try {
    const response = await api.get('/api/admin/staff-management/staff', { params: filters });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get all teams
// Endpoint: GET /api/admin/staff-management/teams
// Request: { active?: boolean }
// Response: { teams: Team[] }
export const getTeams = async (filters: any = {}) => {
  try {
    const response = await api.get('/api/admin/staff-management/teams', { params: filters });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get workload distribution
// Endpoint: GET /api/admin/staff-management/workload
// Request: {}
// Response: { workload: WorkloadDistribution[] }
export const getWorkloadDistribution = async () => {
  try {
    const response = await api.get('/api/admin/staff-management/workload');
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get performance metrics
// Endpoint: GET /api/performance/team
// Request: { period?: string, teamId?: string }
// Response: { teamPerformance: any[] }
export const getPerformanceMetrics = async (filters: any = {}) => {
  try {
    const response = await api.get('/api/performance/team', { params: filters });
    
    // Transform the response to match the expected format
    const teamPerformance = response.data.teamPerformance || [];
    
    const metrics = {
      individual: teamPerformance.map((member: any) => ({
        staffId: member.staffId,
        staffName: member.staffName,
        ordersCompleted: member.performance?.metrics?.ordersCompleted || 0,
        averageCompletionTime: member.performance?.metrics?.averageCompletionTime || 0,
        customerSatisfaction: member.performance?.metrics?.customerSatisfaction || 0,
        efficiency: member.performance?.metrics?.efficiency || 0,
        qualityScore: member.performance?.metrics?.qualityScore || 0,
        goals: {
          target: member.performance?.goals?.ordersTarget || 100,
          achieved: member.performance?.metrics?.ordersCompleted || 0,
          percentage: member.performance?.goals?.ordersTarget > 0 
            ? Math.round((member.performance?.metrics?.ordersCompleted / member.performance?.goals?.ordersTarget) * 100)
            : 0
        }
      })),
      team: [] // Team metrics would come from a different endpoint
    };
    
    return { metrics };
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Create new staff member
// Endpoint: POST /api/admin/staff-management/staff
// Request: Partial<StaffMember>
// Response: { success: boolean, staff: StaffMember }
export const createStaffMember = async (staffData: Partial<StaffMember>) => {
  try {
    const response = await api.post('/api/admin/staff-management/staff', staffData);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Create new team
// Endpoint: POST /api/admin/staff-management/teams
// Request: Partial<Team>
// Response: { success: boolean, team: Team }
export const createTeam = async (teamData: Partial<Team>) => {
  try {
    const response = await api.post('/api/admin/staff-management/teams', teamData);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update staff member
// Endpoint: PUT /api/admin/staff-management/staff/:id
// Request: Partial<StaffMember>
// Response: { success: boolean, staff: StaffMember }
export const updateStaffMember = async (staffId: string, updates: Partial<StaffMember>) => {
  try {
    const response = await api.put(`/api/admin/staff-management/staff/${staffId}`, updates);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Delete staff member
// Endpoint: DELETE /api/admin/staff-management/staff/:id
// Request: {}
// Response: { success: boolean, message: string }
export const deleteStaffMember = async (staffId: string) => {
  try {
    const response = await api.delete(`/api/admin/staff-management/staff/${staffId}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update team
// Endpoint: PUT /api/admin/staff-management/teams/:id
// Request: Partial<Team>
// Response: { success: boolean, team: Team }
export const updateTeam = async (teamId: string, updates: Partial<Team>) => {
  try {
    const response = await api.put(`/api/admin/staff-management/teams/${teamId}`, updates);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Delete team
// Endpoint: DELETE /api/admin/staff-management/teams/:id
// Request: {}
// Response: { success: boolean, message: string }
export const deleteTeam = async (teamId: string) => {
  try {
    const response = await api.delete(`/api/admin/staff-management/teams/${teamId}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Add member to team
// Endpoint: POST /api/admin/staff-management/teams/:id/members
// Request: { userId: string, role?: string }
// Response: { success: boolean, team: Team }
export const addMemberToTeam = async (teamId: string, userId: string, role: string = 'member') => {
  try {
    const response = await api.post(`/api/admin/staff-management/teams/${teamId}/members`, { userId, role });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Remove member from team
// Endpoint: DELETE /api/admin/staff-management/teams/:id/members/:userId
// Request: {}
// Response: { success: boolean, team: Team }
export const removeMemberFromTeam = async (teamId: string, userId: string) => {
  try {
    const response = await api.delete(`/api/admin/staff-management/teams/${teamId}/members/${userId}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get tasks
// Endpoint: GET /api/admin/staff-management/tasks
// Request: { assignedTo?: string, teamId?: string, status?: string, priority?: string, category?: string, search?: string, dueDateFrom?: string, dueDateTo?: string }
// Response: { tasks: Task[] }
export const getTasks = async (filters: any = {}) => {
  try {
    const response = await api.get('/api/admin/staff-management/tasks', { params: filters });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Create new task
// Endpoint: POST /api/admin/staff-management/tasks
// Request: Partial<Task>
// Response: { success: boolean, task: Task }
export const createTask = async (taskData: Partial<Task>) => {
  try {
    const response = await api.post('/api/admin/staff-management/tasks', taskData);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update task
// Endpoint: PUT /api/admin/staff-management/tasks/:id
// Request: Partial<Task>
// Response: { success: boolean, task: Task }
export const updateTask = async (taskId: string, updates: Partial<Task>) => {
  try {
    const response = await api.put(`/api/admin/staff-management/tasks/${taskId}`, updates);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Delete task
// Endpoint: DELETE /api/admin/staff-management/tasks/:id
// Request: {}
// Response: { success: boolean, message: string }
export const deleteTask = async (taskId: string) => {
  try {
    const response = await api.delete(`/api/admin/staff-management/tasks/${taskId}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Add comment to task
// Endpoint: POST /api/admin/staff-management/tasks/:id/comments
// Request: { comment: string }
// Response: { success: boolean, task: Task }
export const addTaskComment = async (taskId: string, comment: string) => {
  try {
    const response = await api.post(`/api/admin/staff-management/tasks/${taskId}/comments`, { comment });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get task statistics
// Endpoint: GET /api/admin/staff-management/tasks/statistics
// Request: { assignedTo?: string, teamId?: string }
// Response: { statistics: any }
export const getTaskStatistics = async (filters: any = {}) => {
  try {
    const response = await api.get('/api/admin/staff-management/tasks/statistics', { params: filters });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get detailed staff member information
// Endpoint: GET /api/admin/staff-management/staff/:id/details
// Request: {}
// Response: { staffDetails: StaffMemberDetails }
export const getStaffMemberDetails = async (staffId: string) => {
  try {
    const response = await api.get(`/api/admin/staff-management/staff/${staffId}/details`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

export interface StaffMemberDetails extends StaffMember {
  teams: Array<{
    _id: string;
    name: string;
    role: string;
    joinedAt: string;
  }>;
  assignedOrders: Array<{
    _id: string;
    orderNumber: string;
    deviceBrand: string;
    deviceModel: string;
    status: string;
    priority: string;
    createdAt: string;
    estimatedCompletion: string;
    progress: number;
  }>;
  assignedTasks: Array<{
    _id: string;
    title: string;
    description: string;
    priority: string;
    status: string;
    dueDate: string;
    estimatedHours: number;
    actualHours: number;
  }>;
  timeTracking: {
    totalHoursThisWeek: number;
    totalHoursThisMonth: number;
    averageHoursPerDay: number;
    lastClockIn: string;
    lastClockOut: string;
    currentStatus: 'clocked_in' | 'clocked_out' | 'on_break';
  };
  activityLog: Array<{
    _id: string;
    action: string;
    description: string;
    timestamp: string;
    details?: any;
  }>;
  performanceHistory: Array<{
    period: string;
    ordersCompleted: number;
    averageCompletionTime: number;
    customerSatisfaction: number;
    efficiency: number;
    qualityScore: number;
  }>;
}