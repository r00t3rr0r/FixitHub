import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { Calendar, User, DollarSign, Package } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface KanbanCardProps {
  item: any;
  type: 'order' | 'booking';
}

export const KanbanCard: React.FC<KanbanCardProps> = ({ item, type }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleClick = () => {
    if (type === 'order') {
      navigate(`/admin/orders/${item._id}`);
    } else {
      navigate(`/admin/bookings`);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'destructive';
      case 'high':
        return 'default';
      case 'normal':
        return 'secondary';
      case 'low':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getBillingStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'default';
      case 'pending':
        return 'secondary';
      case 'overdue':
        return 'destructive';
      case 'refunded':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  return (
    <Card
      className="cursor-pointer hover:shadow-lg transition-shadow duration-200 bg-card"
      onClick={handleClick}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('itemId', item._id);
        e.dataTransfer.setData('itemType', type);
      }}
    >
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <CardTitle className="text-sm font-semibold">
            {type === 'order' ? item.orderNumber : item.bookingNumber}
          </CardTitle>
          {type === 'order' && item.priority && (
            <Badge variant={getPriorityColor(item.priority)}>
              {item.priority}
            </Badge>
          )}
          {type === 'booking' && item.billingStatus && (
            <Badge variant={getBillingStatusColor(item.billingStatus)}>
              {item.billingStatus}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Customer Info */}
        <div className="flex items-center text-sm text-muted-foreground">
          <User className="w-4 h-4 mr-2" />
          <span>
            {item.customer?.firstName} {item.customer?.lastName}
          </span>
        </div>

        {/* Device Info (for orders) */}
        {type === 'order' && item.device && (
          <div className="flex items-center text-sm text-muted-foreground">
            <Package className="w-4 h-4 mr-2" />
            <span className="truncate">
              {item.device.manufacturer} {item.device.model}
            </span>
          </div>
        )}

        {/* Total Amount */}
        <div className="flex items-center text-sm text-muted-foreground">
          <DollarSign className="w-4 h-4 mr-2" />
          <span className="font-semibold">
            ${type === 'order' ? item.totalCost?.toFixed(2) : item.totalAmount?.toFixed(2)}
          </span>
        </div>

        {/* Date */}
        <div className="flex items-center text-sm text-muted-foreground">
          <Calendar className="w-4 h-4 mr-2" />
          <span>{new Date(item.createdAt).toLocaleDateString()}</span>
        </div>

        {/* Assigned To (for orders) */}
        {type === 'order' && item.assignedTo && (
          <div className="text-xs text-muted-foreground mt-2 pt-2 border-t">
            <span className="font-semibold">{t('admin.orders.assignedTo')}:</span>{' '}
            {item.assignedTo.firstName} {item.assignedTo.lastName}
          </div>
        )}

        {/* Order Count (for bookings) */}
        {type === 'booking' && item.orders && (
          <div className="text-xs text-muted-foreground mt-2 pt-2 border-t">
            <span className="font-semibold">{t('admin.bookings.orders')}:</span>{' '}
            {item.orders.length}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
