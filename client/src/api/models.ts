// TypeScript interfaces and types for API models

export interface User {
  _id: string
  email: string
  name: string
  phone: string
  avatar?: string
  role: 'customer' | 'staff' | 'admin'
  invoiceAddress: Address
  paymentAddress: Address
  preferences: UserPreferences
  createdAt: string
  updatedAt: string
}

export interface Address {
  street: string
  city: string
  state: string
  zipCode: string
  country: string
  sameAsInvoice?: boolean
}

export interface UserPreferences {
  notifications: {
    email: boolean
    sms: boolean
    push: boolean
    mode?: 'standard' | 'all'
    emailEvents?: {
      inProgress?: boolean
      readyForPickup?: boolean
      completed?: boolean
    }
    pushEvents?: {
      inProgress?: boolean
      readyForPickup?: boolean
      completed?: boolean
    }
    channelsByType?: {
      order_update?: { email?: boolean; push?: boolean }
      payment?: { email?: boolean; push?: boolean }
      message?: { email?: boolean; push?: boolean }
      system?: { email?: boolean; push?: boolean }
      assignment?: { email?: boolean; push?: boolean }
      reminder?: { email?: boolean; push?: boolean }
    }
  }
  communication: {
    language: string
    timezone: string
  }
}

export interface Service {
  _id: string
  name: string
  description: string
  price: number
  estimatedTime: string
  category: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface AddOn {
  _id: string
  name: string
  description: string
  price: number
  status: 'pending' | 'in-progress' | 'completed'
  estimatedTime: string
  qualityPhotos: string[]
  progress: number
}

export interface TimelineEntry {
  _id: string
  status: string
  description: string
  completedAt: string
  staffId: string
  staffName: string
  photos: string[]
}

export interface Order {
  _id: string
  customerId: User
  deviceBrand: string
  deviceModel: string
  deviceType: string
  services: string[]
  addOns: AddOn[]
  status: 'pending' | 'diagnostic-assessment' | 'in-progress' | 'paused' | 'quality-check' | 'ready-for-pickup' | 'completed' | 'cancelled'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  totalCost: number
  photos: string[]
  customerNotes: string
  progress: number
  paymentStatus: 'pending' | 'paid' | 'refunded'
  assignedStaff: string[]
  staffNotes: string[]
  timeline: TimelineEntry[]
  estimatedCompletion?: string
  orderNumber: string
  createdAt: string
  updatedAt: string
}

export interface Message {
  _id: string
  conversationId: string
  senderId: string
  senderName: string
  senderRole: 'customer' | 'staff' | 'admin'
  content: string
  attachments: string[]
  isRead: boolean
  createdAt: string
  updatedAt: string
}

export interface Conversation {
  _id: string
  orderId: string
  participants: string[]
  lastMessage?: Message
  unreadCount: number
  createdAt: string
  updatedAt: string
}

export interface DeviceBrand {
  _id: string
  name: string
  logo?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface DeviceModel {
  _id: string
  brandId: string
  name: string
  type: string
  image?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
  error?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  name: string
  email: string
  password: string
  phone: string
}

export interface AuthResponse {
  user: User
  token: string
  refreshToken: string
}

export interface CreateOrderRequest {
  deviceBrand: string
  deviceModel: string
  deviceType: string
  services: string[]
  addOns: string[]
  customerNotes?: string
  photos?: string[]
}

export interface UpdateOrderRequest {
  status?: Order['status']
  priority?: Order['priority']
  assignedStaff?: string[]
  staffNotes?: string[]
  progress?: number
  estimatedCompletion?: string
}

export interface SendMessageRequest {
  content: string
  attachments?: string[]
}

export interface UpdateProfileRequest {
  name?: string
  phone?: string
  avatar?: string
  invoiceAddress?: Address
  paymentAddress?: Address
  preferences?: UserPreferences
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

export interface ForgotPasswordRequest {
  email: string
}

export interface ResetPasswordRequest {
  token: string
  newPassword: string
}

// Utility types for form handling
export type OrderFormData = Omit<CreateOrderRequest, 'photos'> & {
  photos?: FileList
}

export type ProfileFormData = Omit<UpdateProfileRequest, 'avatar'> & {
  avatar?: FileList
}

// Status enums for better type safety
export const ORDER_STATUSES = {
  PENDING: 'pending',
  IN_PROGRESS: 'in-progress',
  PAUSED: 'paused',
  QUALITY_CHECK: 'quality-check',
  READY_FOR_PICKUP: 'ready-for-pickup',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
} as const

export const PAYMENT_STATUSES = {
  PENDING: 'pending',
  PAID: 'paid',
  REFUNDED: 'refunded'
} as const

export const PRIORITIES = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent'
} as const

export const USER_ROLES = {
  CUSTOMER: 'customer',
  STAFF: 'staff',
  ADMIN: 'admin'
} as const

export type OrderStatus = typeof ORDER_STATUSES[keyof typeof ORDER_STATUSES]
export type PaymentStatus = typeof PAYMENT_STATUSES[keyof typeof PAYMENT_STATUSES]
export type Priority = typeof PRIORITIES[keyof typeof PRIORITIES]
export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES]