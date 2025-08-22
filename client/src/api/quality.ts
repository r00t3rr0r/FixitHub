import api from './api';

export interface QualityChecklist {
  _id: string;
  name: string;
  description: string;
  serviceTypes: string[];
  deviceTypes: string[];
  checkItems: QualityCheckItem[];
  requiredPhotos: PhotoRequirement[];
  approvalRequired: boolean;
  isActive: boolean;
}

export interface QualityCheckItem {
  _id: string;
  category: string;
  description: string;
  isRequired: boolean;
  order: number;
  passFailCriteria: string;
  tools?: string[];
}

export interface PhotoRequirement {
  _id: string;
  name: string;
  description: string;
  isRequired: boolean;
  angle?: string;
  lighting?: string;
}

export interface QualityInspection {
  _id: string;
  orderId: string;
  orderNumber: string;
  checklistId: string;
  checklistName: string;
  inspectedBy: string;
  inspectedAt: string;
  results: QualityResult[];
  photos: QualityPhoto[];
  overallStatus: 'pass' | 'fail' | 'conditional_pass';
  notes: string;
  customerApprovalRequired: boolean;
  customerApproved?: boolean;
  customerApprovedAt?: string;
  defectsFound: string[];
  correctiveActions: string[];
}

export interface QualityResult {
  checkItemId: string;
  checkItemDescription: string;
  status: 'pass' | 'fail' | 'na';
  notes?: string;
  measuredValue?: string;
}

export interface QualityPhoto {
  _id: string;
  requirementId: string;
  requirementName: string;
  url: string;
  uploadedAt: string;
  notes?: string;
}

export interface QualityMetrics {
  totalInspections: number;
  passRate: number;
  failRate: number;
  averageInspectionTime: number;
  commonDefects: DefectStat[];
  inspectorPerformance: InspectorStat[];
}

export interface DefectStat {
  defect: string;
  count: number;
  percentage: number;
}

export interface InspectorStat {
  inspectorId: string;
  inspectorName: string;
  inspectionsCount: number;
  passRate: number;
  averageTime: number;
}

// Description: Get quality checklists
// Endpoint: GET /api/admin/quality/checklists
// Request: { serviceType?: string, deviceType?: string }
// Response: { checklists: QualityChecklist[] }
export const getQualityChecklists = (filters: any = {}) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        checklists: [
          {
            _id: 'checklist1',
            name: 'Screen Replacement QC',
            description: 'Quality control checklist for screen replacement services',
            serviceTypes: ['Screen Replacement'],
            deviceTypes: ['iPhone', 'Samsung'],
            checkItems: [
              {
                _id: 'check1',
                category: 'Display Quality',
                description: 'Check for dead pixels, color accuracy, and brightness uniformity',
                isRequired: true,
                order: 1,
                passFailCriteria: 'No dead pixels, colors accurate, uniform brightness',
                tools: ['Display Tester', 'Color Meter']
              },
              {
                _id: 'check2',
                category: 'Touch Functionality',
                description: 'Test touch sensitivity and accuracy across entire screen',
                isRequired: true,
                order: 2,
                passFailCriteria: 'All touch points responsive, no ghost touches',
                tools: ['Touch Test App']
              },
              {
                _id: 'check3',
                category: 'Physical Assembly',
                description: 'Verify proper alignment and secure attachment',
                isRequired: true,
                order: 3,
                passFailCriteria: 'Screen flush with frame, no gaps or misalignment'
              },
              {
                _id: 'check4',
                category: 'Button Functionality',
                description: 'Test all physical buttons and switches',
                isRequired: true,
                order: 4,
                passFailCriteria: 'All buttons click properly and register input'
              }
            ],
            requiredPhotos: [
              {
                _id: 'photo1',
                name: 'Front View',
                description: 'Clear photo of completed screen from front',
                isRequired: true,
                angle: 'Straight on',
                lighting: 'Good lighting, no glare'
              },
              {
                _id: 'photo2',
                name: 'Edge Alignment',
                description: 'Close-up of screen edges showing alignment',
                isRequired: true,
                angle: 'Side angle',
                lighting: 'Clear detail of edges'
              }
            ],
            approvalRequired: true,
            isActive: true
          },
          {
            _id: 'checklist2',
            name: 'Battery Replacement QC',
            description: 'Quality control for battery replacement services',
            serviceTypes: ['Battery Replacement'],
            deviceTypes: ['iPhone', 'Samsung', 'Google Pixel'],
            checkItems: [
              {
                _id: 'check5',
                category: 'Battery Performance',
                description: 'Test charging speed and capacity',
                isRequired: true,
                order: 1,
                passFailCriteria: 'Charges to 100%, normal charging speed',
                tools: ['Battery Tester', 'Charging Cable']
              },
              {
                _id: 'check6',
                category: 'Temperature Check',
                description: 'Monitor battery temperature during charging',
                isRequired: true,
                order: 2,
                passFailCriteria: 'Temperature within normal range (< 40°C)',
                tools: ['Temperature Gun']
              }
            ],
            requiredPhotos: [
              {
                _id: 'photo3',
                name: 'Battery Installation',
                description: 'Photo showing properly installed battery',
                isRequired: true
              }
            ],
            approvalRequired: false,
            isActive: true
          }
        ]
      });
    }, 500);
  });
};

// Description: Get quality inspections
// Endpoint: GET /api/admin/quality/inspections
// Request: { orderId?: string, status?: string, inspectorId?: string }
// Response: { inspections: QualityInspection[] }
export const getQualityInspections = (filters: any = {}) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        inspections: [
          {
            _id: 'inspection1',
            orderId: 'order1',
            orderNumber: 'ORD-2024-001',
            checklistId: 'checklist1',
            checklistName: 'Screen Replacement QC',
            inspectedBy: 'Sarah Johnson',
            inspectedAt: '2024-01-15T14:30:00Z',
            results: [
              {
                checkItemId: 'check1',
                checkItemDescription: 'Check for dead pixels, color accuracy, and brightness uniformity',
                status: 'pass',
                notes: 'Display quality excellent, no issues found'
              },
              {
                checkItemId: 'check2',
                checkItemDescription: 'Test touch sensitivity and accuracy across entire screen',
                status: 'pass',
                notes: 'Touch response perfect across all areas'
              }
            ],
            photos: [
              {
                _id: 'qphoto1',
                requirementId: 'photo1',
                requirementName: 'Front View',
                url: 'https://via.placeholder.com/400x600/3b82f6/ffffff?text=QC+Front+View',
                uploadedAt: '2024-01-15T14:35:00Z',
                notes: 'Clear view showing perfect alignment'
              }
            ],
            overallStatus: 'pass',
            notes: 'Excellent quality repair, ready for customer pickup',
            customerApprovalRequired: true,
            customerApproved: true,
            customerApprovedAt: '2024-01-15T16:00:00Z',
            defectsFound: [],
            correctiveActions: []
          }
        ]
      });
    }, 500);
  });
};

// Description: Submit quality inspection
// Endpoint: POST /api/admin/quality/inspections
// Request: Partial<QualityInspection>
// Response: { success: boolean, inspection: QualityInspection }
export const submitQualityInspection = (inspectionData: Partial<QualityInspection>) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        inspection: {
          _id: 'inspection_' + Date.now(),
          ...inspectionData,
          inspectedAt: new Date().toISOString()
        }
      });
    }, 1000);
  });
};

// Description: Get quality metrics
// Endpoint: GET /api/admin/quality/metrics
// Request: { dateFrom?: string, dateTo?: string }
// Response: { metrics: QualityMetrics }
export const getQualityMetrics = (filters: any = {}) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        metrics: {
          totalInspections: 156,
          passRate: 94.2,
          failRate: 5.8,
          averageInspectionTime: 12.5,
          commonDefects: [
            { defect: 'Screen Alignment Issue', count: 5, percentage: 3.2 },
            { defect: 'Touch Sensitivity Problem', count: 3, percentage: 1.9 },
            { defect: 'Color Accuracy Issue', count: 1, percentage: 0.6 }
          ],
          inspectorPerformance: [
            {
              inspectorId: 'staff1',
              inspectorName: 'Sarah Johnson',
              inspectionsCount: 89,
              passRate: 96.6,
              averageTime: 11.2
            },
            {
              inspectorId: 'staff2',
              inspectorName: 'Mike Chen',
              inspectionsCount: 67,
              passRate: 91.0,
              averageTime: 14.1
            }
          ]
        }
      });
    }, 500);
  });
};