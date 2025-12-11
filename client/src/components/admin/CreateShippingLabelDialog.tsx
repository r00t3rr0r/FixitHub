import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/useToast"
import { createShippingLabel, ShipmentData } from "@/api/shipping"
import { Package, Loader2 } from "lucide-react"

interface CreateShippingLabelDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId: string
  onSuccess: () => void
}

export function CreateShippingLabelDialog({
  open,
  onOpenChange,
  orderId,
  onSuccess
}: CreateShippingLabelDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const [formData, setFormData] = useState<ShipmentData>({
    weight: 1.0,
    length: 20,
    width: 15,
    height: 10,
    serviceType: 'P',
    shipperAddress: 'Company Street 1',
    shipperCity: 'Berlin',
    shipperPostalCode: '10115',
    shipperCountry: 'DE',
    shipperEmail: 'info@fixithub.com',
    shipperPhone: '+49 30 1234567',
    shipperCompany: 'FixitHub',
    shipperName: 'FixitHub Logistics',
    shippingCost: 0,
    isCustomsDeclarable: false
  })

  const handleCreate = async () => {
    if (!formData.weight || !formData.length || !formData.width || !formData.height) {
      toast({
        title: "Error",
        description: "Please fill in all package dimensions",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    try {
      const result = await createShippingLabel(orderId, formData)

      toast({
        title: "Success",
        description: `Shipping label created! Tracking: ${result.trackingNumber}`
      })

      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      console.error('Error creating shipping label:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to create shipping label",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Create DHL Shipping Label
          </DialogTitle>
          <DialogDescription>
            Configure shipment details and generate DHL shipping label
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Package Dimensions */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Package Dimensions (cm & kg)</h3>
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="weight">Weight (kg) *</Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={formData.weight}
                  onChange={(e) => setFormData(prev => ({ ...prev, weight: parseFloat(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="length">Length (cm) *</Label>
                <Input
                  id="length"
                  type="number"
                  min="1"
                  value={formData.length}
                  onChange={(e) => setFormData(prev => ({ ...prev, length: parseInt(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="width">Width (cm) *</Label>
                <Input
                  id="width"
                  type="number"
                  min="1"
                  value={formData.width}
                  onChange={(e) => setFormData(prev => ({ ...prev, width: parseInt(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="height">Height (cm) *</Label>
                <Input
                  id="height"
                  type="number"
                  min="1"
                  value={formData.height}
                  onChange={(e) => setFormData(prev => ({ ...prev, height: parseInt(e.target.value) }))}
                />
              </div>
            </div>
          </div>

          {/* Service Type */}
          <div className="space-y-2">
            <Label htmlFor="serviceType">Service Type</Label>
            <Select
              value={formData.serviceType}
              onValueChange={(value) => setFormData(prev => ({ ...prev, serviceType: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="P">DHL Paket (Domestic)</SelectItem>
                <SelectItem value="N">DHL Express (International)</SelectItem>
                <SelectItem value="Y">DHL Economy Select</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Shipper Details */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Shipper Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="shipperCompany">Company Name</Label>
                <Input
                  id="shipperCompany"
                  value={formData.shipperCompany}
                  onChange={(e) => setFormData(prev => ({ ...prev, shipperCompany: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shipperName">Contact Name</Label>
                <Input
                  id="shipperName"
                  value={formData.shipperName}
                  onChange={(e) => setFormData(prev => ({ ...prev, shipperName: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="shipperEmail">Email</Label>
                <Input
                  id="shipperEmail"
                  type="email"
                  value={formData.shipperEmail}
                  onChange={(e) => setFormData(prev => ({ ...prev, shipperEmail: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shipperPhone">Phone</Label>
                <Input
                  id="shipperPhone"
                  value={formData.shipperPhone}
                  onChange={(e) => setFormData(prev => ({ ...prev, shipperPhone: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="shipperAddress">Address</Label>
              <Input
                id="shipperAddress"
                value={formData.shipperAddress}
                onChange={(e) => setFormData(prev => ({ ...prev, shipperAddress: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="shipperCity">City</Label>
                <Input
                  id="shipperCity"
                  value={formData.shipperCity}
                  onChange={(e) => setFormData(prev => ({ ...prev, shipperCity: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shipperPostalCode">Postal Code</Label>
                <Input
                  id="shipperPostalCode"
                  value={formData.shipperPostalCode}
                  onChange={(e) => setFormData(prev => ({ ...prev, shipperPostalCode: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shipperCountry">Country Code</Label>
                <Input
                  id="shipperCountry"
                  value={formData.shipperCountry}
                  onChange={(e) => setFormData(prev => ({ ...prev, shipperCountry: e.target.value.toUpperCase() }))}
                  maxLength={2}
                />
              </div>
            </div>
          </div>

          {/* Shipping Cost */}
          <div className="space-y-2">
            <Label htmlFor="shippingCost">Shipping Cost (€)</Label>
            <Input
              id="shippingCost"
              type="number"
              step="0.01"
              min="0"
              value={formData.shippingCost}
              onChange={(e) => setFormData(prev => ({ ...prev, shippingCost: parseFloat(e.target.value) }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating Label...
              </>
            ) : (
              <>
                <Package className="h-4 w-4 mr-2" />
                Create Shipping Label
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
