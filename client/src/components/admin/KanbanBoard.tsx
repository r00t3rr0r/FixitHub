import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { KanbanCard } from './KanbanCard';
import { useToast } from '@/hooks/useToast';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface KanbanBoardProps {
  columns: {
    [status: string]: {
      label: string;
      orders?: any[];
      bookings?: any[];
    };
  };
  type: 'order' | 'booking';
  onStatusChange: (itemId: string, newStatus: string) => Promise<void>;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ columns, type, onStatusChange }) => {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [localColumns, setLocalColumns] = useState(columns);

  useEffect(() => {
    setLocalColumns(columns);
  }, [columns]);

  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    setDraggedItem(itemId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    const itemId = e.dataTransfer.getData('itemId');
    const itemType = e.dataTransfer.getData('itemType');

    if (!itemId || itemType !== type) {
      return;
    }

    // Find current status
    let currentStatus = '';
    for (const [status, column] of Object.entries(localColumns)) {
      const items = type === 'order' ? column.orders : column.bookings;
      if (items?.some((item: any) => item._id === itemId)) {
        currentStatus = status;
        break;
      }
    }

    // Don't do anything if dropping in the same column
    if (currentStatus === targetStatus) {
      setDraggedItem(null);
      return;
    }

    try {
      // Optimistically update UI
      const newColumns = { ...localColumns };
      const currentItems = type === 'order' ? newColumns[currentStatus]?.orders : newColumns[currentStatus]?.bookings;
      const targetItems = type === 'order' ? newColumns[targetStatus]?.orders : newColumns[targetStatus]?.bookings;

      if (currentItems && targetItems) {
        const movedItem = currentItems.find((item: any) => item._id === itemId);
        if (movedItem) {
          // Remove from current
          const filteredCurrentItems = currentItems.filter((item: any) => item._id !== itemId);
          if (type === 'order') {
            newColumns[currentStatus].orders = filteredCurrentItems;
          } else {
            newColumns[currentStatus].bookings = filteredCurrentItems;
          }

          // Add to target
          if (type === 'order') {
            newColumns[targetStatus].orders = [...targetItems, movedItem];
          } else {
            newColumns[targetStatus].bookings = [...targetItems, movedItem];
          }

          setLocalColumns(newColumns);
        }
      }

      // Call API to update status
      await onStatusChange(itemId, targetStatus);

      toast({
        title: t('admin.kanban.statusUpdated'),
        description: t('admin.kanban.statusUpdatedDescription'),
      });
    } catch (error: any) {
      console.error('Error updating status:', error);

      // Revert optimistic update on error
      setLocalColumns(columns);

      toast({
        title: t('admin.kanban.error'),
        description: error.message || t('admin.kanban.errorDescription'),
        variant: 'destructive',
      });
    } finally {
      setDraggedItem(null);
    }
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {Object.entries(localColumns).map(([status, column]) => {
        const items = type === 'order' ? column.orders : column.bookings;

        return (
          <div
            key={status}
            className="flex-shrink-0 w-80"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, status)}
          >
            <Card className="bg-muted/50 border-2 border-dashed min-h-[600px]">
              <div className="p-4 border-b bg-background">
                <h3 className="font-semibold text-lg">{column.label}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {items?.length || 0} {type === 'order' ? t('admin.kanban.orders') : t('admin.kanban.bookings')}
                </p>
              </div>
              <div className="p-4 space-y-3">
                {items?.map((item: any) => (
                  <div
                    key={item._id}
                    onDragStart={(e) => handleDragStart(e, item._id)}
                    className={draggedItem === item._id ? 'opacity-50' : ''}
                  >
                    <KanbanCard item={item} type={type} />
                  </div>
                ))}
                {(!items || items.length === 0) && (
                  <div className="text-center text-muted-foreground text-sm py-8">
                    {t('admin.kanban.noItems')}
                  </div>
                )}
              </div>
            </Card>
          </div>
        );
      })}
    </div>
  );
};
