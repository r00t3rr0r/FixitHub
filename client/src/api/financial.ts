import api from './api';

export interface Payment {
  _id: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'disputed';
  paymentMethod: 'credit_card' | 'debit_card' | 'paypal' | 'stripe' | 'bank_transfer';
  transactionId: string;
  gatewayResponse: string;
  createdAt: string;
  processedAt?: string;
  refundedAt?: string;
  refundAmount?: number;
  refundReason?: string;
  disputeReason?: string;
  disputeStatus?: 'open' | 'under_review' | 'resolved' | 'closed';
}

export interface Invoice {
  _id: string;
  invoiceNumber: string;
  orderId: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  status: 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'cancelled';
  dueDate: string;
  sentAt?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
  template: string;
  paymentTerms: string;
}

export interface InvoiceItem {
  _id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  type: 'service' | 'addon' | 'product' | 'fee';
}

export interface FinancialReport {
  period: string;
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  grossMargin: number;
  orderRevenue: number;
  addonRevenue: number;
  productRevenue: number;
  refundAmount: number;
  disputeAmount: number;
  paymentMethodBreakdown: {
    method: string;
    amount: number;
    percentage: number;
  }[];
  monthlyTrends: {
    month: string;
    revenue: number;
    orders: number;
    avgOrderValue: number;
  }[];
}

export interface PaymentGateway {
  _id: string;
  name: string;
  provider: 'stripe' | 'paypal' | 'square' | 'authorize_net';
  isActive: boolean;
  configuration: {
    publicKey?: string;
    secretKey?: string;
    webhookUrl?: string;
    currency: string;
    processingFee: number;
    fraudProtection: boolean;
  };
  supportedMethods: string[];
  countries: string[];
  createdAt: string;
  updatedAt: string;
}

// Description: Get all payments with filtering
// Endpoint: GET /api/admin/financial/payments
// Request: { status?: string, method?: string, dateFrom?: string, dateTo?: string, page?: number, limit?: number }
// Response: { payments: Payment[], totalPages: number, currentPage: number, totalAmount: number }
export const getPayments = (filters: any = {}) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        payments: [
          {
            _id: 'payment1',
            orderId: 'order1',
            orderNumber: 'ORD-2024-001',
            customerId: 'customer1',
            customerName: 'John Doe',
            amount: 299.99,
            currency: 'USD',
            status: 'completed',
            paymentMethod: 'credit_card',
            transactionId: 'txn_1234567890',
            gatewayResponse: 'Payment successful',
            createdAt: '2024-01-15T10:30:00Z',
            processedAt: '2024-01-15T10:31:00Z'
          },
          {
            _id: 'payment2',
            orderId: 'order2',
            orderNumber: 'ORD-2024-002',
            customerId: 'customer2',
            customerName: 'Jane Smith',
            amount: 149.99,
            currency: 'USD',
            status: 'refunded',
            paymentMethod: 'paypal',
            transactionId: 'txn_0987654321',
            gatewayResponse: 'Payment refunded',
            createdAt: '2024-01-14T14:20:00Z',
            processedAt: '2024-01-14T14:21:00Z',
            refundedAt: '2024-01-16T09:15:00Z',
            refundAmount: 149.99,
            refundReason: 'Customer request'
          },
          {
            _id: 'payment3',
            orderId: 'order3',
            orderNumber: 'ORD-2024-003',
            customerId: 'customer3',
            customerName: 'Mike Johnson',
            amount: 89.99,
            currency: 'USD',
            status: 'disputed',
            paymentMethod: 'credit_card',
            transactionId: 'txn_1122334455',
            gatewayResponse: 'Payment disputed',
            createdAt: '2024-01-13T16:45:00Z',
            processedAt: '2024-01-13T16:46:00Z',
            disputeReason: 'Unauthorized transaction',
            disputeStatus: 'under_review'
          }
        ],
        totalPages: 1,
        currentPage: 1,
        totalAmount: 539.97
      });
    }, 500);
  });
};

// Description: Process a refund for a payment
// Endpoint: POST /api/admin/financial/payments/:id/refund
// Request: { amount: number, reason: string }
// Response: { success: boolean, message: string, refund: object }
export const processRefund = (paymentId: string, amount: number, reason: string) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        message: 'Refund processed successfully',
        refund: {
          _id: 'refund_' + Date.now(),
          paymentId,
          amount,
          reason,
          processedAt: new Date().toISOString()
        }
      });
    }, 1000);
  });
};

// Description: Get all invoices with filtering
// Endpoint: GET /api/admin/financial/invoices
// Request: { status?: string, dateFrom?: string, dateTo?: string, page?: number, limit?: number }
// Response: { invoices: Invoice[], totalPages: number, currentPage: number, totalAmount: number }
export const getInvoices = (filters: any = {}) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        invoices: [
          {
            _id: 'invoice1',
            invoiceNumber: 'INV-2024-001',
            orderId: 'order1',
            customerId: 'customer1',
            customerName: 'John Doe',
            customerEmail: 'john.doe@example.com',
            items: [
              {
                _id: 'item1',
                description: 'iPhone Screen Replacement',
                quantity: 1,
                unitPrice: 199.99,
                total: 199.99,
                type: 'service'
              },
              {
                _id: 'item2',
                description: 'Screen Protector Installation',
                quantity: 1,
                unitPrice: 25.00,
                total: 25.00,
                type: 'addon'
              }
            ],
            subtotal: 224.99,
            tax: 18.00,
            discount: 0,
            total: 242.99,
            status: 'paid',
            dueDate: '2024-01-30T00:00:00Z',
            sentAt: '2024-01-15T10:00:00Z',
            paidAt: '2024-01-15T10:30:00Z',
            createdAt: '2024-01-15T09:30:00Z',
            updatedAt: '2024-01-15T10:30:00Z',
            template: 'standard',
            paymentTerms: 'Net 15'
          },
          {
            _id: 'invoice2',
            invoiceNumber: 'INV-2024-002',
            orderId: 'order2',
            customerId: 'customer2',
            customerName: 'Jane Smith',
            customerEmail: 'jane.smith@example.com',
            items: [
              {
                _id: 'item3',
                description: 'Samsung Battery Replacement',
                quantity: 1,
                unitPrice: 89.99,
                total: 89.99,
                type: 'service'
              }
            ],
            subtotal: 89.99,
            tax: 7.20,
            discount: 10.00,
            total: 87.19,
            status: 'overdue',
            dueDate: '2024-01-20T00:00:00Z',
            sentAt: '2024-01-14T14:00:00Z',
            createdAt: '2024-01-14T13:30:00Z',
            updatedAt: '2024-01-14T14:00:00Z',
            template: 'standard',
            paymentTerms: 'Net 7'
          }
        ],
        totalPages: 1,
        currentPage: 1,
        totalAmount: 330.18
      });
    }, 500);
  });
};

// Description: Create a new invoice
// Endpoint: POST /api/admin/financial/invoices
// Request: Partial<Invoice>
// Response: { success: boolean, invoice: Invoice }
export const createInvoice = (invoiceData: Partial<Invoice>) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        invoice: {
          _id: 'invoice_' + Date.now(),
          invoiceNumber: 'INV-2024-' + Math.floor(Math.random() * 1000),
          ...invoiceData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      });
    }, 1000);
  });
};

// Description: Send invoice to customer
// Endpoint: POST /api/admin/financial/invoices/:id/send
// Request: { email?: string, message?: string }
// Response: { success: boolean, message: string }
export const sendInvoice = (invoiceId: string, email?: string, message?: string) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        message: 'Invoice sent successfully'
      });
    }, 800);
  });
};

// Description: Get financial reports
// Endpoint: GET /api/admin/financial/reports
// Request: { period?: string, dateFrom?: string, dateTo?: string }
// Response: { report: FinancialReport }
export const getFinancialReports = (filters: any = {}) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        report: {
          period: 'January 2024',
          totalRevenue: 45231.50,
          totalExpenses: 18492.30,
          netProfit: 26739.20,
          grossMargin: 59.1,
          orderRevenue: 38450.00,
          addonRevenue: 4890.50,
          productRevenue: 1891.00,
          refundAmount: 1245.80,
          disputeAmount: 567.90,
          paymentMethodBreakdown: [
            { method: 'Credit Card', amount: 28500.00, percentage: 63.0 },
            { method: 'PayPal', amount: 12300.50, percentage: 27.2 },
            { method: 'Bank Transfer', amount: 4431.00, percentage: 9.8 }
          ],
          monthlyTrends: [
            { month: 'Oct 2023', revenue: 38200.00, orders: 156, avgOrderValue: 244.87 },
            { month: 'Nov 2023', revenue: 41500.00, orders: 178, avgOrderValue: 233.15 },
            { month: 'Dec 2023', revenue: 43800.00, orders: 189, avgOrderValue: 231.75 },
            { month: 'Jan 2024', revenue: 45231.50, orders: 203, avgOrderValue: 222.81 }
          ]
        }
      });
    }, 500);
  });
};

// Description: Get payment gateways
// Endpoint: GET /api/admin/financial/gateways
// Request: {}
// Response: { gateways: PaymentGateway[] }
export const getPaymentGateways = () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        gateways: [
          {
            _id: 'gateway1',
            name: 'Stripe',
            provider: 'stripe',
            isActive: true,
            configuration: {
              publicKey: 'pk_test_***',
              secretKey: 'sk_test_***',
              webhookUrl: 'https://api.fixithub.com/webhooks/stripe',
              currency: 'USD',
              processingFee: 2.9,
              fraudProtection: true
            },
            supportedMethods: ['credit_card', 'debit_card', 'apple_pay', 'google_pay'],
            countries: ['US', 'CA', 'GB', 'AU'],
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-15T10:30:00Z'
          },
          {
            _id: 'gateway2',
            name: 'PayPal',
            provider: 'paypal',
            isActive: true,
            configuration: {
              publicKey: 'paypal_client_id',
              secretKey: 'paypal_client_secret',
              currency: 'USD',
              processingFee: 3.5,
              fraudProtection: true
            },
            supportedMethods: ['paypal', 'paypal_credit'],
            countries: ['US', 'CA', 'GB', 'AU', 'DE', 'FR'],
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-10T14:20:00Z'
          }
        ]
      });
    }, 500);
  });
};

// Description: Update payment gateway configuration
// Endpoint: PUT /api/admin/financial/gateways/:id
// Request: Partial<PaymentGateway>
// Response: { success: boolean, gateway: PaymentGateway }
export const updatePaymentGateway = (gatewayId: string, updates: Partial<PaymentGateway>) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        gateway: {
          _id: gatewayId,
          ...updates,
          updatedAt: new Date().toISOString()
        }
      });
    }, 800);
  });
};