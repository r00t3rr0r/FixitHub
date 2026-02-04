import api from './api';

// Description: Get communication thread for an order
// Endpoint: GET /api/inspection-communication/:orderId
// Request: {}
// Response: { communication: Object }
export const getCommunicationThread = async (orderId: string) => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        _id: 'comm_' + orderId,
        messages: [
          {
            _id: 'msg_1',
            senderId: { name: 'John Doe', email: 'john@example.com', avatar: '' },
            senderName: 'John Doe',
            senderType: 'staff',
            messageType: 'text',
            content: 'Thank you for submitting your device. We have received it and will begin the inspection shortly.',
            createdAt: new Date(Date.now() - 86400000).toISOString(),
            readBy: []
          },
          {
            _id: 'msg_2',
            senderId: { name: 'Jane Smith', email: 'jane@example.com', avatar: '' },
            senderName: 'Jane Smith',
            senderType: 'customer',
            messageType: 'text',
            content: 'Thank you! How long will the inspection take?',
            createdAt: new Date(Date.now() - 72000000).toISOString(),
            readBy: []
          },
          {
            _id: 'msg_3',
            senderId: { name: 'John Doe', email: 'john@example.com', avatar: '' },
            senderName: 'John Doe',
            senderType: 'staff',
            messageType: 'feedback_request',
            content: 'We need your input on device condition',
            feedbackRequest: {
              question: 'Can you confirm the device was working before the issue occurred?',
              options: [
                { label: 'Yes, it was working fine', value: 'yes_working' },
                { label: 'No, it had issues', value: 'no_issues' },
                { label: 'Not sure', value: 'not_sure' }
              ],
              response: { label: 'Yes, it was working fine', value: 'yes_working' },
              status: 'responded'
            },
            createdAt: new Date(Date.now() - 60000000).toISOString(),
            readBy: []
          },
          {
            _id: 'msg_4',
            senderId: { name: 'John Doe', email: 'john@example.com', avatar: '' },
            senderName: 'John Doe',
            senderType: 'staff',
            messageType: 'quick_action',
            content: 'Quick action notification',
            quickAction: {
              actionType: 'part_replacement',
              actionLabel: 'Part Replacement Required',
              description: 'We found that the battery needs to be replaced. This is covered under your repair service.',
              status: 'pending'
            },
            createdAt: new Date(Date.now() - 48000000).toISOString(),
            readBy: []
          },
          {
            _id: 'msg_5',
            senderId: { name: 'Jane Smith', email: 'jane@example.com', avatar: '' },
            senderName: 'Jane Smith',
            senderType: 'customer',
            messageType: 'text',
            content: 'That sounds good. Please go ahead with the repair.',
            createdAt: new Date(Date.now() - 36000000).toISOString(),
            readBy: []
          },
          {
            _id: 'msg_6',
            senderId: { name: 'John Doe', email: 'john@example.com', avatar: '' },
            senderName: 'John Doe',
            senderType: 'staff',
            messageType: 'text',
            content: 'We have started the repair. The estimated completion time is 2 hours.',
            createdAt: new Date(Date.now() - 24000000).toISOString(),
            readBy: []
          },
          {
            _id: 'msg_7',
            senderId: { name: 'System', email: 'system@example.com', avatar: '' },
            senderName: 'System',
            senderType: 'system',
            messageType: 'system_notification',
            content: 'Repair status has been updated to In Progress',
            createdAt: new Date(Date.now() - 12000000).toISOString(),
            readBy: []
          },
          {
            _id: 'msg_8',
            senderId: { name: 'John Doe', email: 'john@example.com', avatar: '' },
            senderName: 'John Doe',
            senderType: 'staff',
            messageType: 'text',
            content: 'Great news! The repair is complete and testing shows everything is working perfectly.',
            createdAt: new Date(Date.now() - 3600000).toISOString(),
            readBy: []
          },
          {
            _id: 'msg_9',
            senderId: { name: 'John Doe', email: 'john@example.com', avatar: '' },
            senderName: 'John Doe',
            senderType: 'staff',
            messageType: 'feedback_request',
            content: 'Please rate our service',
            feedbackRequest: {
              question: 'How satisfied are you with our repair service?',
              options: [
                { label: 'Very Satisfied', value: 'very_satisfied' },
                { label: 'Satisfied', value: 'satisfied' },
                { label: 'Neutral', value: 'neutral' },
                { label: 'Unsatisfied', value: 'unsatisfied' }
              ],
              status: 'pending'
            },
            createdAt: new Date(Date.now() - 1800000).toISOString(),
            readBy: []
          },
          {
            _id: 'msg_10',
            senderId: { name: 'Jane Smith', email: 'jane@example.com', avatar: '' },
            senderName: 'Jane Smith',
            senderType: 'customer',
            messageType: 'text',
            content: 'Excellent work! I am very impressed with the quick turnaround.',
            createdAt: new Date(Date.now() - 900000).toISOString(),
            readBy: []
          },
          {
            _id: 'msg_11',
            senderId: { name: 'John Doe', email: 'john@example.com', avatar: '' },
            senderName: 'John Doe',
            senderType: 'staff',
            messageType: 'quick_action',
            content: 'Action completed',
            quickAction: {
              actionType: 'part_replacement',
              actionLabel: 'Part Replacement Completed',
              description: 'Battery replacement has been successfully completed and tested.',
              status: 'completed'
            },
            createdAt: new Date(Date.now() - 300000).toISOString(),
            readBy: []
          },
          {
            _id: 'msg_12',
            senderId: { name: 'System', email: 'system@example.com', avatar: '' },
            senderName: 'System',
            senderType: 'system',
            messageType: 'system_notification',
            content: 'Device is ready for pickup or shipment',
            createdAt: new Date(Date.now() - 60000).toISOString(),
            readBy: []
          },
          {
            _id: 'msg_13',
            senderId: { name: 'John Doe', email: 'john@example.com', avatar: '' },
            senderName: 'John Doe',
            senderType: 'staff',
            messageType: 'text',
            content: 'Your device is ready! You can pick it up at our store or we can ship it to you. Let us know your preference.',
            createdAt: new Date(Date.now() - 30000).toISOString(),
            readBy: []
          }
        ],
        pendingFeedbackCount: 1,
        pendingActionsCount: 0,
        status: 'active',
        lastMessageAt: new Date().toISOString()
      });
    }, 500);
  });

  // Uncomment the below lines to make an actual API call
  // try {
  //   const response = await api.get(`/api/inspection-communication/${orderId}`);
  //   return response.data.communication;
  // } catch (error) {
  //   throw new Error((error as any)?.response?.data?.error || (error as any).message);
  // }
};

// Description: Send a message in the communication thread
// Endpoint: POST /api/inspection-communication/:orderId/message
// Request: { content: string }
// Response: { communication: Object }
export const sendMessage = async (orderId: string, content: string) => {
  // Mocking the response - in production this will be replaced by actual API call
  return new Promise((resolve) => {
    setTimeout(() => {
      const thread = {
        _id: 'comm_' + orderId,
        messages: [
          {
            _id: 'msg_new',
            senderId: { name: 'Current User', email: 'user@example.com', avatar: '' },
            senderName: 'Current User',
            senderType: 'customer',
            messageType: 'text',
            content,
            createdAt: new Date().toISOString(),
            readBy: []
          }
        ],
        pendingFeedbackCount: 0,
        pendingActionsCount: 0,
        status: 'active',
        lastMessageAt: new Date().toISOString()
      };
      resolve(thread);
    }, 300);
  });

  // Uncomment the below lines to make an actual API call
  // try {
  //   const response = await api.post(`/api/inspection-communication/${orderId}/message`, {
  //     content,
  //   });
  //   return response.data.communication;
  // } catch (error) {
  //   throw new Error((error as any)?.response?.data?.error || (error as any).message);
  // }
};

// Description: Send a feedback request
// Endpoint: POST /api/inspection-communication/:orderId/feedback-request
// Request: { inspectionId: string, question: string, options: Array<{label, value}> }
// Response: { communication: Object }
export const sendFeedbackRequest = async (
  orderId: string,
  inspectionId: string,
  question: string,
  options: Array<{ label: string; value: string }>
) => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      const thread = {
        _id: 'comm_' + orderId,
        messages: [
          {
            _id: 'msg_feedback_' + Date.now(),
            senderId: { name: 'Support Staff', email: 'staff@example.com', avatar: '' },
            senderName: 'Support Staff',
            senderType: 'staff',
            messageType: 'feedback_request',
            content: question,
            feedbackRequest: {
              question,
              options,
              status: 'pending'
            },
            createdAt: new Date().toISOString(),
            readBy: []
          }
        ],
        pendingFeedbackCount: 1,
        pendingActionsCount: 0,
        status: 'active',
        lastMessageAt: new Date().toISOString()
      };
      resolve(thread);
    }, 300);
  });

  // Uncomment the below lines to make an actual API call
  // try {
  //   const response = await api.post(`/api/inspection-communication/${orderId}/feedback-request`, {
  //     inspectionId,
  //     question,
  //     options,
  //   });
  //   return response.data.communication;
  // } catch (error) {
  //   throw new Error((error as any)?.response?.data?.error || (error as any).message);
  // }
};

// Description: Respond to a feedback request
// Endpoint: POST /api/inspection-communication/:orderId/feedback-response
// Request: { messageId: string, response: {label, value} }
// Response: { communication: Object }
export const respondToFeedback = async (
  orderId: string,
  messageId: string,
  response: { label: string; value: string }
) => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      const thread = {
        _id: 'comm_' + orderId,
        messages: [
          {
            _id: messageId,
            senderId: { name: 'Support Staff', email: 'staff@example.com', avatar: '' },
            senderName: 'Support Staff',
            senderType: 'staff',
            messageType: 'feedback_request',
            content: 'Feedback question',
            feedbackRequest: {
              question: 'Sample question',
              options: [
                { label: 'Option 1', value: 'option_1' },
                { label: 'Option 2', value: 'option_2' }
              ],
              response,
              status: 'responded'
            },
            createdAt: new Date().toISOString(),
            readBy: []
          }
        ],
        pendingFeedbackCount: 0,
        pendingActionsCount: 0,
        status: 'active',
        lastMessageAt: new Date().toISOString()
      };
      resolve(thread);
    }, 300);
  });

  // Uncomment the below lines to make an actual API call
  // try {
  //   const response_obj = await api.post(`/api/inspection-communication/${orderId}/feedback-response`, {
  //     messageId,
  //     response,
  //   });
  //   return response_obj.data.communication;
  // } catch (error) {
  //   throw new Error((error as any)?.response?.data?.error || (error as any).message);
  // }
};

// Description: Create a quick action
// Endpoint: POST /api/inspection-communication/:orderId/quick-action
// Request: { inspectionId: string, actionType: string, description?: string, metadata?: object }
// Response: { communication: Object }
export const createQuickAction = async (
  orderId: string,
  inspectionId: string,
  actionType: 'part_replacement' | 'incorrect_device' | 'incorrect_unlock_code' | 'additional_costs',
  description?: string,
  metadata?: any
) => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      const actionLabels: Record<string, string> = {
        'part_replacement': 'Part Replacement Required',
        'incorrect_device': 'Device Information Incorrect',
        'incorrect_unlock_code': 'Unlock Code Incorrect',
        'additional_costs': 'Additional Costs Required'
      };

      const thread = {
        _id: 'comm_' + orderId,
        messages: [
          {
            _id: 'msg_action_' + Date.now(),
            senderId: { name: 'Support Staff', email: 'staff@example.com', avatar: '' },
            senderName: 'Support Staff',
            senderType: 'staff',
            messageType: 'quick_action',
            content: actionLabels[actionType] || 'Action Notification',
            quickAction: {
              actionType,
              actionLabel: actionLabels[actionType] || 'Action Notification',
              description: description || '',
              status: 'pending'
            },
            createdAt: new Date().toISOString(),
            readBy: []
          }
        ],
        pendingFeedbackCount: 0,
        pendingActionsCount: 1,
        status: 'active',
        lastMessageAt: new Date().toISOString()
      };
      resolve(thread);
    }, 300);
  });

  // Uncomment the below lines to make an actual API call
  // try {
  //   const response = await api.post(`/api/inspection-communication/${orderId}/quick-action`, {
  //     inspectionId,
  //     actionType,
  //     description,
  //     metadata,
  //   });
  //   return response.data.communication;
  // } catch (error) {
  //   throw new Error((error as any)?.response?.data?.error || (error as any).message);
  // }
};

// Description: Complete a quick action
// Endpoint: PUT /api/inspection-communication/:orderId/quick-action/:messageId/complete
// Request: {}
// Response: { communication: Object }
export const completeQuickAction = async (orderId: string, messageId: string) => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      const thread = {
        _id: 'comm_' + orderId,
        messages: [
          {
            _id: messageId,
            senderId: { name: 'Support Staff', email: 'staff@example.com', avatar: '' },
            senderName: 'Support Staff',
            senderType: 'staff',
            messageType: 'quick_action',
            content: 'Action Notification',
            quickAction: {
              actionType: 'part_replacement',
              actionLabel: 'Part Replacement',
              description: 'Part has been replaced',
              status: 'completed'
            },
            createdAt: new Date().toISOString(),
            readBy: []
          }
        ],
        pendingFeedbackCount: 0,
        pendingActionsCount: 0,
        status: 'active',
        lastMessageAt: new Date().toISOString()
      };
      resolve(thread);
    }, 300);
  });

  // Uncomment the below lines to make an actual API call
  // try {
  //   const response = await api.put(`/api/inspection-communication/${orderId}/quick-action/${messageId}/complete`, {});
  //   return response.data.communication;
  // } catch (error) {
  //   throw new Error((error as any)?.response?.data?.error || (error as any).message);
  // }
};

// Description: Mark all messages as read
// Endpoint: PUT /api/inspection-communication/:orderId/mark-read
// Request: {}
// Response: { communication: Object }
export const markMessagesAsRead = async (orderId: string) => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      const thread = {
        _id: 'comm_' + orderId,
        messages: [],
        pendingFeedbackCount: 0,
        pendingActionsCount: 0,
        status: 'active',
        lastMessageAt: new Date().toISOString()
      };
      resolve(thread);
    }, 300);
  });

  // Uncomment the below lines to make an actual API call
  // try {
  //   const response = await api.put(`/api/inspection-communication/${orderId}/mark-read`, {});
  //   return response.data.communication;
  // } catch (error) {
  //   throw new Error((error as any)?.response?.data?.error || (error as any).message);
  // }
};

// Description: Get pending feedback count
// Endpoint: GET /api/inspection-communication/:orderId/pending-feedback
// Request: {}
// Response: { count: number }
export const getPendingFeedbackCount = async (orderId: string) => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(1);
    }, 200);
  });

  // Uncomment the below lines to make an actual API call
  // try {
  //   const response = await api.get(`/api/inspection-communication/${orderId}/pending-feedback`);
  //   return response.data.count;
  // } catch (error) {
  //   throw new Error((error as any)?.response?.data?.error || (error as any).message);
  // }
};

// Description: Get pending actions count
// Endpoint: GET /api/inspection-communication/:orderId/pending-actions
// Request: {}
// Response: { count: number }
export const getPendingActionsCount = async (orderId: string) => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(0);
    }, 200);
  });

  // Uncomment the below lines to make an actual API call
  // try {
  //   const response = await api.get(`/api/inspection-communication/${orderId}/pending-actions`);
  //   return response.data.count;
  // } catch (error) {
  //   throw new Error((error as any)?.response?.data?.error || (error as any).message);
  // }
};
