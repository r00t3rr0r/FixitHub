import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/useToast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ServiceData {
  _id: string;
  serviceId: {
    _id: string;
    name: string;
    price: number;
    estimatedTime: number;
  };
  price: number;
  estimatedTime: number;
  notes: string;
}

interface RepairServiceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  service?: ServiceData;
  mode: 'edit' | 'add';
  availableServices: Array<{ _id: string; name: string; price: number; estimatedTime: number }>;
  onSave: (data: any) => Promise<void>;
}

export const RepairServiceDialog: React.FC<RepairServiceDialogProps> = ({
  isOpen,
  onClose,
  service,
  mode,
  availableServices,
  onSave,
}) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    serviceId: '',
    price: 0,
    estimatedTime: 0,
    notes: '',
  });

  // Initialize form data
  useEffect(() => {
    if (mode === 'edit' && service && service.serviceId) {
      setFormData({
        serviceId: service.serviceId?._id || '',
        price: service.price || 0,
        estimatedTime: service.estimatedTime || 0,
        notes: service.notes || '',
      });
    } else {
      setFormData({
        serviceId: '',
        price: 0,
        estimatedTime: 0,
        notes: '',
      });
    }
  }, [mode, service, isOpen]);

  const handleServiceSelect = (serviceId: string) => {
    const selectedService = availableServices.find((s) => s._id === serviceId);
    if (selectedService) {
      setFormData((prev) => ({
        ...prev,
        serviceId,
        price: selectedService.price,
        estimatedTime: selectedService.estimatedTime,
      }));
    }
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0;
    setFormData((prev) => ({
      ...prev,
      price: value,
    }));
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0;
    setFormData((prev) => ({
      ...prev,
      estimatedTime: value,
    }));
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFormData((prev) => ({
      ...prev,
      notes: e.target.value,
    }));
  };

  const handleSubmit = async () => {
    // Validation
    if (mode === 'add' && !formData.serviceId) {
      toast({
        title: 'Error',
        description: 'Please select a service',
        variant: 'destructive',
      });
      return;
    }

    if (formData.price < 0 || formData.estimatedTime < 0) {
      toast({
        title: 'Error',
        description: 'Price and estimated time must be positive numbers',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      await onSave(formData);
      toast({
        title: 'Success',
        description: `Service ${mode === 'edit' ? 'updated' : 'added'} successfully`,
      });
      onClose();
    } catch (error: any) {
      console.error(`Error saving service: ${error.message}`);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'edit' ? 'Edit Repair Service' : 'Add Repair Service to Order'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {mode === 'add' && (
            <div className="space-y-2">
              <Label htmlFor="service-select">Service *</Label>
              <Select value={formData.serviceId} onValueChange={handleServiceSelect}>
                <SelectTrigger id="service-select">
                  <SelectValue placeholder="Select a repair service..." />
                </SelectTrigger>
                <SelectContent>
                  {availableServices.map((service) => (
                    <SelectItem key={service._id} value={service._id}>
                      {service.name} - ${service.price}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="price">Price ($) *</Label>
            <Input
              id="price"
              type="number"
              min="0"
              step="0.01"
              value={formData.price}
              onChange={handlePriceChange}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="time">Estimated Time (minutes) *</Label>
            <Input
              id="time"
              type="number"
              min="0"
              step="15"
              value={formData.estimatedTime}
              onChange={handleTimeChange}
              placeholder="0"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={handleNotesChange}
              placeholder="Add any additional notes..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
