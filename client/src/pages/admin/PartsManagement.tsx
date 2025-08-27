import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/useToast"
import { getParts, getPartOrders, getSuppliers, createInventoryItem, updatePartStock, deletePart, Part, PartOrder, Supplier } from "@/api/parts"
import {
  Package,
  Search,
  Plus,
  Edit,
  Eye,
  Truck,
  AlertTriangle,
  DollarSign,
  TrendingUp,
  Wrench,
  MapPin,
  Trash2,
  Settings
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Label
} from "@/components/ui/label"
import {
  Textarea
} from "@/components/ui/textarea"

interface PartVersion {
  versionType: 'original' | 'cheap' | 'efficient';
  quantity: number;
  minStockLevel: number;
  reorderLevel: number;
  quantityOnOrder: number;
  unitCost: number;
  sellingPrice: number;
  discounts: number;
  storageLocation: string;
  supplierInfo: {
    name: string;
    contactPerson: string;
    email: string;
    phone: string;
    address: string;
  };
  leadTime: number;
  expirationDate?: string;
  status: 'active' | 'discontinued' | 'out-of-stock';
  notes: string;
  images: string[];
}

interface NewPartData {
  itemName: string;
  itemDescription: string;
  category: string;
  manufacturer: string;
  brand: string;
  compatibleDevices: string[];
  versions: PartVersion[];
  specifications: { [key: string]: string };
}

export function PartsManagement() {
  const [parts, setParts] = useState<Part[]>([])
  const [orders, setOrders] = useState<PartOrder[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [addingPart, setAddingPart] = useState(false)

  // Adjust Quantity Dialog
  const [showAdjustDialog, setShowAdjustDialog] = useState(false)
  const [selectedPart, setSelectedPart] = useState<Part | null>(null)
  const [adjustQuantity, setAdjustQuantity] = useState(0)
  const [adjustOperation, setAdjustOperation] = useState<'add' | 'subtract' | 'set'>('set')
  const [adjustReason, setAdjustReason] = useState('')
  const [adjustingQuantity, setAdjustingQuantity] = useState(false)

  // Delete Dialog
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [partToDelete, setPartToDelete] = useState<Part | null>(null)
  const [deletingPart, setDeletingPart] = useState(false)

  const { toast } = useToast()

  // Form state for new part
  const [newPart, setNewPart] = useState<NewPartData>({
    itemName: '',
    itemDescription: '',
    category: '',
    manufacturer: '',
    brand: '',
    compatibleDevices: [],
    versions: [
      {
        versionType: 'original',
        quantity: 0,
        minStockLevel: 5,
        reorderLevel: 10,
        quantityOnOrder: 0,
        unitCost: 0,
        sellingPrice: 0,
        discounts: 0,
        storageLocation: 'A1-B1',
        supplierInfo: {
          name: '',
          contactPerson: '',
          email: '',
          phone: '',
          address: ''
        },
        leadTime: 7,
        status: 'active',
        notes: '',
        images: []
      }
    ],
    specifications: {}
  })

  const [compatibleDeviceInput, setCompatibleDeviceInput] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log("Fetching parts data...")
        const [partsResponse, ordersResponse, suppliersResponse] = await Promise.all([
          getParts(),
          getPartOrders(),
          getSuppliers()
        ])

        setParts((partsResponse as any).parts || [])
        setOrders((ordersResponse as any).orders || [])
        setSuppliers((suppliersResponse as any).suppliers || [])
      } catch (error) {
        console.error("Error fetching parts data:", error)
        toast({
          title: "Error",
          description: "Failed to load parts data",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [toast])

  const filteredParts = parts.filter(part => {
    const matchesSearch = part.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         part.partNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         part.brand.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = categoryFilter === "all" || part.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  const categories = [...new Set(parts.map(p => p.category))]
  const totalValue = parts.reduce((sum, part) => sum + (part.cost * part.stockQuantity), 0)
  const lowStockParts = parts.filter(p => p.stockQuantity <= p.minStockLevel).length

  const handleAddPart = async () => {
    if (!newPart.itemName || !newPart.category || !newPart.manufacturer || !newPart.brand) {
      toast({
        title: "Error",
        description: "Please fill in all required fields: Item name, category, manufacturer, and brand",
        variant: "destructive"
      })
      return
    }

    if (newPart.versions.length === 0) {
      toast({
        title: "Error",
        description: "At least one version is required",
        variant: "destructive"
      })
      return
    }

    for (let i = 0; i < newPart.versions.length; i++) {
      const version = newPart.versions[i]
      if (!version.storageLocation || version.storageLocation.trim() === '') {
        toast({
          title: "Error",
          description: `Storage location is required for version ${i + 1}`,
          variant: "destructive"
        })
        return
      }
      if (version.unitCost < 0 || version.sellingPrice < 0) {
        toast({
          title: "Error",
          description: `Unit cost and selling price must be non-negative for version ${i + 1}`,
          variant: "destructive"
        })
        return
      }
    }

    setAddingPart(true)

    try {
      await createInventoryItem(newPart)

      toast({
        title: "Success",
        description: "Part added successfully",
      })

      setNewPart({
        itemName: '',
        itemDescription: '',
        category: '',
        manufacturer: '',
        brand: '',
        compatibleDevices: [],
        versions: [
          {
            versionType: 'original',
            quantity: 0,
            minStockLevel: 5,
            reorderLevel: 10,
            quantityOnOrder: 0,
            unitCost: 0,
            sellingPrice: 0,
            discounts: 0,
            storageLocation: 'A1-B1',
            supplierInfo: {
              name: '',
              contactPerson: '',
              email: '',
              phone: '',
              address: ''
            },
            leadTime: 7,
            status: 'active',
            notes: '',
            images: []
          }
        ],
        specifications: {}
      })
      setCompatibleDeviceInput('')
      setShowAddDialog(false)

      const partsResponse = await getParts()
      setParts((partsResponse as any).parts || [])

    } catch (error) {
      console.error("Error adding part:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to add part",
        variant: "destructive"
      })
    } finally {
      setAddingPart(false)
    }
  }

  const handleAdjustQuantity = async () => {
    if (!selectedPart || adjustQuantity < 0) {
      toast({
        title: "Error",
        description: "Please enter a valid quantity",
        variant: "destructive"
      })
      return
    }

    if (!adjustReason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a reason for the adjustment",
        variant: "destructive"
      })
      return
    }

    setAdjustingQuantity(true)

    try {
      // Use the actual version ID from the first version in the versions array
      const versionId = selectedPart.versions?.[0]?._id
      
      if (!versionId) {
        toast({
          title: "Error",
          description: "Version ID not found for this part",
          variant: "destructive"
        })
        return
      }

      await updatePartStock(selectedPart._id, versionId, adjustQuantity, adjustOperation, adjustReason)

      toast({
        title: "Success",
        description: "Quantity adjusted successfully",
      })

      setShowAdjustDialog(false)
      setSelectedPart(null)
      setAdjustQuantity(0)
      setAdjustReason('')

      const partsResponse = await getParts()
      setParts((partsResponse as any).parts || [])

    } catch (error) {
      console.error("Error adjusting quantity:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to adjust quantity",
        variant: "destructive"
      })
    } finally {
      setAdjustingQuantity(false)
    }
  }

  const handleDeletePart = async () => {
    if (!partToDelete) return

    setDeletingPart(true)

    try {
      // Make API call to delete the part from database
      await deletePart(partToDelete._id)

      // Remove from local state only after successful API call
      setParts(parts.filter(p => p._id !== partToDelete._id))

      toast({
        title: "Success",
        description: "Part deleted successfully",
      })

      setShowDeleteDialog(false)
      setPartToDelete(null)

    } catch (error) {
      console.error("Error deleting part:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to delete part",
        variant: "destructive"
      })
    } finally {
      setDeletingPart(false)
    }
  }

  const addVersion = () => {
    const newVersion: PartVersion = {
      versionType: 'cheap',
      quantity: 0,
      minStockLevel: 5,
      reorderLevel: 10,
      quantityOnOrder: 0,
      unitCost: 0,
      sellingPrice: 0,
      discounts: 0,
      storageLocation: 'A1-B1',
      supplierInfo: {
        name: '',
        contactPerson: '',
        email: '',
        phone: '',
        address: ''
      },
      leadTime: 7,
      status: 'active',
      notes: '',
      images: []
    }

    setNewPart(prev => ({
      ...prev,
      versions: [...prev.versions, newVersion]
    }))
  }

  const removeVersion = (index: number) => {
    if (newPart.versions.length > 1) {
      setNewPart(prev => ({
        ...prev,
        versions: prev.versions.filter((_, i) => i !== index)
      }))
    }
  }

  const updateVersion = (index: number, field: string, value: any) => {
    setNewPart(prev => ({
      ...prev,
      versions: prev.versions.map((version, i) =>
        i === index ? { ...version, [field]: value } : version
      )
    }))
  }

  const updateVersionSupplier = (index: number, field: string, value: string) => {
    setNewPart(prev => ({
      ...prev,
      versions: prev.versions.map((version, i) =>
        i === index ? {
          ...version,
          supplierInfo: { ...version.supplierInfo, [field]: value }
        } : version
      )
    }))
  }

  const addCompatibleDevice = () => {
    if (compatibleDeviceInput.trim() && !newPart.compatibleDevices.includes(compatibleDeviceInput.trim())) {
      setNewPart(prev => ({
        ...prev,
        compatibleDevices: [...prev.compatibleDevices, compatibleDeviceInput.trim()]
      }))
      setCompatibleDeviceInput('')
    }
  }

  const removeCompatibleDevice = (device: string) => {
    setNewPart(prev => ({
      ...prev,
      compatibleDevices: prev.compatibleDevices.filter(d => d !== device)
    }))
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded w-48 animate-pulse"></div>
        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-6 bg-muted rounded w-1/3"></div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Package className="h-8 w-8" />
            Parts Management
          </h1>
          <p className="text-muted-foreground">
            Manage inventory, suppliers, and part orders
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Part
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Total Parts
            </CardTitle>
            <Package className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              {parts.length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">
              Total Value
            </CardTitle>
            <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900 dark:text-green-100">
              ${totalValue.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 border-red-200 dark:border-red-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-700 dark:text-red-300">
              Low Stock
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-900 dark:text-red-100">
              {lowStockParts}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300">
              Categories
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
              {categories.length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search parts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Parts Inventory</CardTitle>
          <CardDescription>
            Manage your parts inventory and stock levels
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Part Number</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredParts.map((part) => (
                <TableRow key={part._id}>
                  <TableCell className="font-medium">{part.partNumber}</TableCell>
                  <TableCell>{part.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {part.category}
                    </Badge>
                  </TableCell>
                  <TableCell>{part.brand}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className={part.stockQuantity <= part.minStockLevel ? "text-red-600 font-medium" : ""}>
                        {part.stockQuantity}
                      </span>
                      {part.stockQuantity <= part.minStockLevel && (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {part.location}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={part.stockQuantity > 0 ? "default" : "destructive"}>
                      {part.stockQuantity > 0 ? "In Stock" : "Out of Stock"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" title="View Details">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" title="Edit Part">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        title="Adjust Quantity"
                        onClick={() => {
                          setSelectedPart(part)
                          setShowAdjustDialog(true)
                        }}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        title="Delete Part"
                        onClick={() => {
                          setPartToDelete(part)
                          setShowDeleteDialog(true)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showAdjustDialog} onOpenChange={setShowAdjustDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Quantity</DialogTitle>
            <DialogDescription>
              Adjust the quantity for {selectedPart?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="operation">Operation</Label>
              <Select value={adjustOperation} onValueChange={(value: 'add' | 'subtract' | 'set') => setAdjustOperation(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="set">Set to</SelectItem>
                  <SelectItem value="add">Add</SelectItem>
                  <SelectItem value="subtract">Subtract</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                value={adjustQuantity}
                onChange={(e) => setAdjustQuantity(parseInt(e.target.value) || 0)}
                min="0"
                placeholder="Enter quantity"
              />
            </div>

            <div>
              <Label htmlFor="reason">Reason *</Label>
              <Textarea
                id="reason"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="Reason for adjustment..."
                rows={3}
              />
            </div>

            <div className="text-sm text-muted-foreground">
              Current quantity: {selectedPart?.stockQuantity}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdjustDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdjustQuantity} disabled={adjustingQuantity}>
              {adjustingQuantity ? "Adjusting..." : "Adjust Quantity"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Part</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{partToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePart} disabled={deletingPart}>
              {deletingPart ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}