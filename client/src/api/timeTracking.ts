import api from './api';

/**
 * Time Tracking API Client
 * Handles automatic time tracking for staff members
 */

export interface TimeEntry {
  _id: string;
  staffId: string;
  staffName: string;
  type: 'clock_in' | 'clock_out' | 'break_start' | 'break_end' | 'order_start' | 'order_end';
  timestamp: Date;
  orderId?: string;
  orderNumber?: string;
  sessionId?: string;
  duration?: number;
  notes?: string;
}

export interface WorkSession {
  _id: string;
  staffId: string;
  staffName: string;
  sessionId: string;
  clockInTime: Date;
  clockOutTime?: Date;
  breaks: Array<{
    startTime: Date;
    endTime?: Date;
    duration?: number;
    reason?: string;
  }>;
  ordersWorked: Array<{
    orderId: string;
    orderNumber: string;
    startTime: Date;
    endTime?: Date;
    duration?: number;
  }>;
  totalDuration: number;
  workDuration: number;
  breakDuration: number;
  status: 'active' | 'on_break' | 'completed';
}

export interface CurrentStatus {
  success: boolean;
  status: 'offline' | 'online' | 'working' | 'pending' | 'on_break';
  sessionId?: string;
  lastClockIn?: Date;
  lastClockOut?: Date;
  currentOrder?: {
    orderId: string;
    orderNumber: string;
  };
  lastActivity?: Date;
  activeSession?: WorkSession;
}

export interface TimeTrackingSummary {
  success: boolean;
  summary: {
    currentStatus: string;
    lastClockIn?: Date;
    lastClockOut?: Date;
    hoursToday: number;
    hoursThisWeek: number;
    hoursThisMonth: number;
    totalHoursWorked: number;
    totalBreakHours: number;
    breakHoursToday: number;
    averageHoursPerDay: number;
    selectedDate?: Date;
    breaksToday: Array<{
      startTime: Date;
      endTime?: Date | null;
      durationHours: number;
      reason?: string;
    }>;
    ordersToday: Array<{
      orderId?: string | null;
      orderNumber: string;
      startTime: Date;
      endTime?: Date | null;
      durationHours: number;
    }>;
  };
}

export interface StaffStatus {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
  currentStatus: 'offline' | 'online' | 'working' | 'pending' | 'on_break';
  lastActivity?: Date;
  currentOrder?: string;
  hoursThisWeek: number;
  hoursThisMonth: number;
}

// Description: Clock in for work
// Endpoint: POST /api/time-tracking/clock-in
// Request: {}
// Response: { success: boolean, message: string, session: { sessionId: string, clockInTime: Date, status: string } }
export const clockIn = async () => {
  try {
    const response = await api.post('/api/time-tracking/clock-in');
    return response.data;
  } catch (error) {
    console.error('Clock in error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Clock out from work
// Endpoint: POST /api/time-tracking/clock-out
// Request: {}
// Response: { success: boolean, message: string, session: object }
export const clockOut = async () => {
  try {
    const response = await api.post('/api/time-tracking/clock-out');
    return response.data;
  } catch (error) {
    console.error('Clock out error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Start a break period
// Endpoint: POST /api/time-tracking/break-start
// Request: { reason?: string }
// Response: { success: boolean, message: string, breakStartTime: Date }
export const startBreak = async (reason?: string) => {
  try {
    const response = await api.post('/api/time-tracking/break-start', { reason });
    return response.data;
  } catch (error) {
    console.error('Start break error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: End a break period
// Endpoint: POST /api/time-tracking/break-end
// Request: {}
// Response: { success: boolean, message: string, breakEndTime: Date }
export const endBreak = async () => {
  try {
    const response = await api.post('/api/time-tracking/break-end');
    return response.data;
  } catch (error) {
    console.error('End break error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Start tracking work on an order (automatic)
// Endpoint: POST /api/time-tracking/order-start
// Request: { orderId: string }
// Response: { success: boolean, message: string, orderId: string, orderNumber: string, startTime: Date }
export const startOrderTracking = async (orderId: string) => {
  try {
    const response = await api.post('/api/time-tracking/order-start', { orderId });
    return response.data;
  } catch (error) {
    console.error('Start order tracking error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: End tracking work on an order (automatic)
// Endpoint: POST /api/time-tracking/order-end
// Request: { orderId: string }
// Response: { success: boolean, message: string, endTime: Date }
export const endOrderTracking = async (orderId: string) => {
  try {
    const response = await api.post('/api/time-tracking/order-end', { orderId });
    return response.data;
  } catch (error) {
    console.error('End order tracking error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get current time tracking status
// Endpoint: GET /api/time-tracking/status
// Request: {}
// Response: CurrentStatus
export const getCurrentStatus = async (): Promise<CurrentStatus> => {
  try {
    const response = await api.get('/api/time-tracking/status');
    return response.data;
  } catch (error) {
    console.error('Get current status error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get time entries with filters
// Endpoint: GET /api/time-tracking/entries
// Request: { startDate?: string, endDate?: string, type?: string, orderId?: string, page?: number, limit?: number }
// Response: { success: boolean, entries: TimeEntry[], pagination: object }
export const getTimeEntries = async (filters?: {
  startDate?: string;
  endDate?: string;
  type?: string;
  orderId?: string;
  page?: number;
  limit?: number;
}) => {
  try {
    const response = await api.get('/api/time-tracking/entries', { params: filters });
    return response.data;
  } catch (error) {
    console.error('Get time entries error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get work sessions with filters
// Endpoint: GET /api/time-tracking/sessions
// Request: { startDate?: string, endDate?: string, status?: string, page?: number, limit?: number }
// Response: { success: boolean, sessions: WorkSession[], pagination: object }
export const getWorkSessions = async (filters?: {
  startDate?: string;
  endDate?: string;
  status?: string;
  page?: number;
  limit?: number;
}) => {
  try {
    const response = await api.get('/api/time-tracking/sessions', { params: filters });
    return response.data;
  } catch (error) {
    console.error('Get work sessions error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get time tracking summary
// Endpoint: GET /api/time-tracking/summary
// Request: { date?: string }
// Response: TimeTrackingSummary
export const getTimeTrackingSummary = async (filters?: { date?: string }): Promise<TimeTrackingSummary> => {
  try {
    const response = await api.get('/api/time-tracking/summary', { params: filters });
    return response.data;
  } catch (error) {
    console.error('Get time tracking summary error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get all staff members with their current status (admin only)
// Endpoint: GET /api/time-tracking/admin/all-staff-status
// Request: {}
// Response: { success: boolean, staff: StaffStatus[] }
export const getAllStaffStatus = async () => {
  try {
    const response = await api.get('/api/time-tracking/admin/all-staff-status');
    return response.data;
  } catch (error) {
    console.error('Get all staff status error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get time tracking summary for any staff member (admin only)
// Endpoint: GET /api/time-tracking/admin/staff/:staffId/summary
// Request: { date?: string }
// Response: TimeTrackingSummary
export const getStaffTimeTrackingSummary = async (staffId: string, filters?: { date?: string }): Promise<TimeTrackingSummary> => {
  try {
    const response = await api.get(`/api/time-tracking/admin/staff/${staffId}/summary`, { params: filters });
    return response.data;
  } catch (error) {
    console.error('Get staff time tracking summary error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get time entries for any staff member (admin only)
// Endpoint: GET /api/time-tracking/admin/staff/:staffId/entries
// Request: { startDate?: string, endDate?: string, type?: string, orderId?: string, page?: number, limit?: number }
// Response: { success: boolean, entries: TimeEntry[], pagination: object }
export const getStaffTimeEntries = async (staffId: string, filters?: {
  startDate?: string;
  endDate?: string;
  type?: string;
  orderId?: string;
  page?: number;
  limit?: number;
}) => {
  try {
    const response = await api.get(`/api/time-tracking/admin/staff/${staffId}/entries`, { params: filters });
    return response.data;
  } catch (error) {
    console.error('Get staff time entries error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get work sessions for any staff member (admin only)
// Endpoint: GET /api/time-tracking/admin/staff/:staffId/sessions
// Request: { startDate?: string, endDate?: string, status?: string, page?: number, limit?: number }
// Response: { success: boolean, sessions: WorkSession[], pagination: object }
export const getStaffWorkSessions = async (staffId: string, filters?: {
  startDate?: string;
  endDate?: string;
  status?: string;
  page?: number;
  limit?: number;
}) => {
  try {
    const response = await api.get(`/api/time-tracking/admin/staff/${staffId}/sessions`, { params: filters });
    return response.data;
  } catch (error) {
    console.error('Get staff work sessions error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};
