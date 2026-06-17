import api from './api';

export interface RepairWorkflow {
  _id: string;
  orderId: {
    _id: string;
    orderNumber: string;
  };
  customerId: {
    _id: string;
    name: string;
    email: string;
  };
  technicianId: {
    _id: string;
    name: string;
    email: string;
  };
  inspectionId?: string;
  status: 'pending-confirmation' | 'in-progress' | 'paused' | 'completed' | 'incident';
  approvalData?: {
    internalNotes?: string;
    orderChanges?: string;
    notifyCustomer?: boolean;
    approvedAt?: string;
    approvedByTechnicianId?: string;
  };
  timerData?: {
    startedAt?: string;
    pausedAt?: string;
    totalPausedMs?: number;
    pauseHistory?: Array<{ startedAt: string; endedAt: string; durationMs: number }>;
  };
  incidents?: Array<{
    _id?: string;
    type: string;
    timestamp: string;
    details?: string;
    emailSent?: boolean;
    technicianId?: string;
  }>;
  lastStatusChangeAt?: string;
  metadata?: {
    elapsedTimeMs?: number;
  };
  createdAt?: string;
  updatedAt?: string;
}

export const initializeRepairWorkflow = async (orderId: string, customerId?: string, inspectionId?: string) => {
  return api.post(`/repair-workflows/${orderId}/init`, {
    customerId,
    inspectionId,
  });
};

export const getRepairWorkflow = async (orderId: string) => {
  return api.get(`/repair-workflows/${orderId}`);
};

export const approveRepairStart = async (
  orderId: string,
  internalNotes: string,
  orderChanges: string,
  notifyCustomer: boolean
) => {
  return api.post(`/repair-workflows/${orderId}/approve`, {
    internalNotes,
    orderChanges,
    notifyCustomer,
  });
};

export const pauseRepair = async (orderId: string, pauseReason?: string) => {
  return api.post(`/repair-workflows/${orderId}/pause`, {
    pauseReason,
  });
};

export const resumeRepair = async (orderId: string) => {
  return api.post(`/repair-workflows/${orderId}/resume`);
};

export const completeRepair = async (orderId: string) => {
  return api.post(`/repair-workflows/${orderId}/complete`);
};

export const reportIncident = async (
  orderId: string,
  incidentType: string,
  reason: string,
  additionalData?: any
) => {
  return api.post(`/repair-workflows/${orderId}/incidents`, {
    incidentType,
    reason,
    additionalData,
  });
};

export const getInactiveWorkflows = async (thresholdHours: number = 3) => {
  return api.get('/repair-workflows/admin/inactive', {
    params: {
      thresholdHours,
    },
  });
};
