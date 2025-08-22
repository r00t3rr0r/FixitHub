import api from './api';

export interface StaffMember {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: 'technician' | 'supervisor' | 'manager';
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
  capacity: number;
  utilizationRate: number;
  currentTasks: {
    orderId: string;
    orderNumber: string;
    priority: 'low' | 'normal' | 'high' | 'urgent';
    estimatedCompletion: string;
    progress: number;
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

// Description: Get all staff members
// Endpoint: GET /api/admin/staff
// Request: { role?: string, status?: string, specialization?: string }
// Response: { staff: StaffMember[] }
export const getStaffMembers = (filters: any = {}) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        staff: [
          {
            _id: 'staff1',
            name: 'Sarah Johnson',
            email: 'sarah.johnson@fixithub.com',
            phone: '+1 (555) 234-5678',
            role: 'technician',
            specializations: ['iPhone Repair', 'Screen Replacement', 'Battery Replacement'],
            addOnCapabilities: ['Screen Protector Installation', 'Data Backup', 'Device Cleaning'],
            avatar: 'https://via.placeholder.com/100x100/10b981/ffffff?text=SJ',
            status: 'active',
            hireDate: '2023-03-15T00:00:00Z',
            schedule: {
              monday: { start: '09:00', end: '17:00', available: true },
              tuesday: { start: '09:00', end: '17:00', available: true },
              wednesday: { start: '09:00', end: '17:00', available: true },
              thursday: { start: '09:00', end: '17:00', available: true },
              friday: { start: '09:00', end: '17:00', available: true },
              saturday: { start: '10:00', end: '14:00', available: true },
              sunday: { start: '', end: '', available: false }
            },
            performance: {
              ordersCompleted: 156,
              averageCompletionTime: 2.3,
              customerSatisfaction: 4.8,
              efficiency: 94,
              qualityScore: 96
            },
            currentWorkload: {
              assignedOrders: 8,
              capacity: 10,
              utilizationRate: 80
            }
          },
          {
            _id: 'staff2',
            name: 'Mike Chen',
            email: 'mike.chen@fixithub.com',
            phone: '+1 (555) 345-6789',
            role: 'supervisor',
            specializations: ['Samsung Repair', 'Water Damage', 'Advanced Diagnostics'],
            addOnCapabilities: ['Express Service', 'Extended Warranty', 'Quality Control'],
            avatar: 'https://via.placeholder.com/100x100/3b82f6/ffffff?text=MC',
            status: 'active',
            hireDate: '2022-08-20T00:00:00Z',
            schedule: {
              monday: { start: '08:00', end: '16:00', available: true },
              tuesday: { start: '08:00', end: '16:00', available: true },
              wednesday: { start: '08:00', end: '16:00', available: true },
              thursday: { start: '08:00', end: '16:00', available: true },
              friday: { start: '08:00', end: '16:00', available: true },
              saturday: { start: '', end: '', available: false },
              sunday: { start: '', end: '', available: false }
            },
            performance: {
              ordersCompleted: 203,
              averageCompletionTime: 1.8,
              customerSatisfaction: 4.9,
              efficiency: 97,
              qualityScore: 98
            },
            currentWorkload: {
              assignedOrders: 6,
              capacity: 8,
              utilizationRate: 75
            }
          },
          {
            _id: 'staff3',
            name: 'Emily Rodriguez',
            email: 'emily.rodriguez@fixithub.com',
            phone: '+1 (555) 456-7890',
            role: 'technician',
            specializations: ['Google Pixel Repair', 'Camera Repair', 'Software Issues'],
            addOnCapabilities: ['Screen Protector Installation', 'Phone Case Installation'],
            avatar: 'https://via.placeholder.com/100x100/8b5cf6/ffffff?text=ER',
            status: 'active',
            hireDate: '2023-06-10T00:00:00Z',
            schedule: {
              monday: { start: '10:00', end: '18:00', available: true },
              tuesday: { start: '10:00', end: '18:00', available: true },
              wednesday: { start: '10:00', end: '18:00', available: true },
              thursday: { start: '10:00', end: '18:00', available: true },
              friday: { start: '10:00', end: '18:00', available: true },
              saturday: { start: '09:00', end: '15:00', available: true },
              sunday: { start: '', end: '', available: false }
            },
            performance: {
              ordersCompleted: 89,
              averageCompletionTime: 2.7,
              customerSatisfaction: 4.6,
              efficiency: 88,
              qualityScore: 92
            },
            currentWorkload: {
              assignedOrders: 12,
              capacity: 12,
              utilizationRate: 100
            }
          }
        ]
      });
    }, 500);
  });
};

// Description: Get all teams
// Endpoint: GET /api/admin/teams
// Request: {}
// Response: { teams: Team[] }
export const getTeams = () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        teams: [
          {
            _id: 'team1',
            name: 'iPhone Specialists',
            description: 'Dedicated team for iPhone repairs and services',
            leaderId: 'staff2',
            leaderName: 'Mike Chen',
            members: [
              {
                _id: 'staff1',
                name: 'Sarah Johnson',
                email: 'sarah.johnson@fixithub.com',
                phone: '+1 (555) 234-5678',
                role: 'technician',
                specializations: ['iPhone Repair', 'Screen Replacement'],
                addOnCapabilities: ['Screen Protector Installation'],
                avatar: 'https://via.placeholder.com/100x100/10b981/ffffff?text=SJ',
                status: 'active',
                hireDate: '2023-03-15T00:00:00Z',
                schedule: {
                  monday: { start: '09:00', end: '17:00', available: true },
                  tuesday: { start: '09:00', end: '17:00', available: true },
                  wednesday: { start: '09:00', end: '17:00', available: true },
                  thursday: { start: '09:00', end: '17:00', available: true },
                  friday: { start: '09:00', end: '17:00', available: true },
                  saturday: { start: '10:00', end: '14:00', available: true },
                  sunday: { start: '', end: '', available: false }
                },
                performance: {
                  ordersCompleted: 156,
                  averageCompletionTime: 2.3,
                  customerSatisfaction: 4.8,
                  efficiency: 94,
                  qualityScore: 96
                },
                currentWorkload: {
                  assignedOrders: 8,
                  capacity: 10,
                  utilizationRate: 80
                }
              }
            ],
            specializations: ['iPhone Repair', 'Screen Replacement', 'Battery Replacement'],
            permissions: ['order_management', 'customer_communication', 'quality_control'],
            createdAt: '2023-01-15T00:00:00Z',
            isActive: true,
            performance: {
              totalOrders: 245,
              averageCompletionTime: 2.1,
              customerSatisfaction: 4.8,
              efficiency: 95
            }
          },
          {
            _id: 'team2',
            name: 'Android Experts',
            description: 'Specialized team for Samsung and Android device repairs',
            leaderId: 'staff2',
            leaderName: 'Mike Chen',
            members: [],
            specializations: ['Samsung Repair', 'Android Diagnostics', 'Water Damage'],
            permissions: ['order_management', 'advanced_diagnostics'],
            createdAt: '2023-02-01T00:00:00Z',
            isActive: true,
            performance: {
              totalOrders: 189,
              averageCompletionTime: 1.9,
              customerSatisfaction: 4.9,
              efficiency: 97
            }
          }
        ]
      });
    }, 500);
  });
};

// Description: Get workload distribution
// Endpoint: GET /api/admin/staff/workload
// Request: {}
// Response: { workload: WorkloadDistribution[] }
export const getWorkloadDistribution = () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        workload: [
          {
            staffId: 'staff1',
            staffName: 'Sarah Johnson',
            assignedOrders: 8,
            capacity: 10,
            utilizationRate: 80,
            currentTasks: [
              {
                orderId: 'order1',
                orderNumber: 'ORD-2024-001',
                priority: 'high',
                estimatedCompletion: '2024-01-17T17:00:00Z',
                progress: 65
              },
              {
                orderId: 'order2',
                orderNumber: 'ORD-2024-002',
                priority: 'normal',
                estimatedCompletion: '2024-01-18T15:00:00Z',
                progress: 30
              }
            ]
          },
          {
            staffId: 'staff2',
            staffName: 'Mike Chen',
            assignedOrders: 6,
            capacity: 8,
            utilizationRate: 75,
            currentTasks: [
              {
                orderId: 'order3',
                orderNumber: 'ORD-2024-003',
                priority: 'urgent',
                estimatedCompletion: '2024-01-16T14:00:00Z',
                progress: 90
              }
            ]
          },
          {
            staffId: 'staff3',
            staffName: 'Emily Rodriguez',
            assignedOrders: 12,
            capacity: 12,
            utilizationRate: 100,
            currentTasks: [
              {
                orderId: 'order4',
                orderNumber: 'ORD-2024-004',
                priority: 'normal',
                estimatedCompletion: '2024-01-19T16:00:00Z',
                progress: 45
              },
              {
                orderId: 'order5',
                orderNumber: 'ORD-2024-005',
                priority: 'high',
                estimatedCompletion: '2024-01-18T12:00:00Z',
                progress: 75
              }
            ]
          }
        ]
      });
    }, 500);
  });
};

// Description: Get performance metrics
// Endpoint: GET /api/admin/staff/performance
// Request: { period?: string, teamId?: string }
// Response: { metrics: PerformanceMetrics }
export const getPerformanceMetrics = (filters: any = {}) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        metrics: {
          individual: [
            {
              staffId: 'staff1',
              staffName: 'Sarah Johnson',
              ordersCompleted: 156,
              averageCompletionTime: 2.3,
              customerSatisfaction: 4.8,
              efficiency: 94,
              qualityScore: 96,
              goals: {
                target: 160,
                achieved: 156,
                percentage: 97.5
              }
            },
            {
              staffId: 'staff2',
              staffName: 'Mike Chen',
              ordersCompleted: 203,
              averageCompletionTime: 1.8,
              customerSatisfaction: 4.9,
              efficiency: 97,
              qualityScore: 98,
              goals: {
                target: 200,
                achieved: 203,
                percentage: 101.5
              }
            },
            {
              staffId: 'staff3',
              staffName: 'Emily Rodriguez',
              ordersCompleted: 89,
              averageCompletionTime: 2.7,
              customerSatisfaction: 4.6,
              efficiency: 88,
              qualityScore: 92,
              goals: {
                target: 100,
                achieved: 89,
                percentage: 89
              }
            }
          ],
          team: [
            {
              teamId: 'team1',
              teamName: 'iPhone Specialists',
              totalOrders: 245,
              averageCompletionTime: 2.1,
              customerSatisfaction: 4.8,
              efficiency: 95,
              memberCount: 3
            },
            {
              teamId: 'team2',
              teamName: 'Android Experts',
              totalOrders: 189,
              averageCompletionTime: 1.9,
              customerSatisfaction: 4.9,
              efficiency: 97,
              memberCount: 2
            }
          ]
        }
      });
    }, 500);
  });
};

// Description: Create new staff member
// Endpoint: POST /api/admin/staff
// Request: Partial<StaffMember>
// Response: { success: boolean, staff: StaffMember }
export const createStaffMember = (staffData: Partial<StaffMember>) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        staff: {
          _id: 'staff_' + Date.now(),
          ...staffData,
          hireDate: new Date().toISOString(),
          performance: {
            ordersCompleted: 0,
            averageCompletionTime: 0,
            customerSatisfaction: 0,
            efficiency: 0,
            qualityScore: 0
          },
          currentWorkload: {
            assignedOrders: 0,
            capacity: 10,
            utilizationRate: 0
          }
        }
      });
    }, 1000);
  });
};

// Description: Create new team
// Endpoint: POST /api/admin/teams
// Request: Partial<Team>
// Response: { success: boolean, team: Team }
export const createTeam = (teamData: Partial<Team>) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        team: {
          _id: 'team_' + Date.now(),
          ...teamData,
          members: [],
          createdAt: new Date().toISOString(),
          isActive: true,
          performance: {
            totalOrders: 0,
            averageCompletionTime: 0,
            customerSatisfaction: 0,
            efficiency: 0
          }
        }
      });
    }, 1000);
  });
};

// Description: Update staff member
// Endpoint: PUT /api/admin/staff/:id
// Request: Partial<StaffMember>
// Response: { success: boolean, staff: StaffMember }
export const updateStaffMember = (staffId: string, updates: Partial<StaffMember>) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        staff: {
          _id: staffId,
          ...updates
        }
      });
    }, 800);
  });
};