import api from './api';

export interface DatabaseStats {
  database: {
    name: string;
    collections: number;
    objects: number;
    dataSize: number;
    storageSize: number;
    indexes: number;
    indexSize: number;
  };
  collections: Array<{
    name: string;
    count: number;
    size: number;
    avgObjSize: number;
    storageSize: number;
    indexes: number;
  }>;
  connectionStatus: string;
}

export interface DatabaseOperation {
  _id: string;
  operation: string;
  collection: string;
  timestamp: string;
  duration: number;
  status: string;
}

export interface DatabaseBackup {
  _id: string;
  timestamp: string;
  size: string;
  status: string;
  type: string;
}

export interface DatabaseHealth {
  status: string;
  uptime: number;
  connections: {
    current: number;
    available: number;
  };
  memory: {
    resident: number;
    virtual: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
  };
  lastCheck: string;
  error?: string;
}

// Description: Get database statistics
// Endpoint: GET /api/database/stats
// Request: {}
// Response: { success: boolean, stats: DatabaseStats }
export const getDatabaseStats = async () => {
  try {
    return await api.get('/api/database/stats');
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get recent database operations
// Endpoint: GET /api/database/operations
// Request: {}
// Response: { success: boolean, operations: DatabaseOperation[] }
export const getRecentOperations = async () => {
  try {
    return await api.get('/api/database/operations');
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Create database backup
// Endpoint: POST /api/database/backup
// Request: {}
// Response: { success: boolean, backupId: string, message: string, timestamp: string, size: string }
export const createDatabaseBackup = async () => {
  try {
    return await api.post('/api/database/backup');
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get backup history
// Endpoint: GET /api/database/backups
// Request: {}
// Response: { success: boolean, backups: DatabaseBackup[] }
export const getBackupHistory = async () => {
  try {
    return await api.get('/api/database/backups');
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Optimize database
// Endpoint: POST /api/database/optimize
// Request: {}
// Response: { success: boolean, message: string, results: Array<{ collection: string, status: string }>, timestamp: string }
export const optimizeDatabase = async () => {
  try {
    return await api.post('/api/database/optimize');
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get database health
// Endpoint: GET /api/database/health
// Request: {}
// Response: { success: boolean, health: DatabaseHealth }
export const getDatabaseHealth = async () => {
  try {
    return await api.get('/api/database/health');
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Clean up old data
// Endpoint: POST /api/database/cleanup
// Request: { olderThanDays?: number, collections?: string[] }
// Response: { success: boolean, message: string, results: Array<{ collection: string, deletedCount: number }>, timestamp: string }
export const cleanupOldData = async (options = {}) => {
  try {
    return await api.post('/api/database/cleanup', options);
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Delete all bookings and orders from the database
// Endpoint: POST /api/database/delete-bookings-orders
// Request: {}
// Response: { success: boolean, message: string, results: { orders: { before: number, deleted: number, after: number }, bookings: { before: number, deleted: number, after: number } }, timestamp: string }
export const deleteAllBookingsAndOrders = async () => {
  try {
    return await api.post('/api/database/delete-bookings-orders');
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Delete all invoices from the database
// Endpoint: POST /api/database/delete-invoices
// Request: {}
// Response: { success: boolean, message: string, results: { before: number, deleted: number, after: number }, timestamp: string }
export const deleteAllInvoices = async () => {
  try {
    return await api.post('/api/database/delete-invoices');
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Delete all complaints from the database
// Endpoint: POST /api/database/delete-complaints
// Request: {}
// Response: { success: boolean, message: string, results: { before: number, deleted: number, after: number }, timestamp: string }
export const deleteAllComplaints = async () => {
  try {
    return await api.post('/api/database/delete-complaints');
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Delete all repair requests from the database
// Endpoint: POST /api/database/delete-repair-requests
// Request: {}
// Response: { success: boolean, message: string, results: { before: number, deleted: number, after: number }, timestamp: string }
export const deleteAllRepairRequests = async () => {
  try {
    return await api.post('/api/database/delete-repair-requests');
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Delete all notifications
// Endpoint: POST /api/database/delete-notifications
export const deleteAllNotifications = async () => {
  try {
    return await api.post('/api/database/delete-notifications');
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Delete all messages
// Endpoint: POST /api/database/delete-messages
export const deleteAllMessages = async () => {
  try {
    return await api.post('/api/database/delete-messages');
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Delete all needslists
// Endpoint: POST /api/database/delete-needslists
export const deleteAllNeedslists = async () => {
  try {
    return await api.post('/api/database/delete-needslists');
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Delete all payments
// Endpoint: POST /api/database/delete-payments
export const deleteAllPayments = async () => {
  try {
    return await api.post('/api/database/delete-payments');
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Delete all contact messages
// Endpoint: POST /api/database/delete-contact-messages
export const deleteAllContactMessages = async () => {
  try {
    return await api.post('/api/database/delete-contact-messages');
  } catch (error) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};