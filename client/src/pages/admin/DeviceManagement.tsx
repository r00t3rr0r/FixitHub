import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/useToast"
import {
  getBrands,
  getBrandById,
  getModelsByBrand,
  getModelById,
  createBrand,
  createModel,
  updateBrand,
  updateModel,
  Brand,
  Model
} from "@/api/brands"
import {
  getDeviceTypes,
  createDeviceType,
  updateDeviceType,
  getManufacturersByDeviceType,
  getModelsByTypeAndManufacturer,
  DeviceType,
  Manufacturer,
  DeviceModel
} from "@/api/devices"
import {
  Smartphone,
  Search,
  Plus,
  Edit,
  Eye,
  Trash2,
  Package,
  Users,
  Grid3x3,
  Filter,
  Download,
  Upload,
  BarChart3,
  TrendingUp,
  Activity,
  Info,
  HelpCircle,
  X
} from "lucide-react"
import { CSVImportDevicesDialog } from '@/components/admin/CSVImportDevicesDialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import "./DeviceManagement.css"

export function DeviceManagement() {
  const [showCSVImportDevicesDialog, setShowCSVImportDevicesDialog] = useState(false);
  const { t } = useTranslation()
  const [brands, setBrands] = useState<Brand[]>([])
  const [deviceTypes, setDeviceTypes] = useState<DeviceType[]>([])
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [models, setModels] = useState<DeviceModel[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedDeviceType, setSelectedDeviceType] = useState("all")
  const [selectedManufacturer, setSelectedManufacturer] = useState("all")
  const [activeTab, setActiveTab] = useState("dashboard")

  // Dashboard statistics
  const [stats, setStats] = useState({
    totalBrands: 0,
    totalModels: 0,
    totalDeviceTypes: 0,
    recentlyAdded: 0
  })

  // Dialog states
  const [showCreateBrand, setShowCreateBrand] = useState(false)
  const [showCreateModel, setShowCreateModel] = useState(false)
  const [showViewBrand, setShowViewBrand] = useState(false)
  const [showViewModel, setShowViewModel] = useState(false)
  const [showViewDeviceType, setShowViewDeviceType] = useState(false)
  const [showCreateDeviceType, setShowCreateDeviceType] = useState(false)
  const [showDeleteBrand, setShowDeleteBrand] = useState(false)
  const [showDeleteModel, setShowDeleteModel] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  // Edit mode states
  const [isEditMode, setIsEditMode] = useState(false)
  const [editingBrandId, setEditingBrandId] = useState<string | null>(null)
  const [editingModelId, setEditingModelId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Selected items
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null)
  const [selectedModel, setSelectedModel] = useState<DeviceModel | null>(null)
  const [selectedDeviceTypeDetails, setSelectedDeviceTypeDetails] = useState<DeviceType | null>(null)
  const [editingDeviceTypeId, setEditingDeviceTypeId] = useState<string | null>(null)

  // Form states
  const [brandForm, setBrandForm] = useState({
    name: '',
    logo: ''
  })

  const [deviceTypeForm, setDeviceTypeForm] = useState({
    name: '',
    key: ''
  })

  const [modelForm, setModelForm] = useState({
    name: '',
    brandId: '',
    deviceType: '',
    image: '',
    commonProblems: [] as string[],
    specifications: {} as Record<string, string>,
    // Comprehensive specification categories
    images: [] as Array<{ url: string; base64: string; caption: string }>,
    network: {
      technology2G: '', bands2G: '', technology3G: '', bands3G: '',
      technology4G: '', bands4G: '', technology5G: '', bands5G: '', speed: ''
    },
    physical: { dimensions: '', weight: '', build: '', simType: '', simCount: '' },
    display: { type: '', size: '', resolution: '', protection: '', features: '' },
    platform: { os: '', chipset: '', cpu: '', gpu: '' },
    memory: { internal: [] as Array<{ ram: string; storage: string }>, cardSlot: '' },
    rearCamera: { modules: '', features: '', video: '' },
    frontCamera: { modules: '', features: '', video: '' },
    audio: { loudspeaker: '', jack3_5mm: '' },
    connectivity: {
      wlan: '', bluetooth: '', positioning: '', nfc: '', radio: '', usb: '', infrared: '', other: ''
    },
    features: { sensors: '', special: [] as string[] },
    battery: { type: '', charging: '', standbyTime: '', talkTime: '', musicPlay: '' },
    other: {
      models: [] as string[],
      sarValues: { head: '', body: '' },
      price: '',
      releaseDate: '',
      colors: [] as string[]
    }
  })

  const [specTab, setSpecTab] = useState("basic")
  const [commonProblemInput, setCommonProblemInput] = useState("")
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([])
  const [bulkAction, setBulkAction] = useState<"appendProblems" | "replaceProblems" | "setReleaseDate" | "setPrice">("appendProblems")
  const [bulkValue, setBulkValue] = useState("")

  // Scroll position for single-page layout
  const [scrollToSection, setScrollToSection] = useState<string | null>(null)

  const { toast } = useToast()

  const toTypeKey = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')

  const refreshDeviceTypes = async () => {
    const deviceTypesResponse = await getDeviceTypes()
    const nextTypes = (deviceTypesResponse as any).deviceTypes || []
    setDeviceTypes(nextTypes)
    setStats((prev) => ({
      ...prev,
      totalDeviceTypes: nextTypes.length
    }))
    return nextTypes
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log('DeviceManagement: Fetching initial data...')
        const [brandsResponse, deviceTypesResponse] = await Promise.all([
          getBrands(),
          getDeviceTypes()
        ])

        setBrands(brandsResponse)
        const nextTypes = (deviceTypesResponse as any).deviceTypes || []
        setDeviceTypes(nextTypes)

        // Calculate statistics
        setStats({
          totalBrands: brandsResponse.length,
          totalModels: brandsResponse.reduce((sum: number, brand: any) => sum + (brand.modelCount || 0), 0),
          totalDeviceTypes: nextTypes.length,
          recentlyAdded: brandsResponse.filter((b: any) => {
            const createdAt = new Date(b.createdAt)
            const weekAgo = new Date()
            weekAgo.setDate(weekAgo.getDate() - 7)
            return createdAt > weekAgo
          }).length
        })

        console.log('DeviceManagement: Initial data loaded')
      } catch (error) {
        console.error('DeviceManagement: Error loading data:', error)
        toast({
          title: "Error",
          description: "Failed to load device data",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [toast])

  useEffect(() => {
    const fetchManufacturers = async () => {
      if (selectedDeviceType && selectedDeviceType !== "all") {
        try {
          console.log('DeviceManagement: Fetching manufacturers for device type:', selectedDeviceType)
          const response = await getManufacturersByDeviceType(selectedDeviceType)
          setManufacturers((response as any).manufacturers || [])
        } catch (error) {
          console.error('DeviceManagement: Error fetching manufacturers:', error)
          setManufacturers([])
        }
      } else {
        setManufacturers([])
      }
    }
    fetchManufacturers()
  }, [selectedDeviceType])

  useEffect(() => {
    const fetchModels = async () => {
      if (selectedDeviceType && selectedDeviceType !== "all" &&
          selectedManufacturer && selectedManufacturer !== "all") {
        try {
          console.log('DeviceManagement: Fetching models for type and manufacturer:', selectedDeviceType, selectedManufacturer)
          const response = await getModelsByTypeAndManufacturer(selectedDeviceType, selectedManufacturer)
          setModels((response as any).models || [])
        } catch (error) {
          console.error('DeviceManagement: Error fetching models:', error)
          setModels([])
        }
      } else {
        setModels([])
      }
    }
    fetchModels()
  }, [selectedDeviceType, selectedManufacturer])

  const handleViewBrand = async (brand: Brand) => {
    try {
      console.log('DeviceManagement: Viewing brand:', brand._id)
      const response = await getBrandById(brand._id)
      setSelectedBrand(response)
      setShowViewBrand(true)
    } catch (error) {
      console.error('DeviceManagement: Error viewing brand:', error)
      toast({
        title: "Error",
        description: "Failed to load brand details",
        variant: "destructive"
      })
    }
  }

  const handleViewDeviceType = async (deviceType: DeviceType) => {
    try {
      console.log('DeviceManagement: Viewing device type:', deviceType._id)
      setSelectedDeviceTypeDetails(deviceType)
      setSelectedDeviceType(deviceType._id)
      setShowViewDeviceType(true)
    } catch (error) {
      console.error('DeviceManagement: Error viewing device type:', error)
      toast({
        title: "Error",
        description: "Failed to load device type details",
        variant: "destructive"
      })
    }
  }

  const handleCreateDeviceType = () => {
    setIsEditMode(false)
    setEditingDeviceTypeId(null)
    setDeviceTypeForm({ name: '', key: '' })
    setShowCreateDeviceType(true)
  }

  const handleEditDeviceType = (deviceType: DeviceType) => {
    setIsEditMode(true)
    setEditingDeviceTypeId(deviceType._id)
    setDeviceTypeForm({
      name: deviceType.name,
      key: deviceType._id
    })
    setShowCreateDeviceType(true)
  }

  const handleSaveDeviceType = async () => {
    try {
      if (!deviceTypeForm.name.trim()) {
        toast({
          title: 'Error',
          description: 'Device category name is required',
          variant: 'destructive'
        })
        return
      }

      const normalizedKey = toTypeKey(deviceTypeForm.key || deviceTypeForm.name)
      if (!normalizedKey) {
        toast({
          title: 'Error',
          description: 'Please provide a valid category key',
          variant: 'destructive'
        })
        return
      }

      setIsSubmitting(true)
      if (isEditMode && editingDeviceTypeId) {
        await updateDeviceType(editingDeviceTypeId, {
          name: deviceTypeForm.name.trim(),
          key: normalizedKey
        })
      } else {
        await createDeviceType({
          name: deviceTypeForm.name.trim(),
          key: normalizedKey
        })
      }

      await refreshDeviceTypes()

      // Keep the current filter on renamed categories if possible.
      if (isEditMode && editingDeviceTypeId && selectedDeviceType === editingDeviceTypeId) {
        setSelectedDeviceType(normalizedKey)
      }

      setShowCreateDeviceType(false)
      setDeviceTypeForm({ name: '', key: '' })
      setEditingDeviceTypeId(null)
      setIsEditMode(false)

      toast({
        title: 'Success',
        description: isEditMode ? 'Device category updated successfully' : 'Device category created successfully'
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save device category',
        variant: 'destructive'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleViewModel = async (model: DeviceModel) => {
    try {
      console.log('DeviceManagement: Viewing model:', model._id)
      setSelectedModel(model)
      setShowViewModel(true)
    } catch (error) {
      console.error('DeviceManagement: Error viewing model:', error)
      toast({
        title: "Error",
        description: "Failed to load model details",
        variant: "destructive"
      })
    }
  }

  const handleCreateBrand = () => {
    setIsEditMode(false)
    setEditingBrandId(null)
    setBrandForm({ name: '', logo: '' })
    setShowCreateBrand(true)
  }

  const handleEditBrand = async (brand: Brand) => {
    try {
      console.log('DeviceManagement: Editing brand:', brand._id)
      setIsEditMode(true)
      setEditingBrandId(brand._id)
      setBrandForm({
        name: brand.name,
        logo: brand.logo || ''
      })
      setShowCreateBrand(true)
    } catch (error) {
      console.error('DeviceManagement: Error loading brand for edit:', error)
      toast({
        title: "Error",
        description: "Failed to load brand details",
        variant: "destructive"
      })
    }
  }

  const handleCreateModel = () => {
    setIsEditMode(false)
    setEditingModelId(null)
    setModelForm({
      name: '',
      brandId: '',
      deviceType: '',
      image: '',
      commonProblems: [],
      specifications: {},
      images: [],
      network: {
        technology2G: '', bands2G: '', technology3G: '', bands3G: '',
        technology4G: '', bands4G: '', technology5G: '', bands5G: '', speed: ''
      },
      physical: { dimensions: '', weight: '', build: '', simType: '', simCount: '' },
      display: { type: '', size: '', resolution: '', protection: '', features: '' },
      platform: { os: '', chipset: '', cpu: '', gpu: '' },
      memory: { internal: [], cardSlot: '' },
      rearCamera: { modules: '', features: '', video: '' },
      frontCamera: { modules: '', features: '', video: '' },
      audio: { loudspeaker: '', jack3_5mm: '' },
      connectivity: {
        wlan: '', bluetooth: '', positioning: '', nfc: '', radio: '', usb: '', infrared: '', other: ''
      },
      features: { sensors: '', special: [] },
      battery: { type: '', charging: '', standbyTime: '', talkTime: '', musicPlay: '' },
      other: {
        models: [],
        sarValues: { head: '', body: '' },
        price: '',
        releaseDate: '',
        colors: []
      }
    })
    setCommonProblemInput("")
    setSpecTab("basic")
    setShowCreateModel(true)
  }

  const handleEditModel = async (model: DeviceModel) => {
    try {
      console.log('DeviceManagement: Editing model:', model._id)
      setIsEditMode(true)
      setEditingModelId(model._id)

      // Load full model details
      const fullModel: any = model

      setModelForm({
        name: fullModel.name || '',
        brandId: fullModel.brand?._id || fullModel.brandId || '',
        deviceType: fullModel.deviceType || '',
        image: fullModel.image || '',
        commonProblems: fullModel.commonProblems || [],
        specifications: fullModel.specifications || {},
        images: fullModel.images || [],
        network: fullModel.network || {
          technology2G: '', bands2G: '', technology3G: '', bands3G: '',
          technology4G: '', bands4G: '', technology5G: '', bands5G: '', speed: ''
        },
        physical: fullModel.physical || { dimensions: '', weight: '', build: '', simType: '', simCount: '' },
        display: fullModel.display || { type: '', size: '', resolution: '', protection: '', features: '' },
        platform: fullModel.platform || { os: '', chipset: '', cpu: '', gpu: '' },
        memory: fullModel.memory || { internal: [], cardSlot: '' },
        rearCamera: fullModel.rearCamera || { modules: '', features: '', video: '' },
        frontCamera: fullModel.frontCamera || { modules: '', features: '', video: '' },
        audio: fullModel.audio || { loudspeaker: '', jack3_5mm: '' },
        connectivity: fullModel.connectivity || {
          wlan: '', bluetooth: '', positioning: '', nfc: '', radio: '', usb: '', infrared: '', other: ''
        },
        features: fullModel.features || { sensors: '', special: [] },
        battery: fullModel.battery || { type: '', charging: '', standbyTime: '', talkTime: '', musicPlay: '' },
        other: fullModel.other || {
          models: [],
          sarValues: { head: '', body: '' },
          price: '',
          releaseDate: '',
          colors: []
        }
      })

      setCommonProblemInput("")
      setShowCreateModel(true)
    } catch (error) {
      console.error('DeviceManagement: Error loading model for edit:', error)
      toast({
        title: "Error",
        description: "Failed to load model details",
        variant: "destructive"
      })
    }
  }

  const handleSaveBrand = async () => {
    try {
      if (!brandForm.name) {
        toast({
          title: "Error",
          description: "Brand name is required",
          variant: "destructive"
        })
        return
      }

      setIsSubmitting(true)

      if (isEditMode && editingBrandId) {
        console.log('DeviceManagement: Updating brand:', editingBrandId, brandForm)
        await updateBrand(editingBrandId, brandForm)
        console.log('DeviceManagement: Brand updated successfully')

        toast({
          title: "Success",
          description: "Brand updated successfully",
        })
      } else {
        console.log('DeviceManagement: Creating brand:', brandForm)
        const response = await createBrand(brandForm)
        console.log('DeviceManagement: Brand created, response:', response)

        toast({
          title: "Success",
          description: "Brand created successfully",
        })

        // Update statistics for new brand
        setStats(prev => ({
          ...prev,
          totalBrands: prev.totalBrands + 1,
          recentlyAdded: prev.recentlyAdded + 1
        }))
      }

      setShowCreateBrand(false)
      setBrandForm({ name: '', logo: '' })
      setIsEditMode(false)
      setEditingBrandId(null)

      // Refresh brands list
      const brandsResponse = await getBrands()
      setBrands(brandsResponse)

    } catch (error) {
      console.error('DeviceManagement: Error saving brand:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to save brand",
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSaveModel = async () => {
    try {
      if (!modelForm.name || !modelForm.brandId || !modelForm.deviceType) {
        toast({
          title: "Error",
          description: "Model name, brand, and device type are required",
          variant: "destructive"
        })
        return
      }

      setIsSubmitting(true)

      if (isEditMode && editingModelId) {
        console.log('DeviceManagement: Updating model:', editingModelId, modelForm)
        await updateModel(editingModelId, modelForm)
        console.log('DeviceManagement: Model updated successfully')

        toast({
          title: "Success",
          description: "Model updated successfully",
        })
      } else {
        console.log('DeviceManagement: Creating model:', modelForm)
        const response = await createModel(modelForm)
        console.log('DeviceManagement: Model created successfully, response:', response)

        toast({
          title: "Success",
          description: "Model created successfully",
        })

        // Update statistics for new model
        setStats(prev => ({
          ...prev,
          totalModels: prev.totalModels + 1
        }))
      }

      setShowCreateModel(false)
      setModelForm({
        name: '',
        brandId: '',
        deviceType: '',
        image: '',
        commonProblems: [],
        specifications: {},
        images: [],
        network: {
          technology2G: '', bands2G: '', technology3G: '', bands3G: '',
          technology4G: '', bands4G: '', technology5G: '', bands5G: '', speed: ''
        },
        physical: { dimensions: '', weight: '', build: '', simType: '', simCount: '' },
        display: { type: '', size: '', resolution: '', protection: '', features: '' },
        platform: { os: '', chipset: '', cpu: '', gpu: '' },
        memory: { internal: [], cardSlot: '' },
        rearCamera: { modules: '', features: '', video: '' },
        frontCamera: { modules: '', features: '', video: '' },
        audio: { loudspeaker: '', jack3_5mm: '' },
        connectivity: {
          wlan: '', bluetooth: '', positioning: '', nfc: '', radio: '', usb: '', infrared: '', other: ''
        },
        features: { sensors: '', special: [] },
        battery: { type: '', charging: '', standbyTime: '', talkTime: '', musicPlay: '' },
        other: {
          models: [],
          sarValues: { head: '', body: '' },
          price: '',
          releaseDate: '',
          colors: []
        },
        modelNumbers: []
      })
      setCommonProblemInput("")
      setIsEditMode(false)
      setEditingModelId(null)

      // Refresh models list if filters are active
      if (selectedDeviceType !== "all" && selectedManufacturer !== "all") {
        const response = await getModelsByTypeAndManufacturer(selectedDeviceType, selectedManufacturer)
        setModels((response as any).models || [])
      }

    } catch (error) {
      console.error('DeviceManagement: Error saving model:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to save model",
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Filter functions
  const filteredBrands = brands.filter(brand =>
    brand.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredModels = models.filter(model =>
    model.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const allFilteredSelected = filteredModels.length > 0 && filteredModels.every((model) => selectedModelIds.includes(model._id))

  const parseProblems = (value: string) =>
    value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

  const addCommonProblemToForm = () => {
    const next = commonProblemInput.trim()
    if (!next) {
      return
    }
    if (modelForm.commonProblems.includes(next)) {
      setCommonProblemInput("")
      return
    }

    setModelForm((prev) => ({
      ...prev,
      commonProblems: [...prev.commonProblems, next]
    }))
    setCommonProblemInput("")
  }

  const removeCommonProblemFromForm = (problem: string) => {
    setModelForm((prev) => ({
      ...prev,
      commonProblems: prev.commonProblems.filter((item) => item !== problem)
    }))
  }

  const toggleModelSelection = (id: string, checked: boolean) => {
    setSelectedModelIds((prev) => {
      if (checked) {
        return prev.includes(id) ? prev : [...prev, id]
      }
      return prev.filter((item) => item !== id)
    })
  }

  const toggleSelectAllFilteredModels = (checked: boolean) => {
    if (checked) {
      setSelectedModelIds(filteredModels.map((model) => model._id))
      return
    }
    setSelectedModelIds([])
  }

  const handleBulkApply = async () => {
    if (selectedModelIds.length === 0) {
      toast({
        title: "Keine Modelle ausgewählt",
        description: "Bitte wähle mindestens ein Modell aus.",
        variant: "destructive"
      })
      return
    }

    if (!bulkValue.trim()) {
      toast({
        title: "Wert fehlt",
        description: "Bitte trage einen Wert für die Bulk-Änderung ein.",
        variant: "destructive"
      })
      return
    }

    if (selectedDeviceType === "all" || selectedManufacturer === "all") {
      toast({
        title: "Filter erforderlich",
        description: "Bitte zuerst Gerätetyp und Hersteller auswählen.",
        variant: "destructive"
      })
      return
    }

    setIsSubmitting(true)
    try {
      const selectedModels = filteredModels.filter((model) => selectedModelIds.includes(model._id))

      await Promise.all(
        selectedModels.map(async (model) => {
          if (bulkAction === "appendProblems") {
            const merged = Array.from(new Set([...(model.commonProblems || []), ...parseProblems(bulkValue)]))
            await updateModel(model._id, { commonProblems: merged })
            return
          }

          if (bulkAction === "replaceProblems") {
            await updateModel(model._id, { commonProblems: parseProblems(bulkValue) })
            return
          }

          if (bulkAction === "setReleaseDate") {
            await updateModel(model._id, {
              other: {
                ...(model.other || {}),
                releaseDate: bulkValue.trim()
              }
            })
            return
          }

          await updateModel(model._id, {
            other: {
              ...(model.other || {}),
              price: bulkValue.trim()
            }
          })
        })
      )

      const response = await getModelsByTypeAndManufacturer(selectedDeviceType, selectedManufacturer)
      setModels((response as any).models || [])
      setSelectedModelIds([])
      setBulkValue("")

      toast({
        title: "Bulk-Änderung gespeichert",
        description: `${selectedModels.length} Modelle wurden aktualisiert.`
      })
    } catch (error) {
      toast({
        title: "Bulk-Änderung fehlgeschlagen",
        description: error.message || "Die Bulk-Änderung konnte nicht gespeichert werden.",
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Activity className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading device data...</p>
        </div>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="device-mgmt-page space-y-6 p-4 md:p-6">
        {/* Header Section */}
        <div className="device-mgmt-hero flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="device-mgmt-title text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              <Smartphone className="h-8 w-8" />
              Device Management
            </h1>
            <p className="device-mgmt-subtitle mt-1">
              Modelle, Spezifikationen und Haeufige Probleme zentral verwalten
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={() => setShowHelp(true)}>
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Help & Documentation</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Export</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Export device data to CSV</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" className="gap-2" onClick={() => setShowCSVImportDevicesDialog(true)}>
                  <Upload className="h-4 w-4" />
                  <span className="hidden sm:inline">Import</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Import devices from CSV</p>
              </TooltipContent>
            </Tooltip>
                <CSVImportDevicesDialog
                  open={showCSVImportDevicesDialog}
                  onOpenChange={setShowCSVImportDevicesDialog}
                  onImportSuccess={async () => {
                    // Nach Import: Modelle neu laden
                    if (selectedDeviceType !== "all" && selectedManufacturer !== "all") {
                      const response = await getModelsByTypeAndManufacturer(selectedDeviceType, selectedManufacturer)
                      setModels((response as any).models || [])
                    }
                  }}
                />
          </div>
        </div>

        {/* Dashboard Overview */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="device-mgmt-tabs grid w-full grid-cols-2 md:grid-cols-4">
            <TabsTrigger value="dashboard">
              <BarChart3 className="h-4 w-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="brands">
              <Users className="h-4 w-4 mr-2" />
              Brands
            </TabsTrigger>
            <TabsTrigger value="types">
              <Grid3x3 className="h-4 w-4 mr-2" />
              Device Types
            </TabsTrigger>
            <TabsTrigger value="models">
              <Package className="h-4 w-4 mr-2" />
              Models
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Brands
                  </CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalBrands}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Active device manufacturers
                  </p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Models
                  </CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalModels}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Device models in database
                  </p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Device Types
                  </CardTitle>
                  <Grid3x3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalDeviceTypes}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Categories available
                  </p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Recently Added
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.recentlyAdded}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Added this week
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>
                  Common tasks to manage your device database
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Button onClick={handleCreateBrand} className="h-auto flex-col items-start p-4 gap-2">
                  <Plus className="h-5 w-5" />
                  <div className="text-left">
                    <div className="font-semibold">Add New Brand</div>
                    <div className="text-xs font-normal opacity-80">
                      Create a new device manufacturer
                    </div>
                  </div>
                </Button>

                <Button onClick={handleCreateModel} variant="outline" className="h-auto flex-col items-start p-4 gap-2">
                  <Plus className="h-5 w-5" />
                  <div className="text-left">
                    <div className="font-semibold">Add New Model</div>
                    <div className="text-xs font-normal opacity-80">
                      Create a new device model
                    </div>
                  </div>
                </Button>

                <Button variant="outline" className="h-auto flex-col items-start p-4 gap-2">
                  <Filter className="h-5 w-5" />
                  <div className="text-left">
                    <div className="font-semibold">Advanced Search</div>
                    <div className="text-xs font-normal opacity-80">
                      Find specific devices quickly
                    </div>
                  </div>
                </Button>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>
                  Latest additions to your device database
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {brands.slice(0, 5).map((brand: any) => (
                    <div key={brand._id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors">
                      <div className="flex items-center gap-3">
                        {brand.logo ? (
                          <img src={brand.logo} alt={brand.name} className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Users className="h-5 w-5 text-primary" />
                          </div>
                        )}
                        <div>
                          <div className="font-medium">{brand.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {brand.modelCount || 0} models
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleViewBrand(brand)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Brands Tab */}
          <TabsContent value="brands" className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search brands..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button onClick={handleCreateBrand} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Brand
              </Button>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Logo</TableHead>
                    <TableHead>Brand Name</TableHead>
                    <TableHead>Models Count</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBrands.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No brands found. Click "Add Brand" to create your first brand.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredBrands.map((brand: any) => (
                      <TableRow key={brand._id} className="hover:bg-accent/50 transition-colors">
                        <TableCell>
                          {brand.logo ? (
                            <img src={brand.logo} alt={brand.name} className="w-10 h-10 rounded-full object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <Users className="h-5 w-5 text-primary" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{brand.name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{brand.modelCount || 0}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={brand.isActive ? "default" : "secondary"}>
                            {brand.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleViewBrand(brand)}
                                  className="hover:bg-blue-100 dark:hover:bg-blue-900 rounded"
                                  title="View brand details"
                                >
                                  <Eye className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>View Details</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEditBrand(brand)}
                                  className="hover:bg-green-100 dark:hover:bg-green-900 rounded"
                                  title="Edit brand"
                                >
                                  <Edit className="h-5 w-5 text-green-600 dark:text-green-400" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit Brand</TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Device Types Tab */}
          <TabsContent value="types" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Device Categories</CardTitle>
                  <CardDescription>
                    Kategorien anlegen, bearbeiten und anschließend bei Modellen verwenden
                  </CardDescription>
                </div>
                <Button onClick={handleCreateDeviceType} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Category
                </Button>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {deviceTypes.map((type: any) => (
                    <Card
                      key={type._id}
                      className="cursor-pointer hover:shadow-lg transition-all hover:scale-105"
                      onClick={() => handleViewDeviceType(type)}
                    >
                      <CardHeader>
                        <div className="flex items-center justify-between gap-2">
                          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Smartphone className="h-6 w-6 text-primary" />
                          </div>
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <Badge variant="secondary">{type.count || 0}</Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:bg-green-100 dark:hover:bg-green-900"
                              onClick={() => handleEditDeviceType(type)}
                              title="Edit category"
                            >
                              <Edit className="h-4 w-4 text-green-600 dark:text-green-400" />
                            </Button>
                          </div>
                        </div>
                        <CardTitle className="mt-4 capitalize">{type.name}</CardTitle>
                        <CardDescription>
                          {type.count || 0} models available
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Models Tab */}
          <TabsContent value="models" className="space-y-4">
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search models..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button onClick={handleCreateModel} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Model
                </Button>
              </div>

              <Card className="device-mgmt-bulk-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Bulk Changes</CardTitle>
                  <CardDescription>
                    Mehrere Modelle gleichzeitig aktualisieren
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <Label htmlFor="bulkAction" className="mb-2 block">Aktion</Label>
                      <Select value={bulkAction} onValueChange={(value: any) => setBulkAction(value)}>
                        <SelectTrigger id="bulkAction">
                          <SelectValue placeholder="Bulk Aktion waehlen" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="appendProblems">Probleme anhaengen</SelectItem>
                          <SelectItem value="replaceProblems">Probleme ersetzen</SelectItem>
                          <SelectItem value="setReleaseDate">Release Date setzen</SelectItem>
                          <SelectItem value="setPrice">Preis setzen</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="bulkValue" className="mb-2 block">
                        {bulkAction === "appendProblems" || bulkAction === "replaceProblems"
                          ? "Wert (eine Zeile = ein Problem)"
                          : "Wert"}
                      </Label>
                      <Textarea
                        id="bulkValue"
                        value={bulkValue}
                        onChange={(e) => setBulkValue(e.target.value)}
                        placeholder={bulkAction === "appendProblems" || bulkAction === "replaceProblems"
                          ? "Display bleibt schwarz\nKein Laden moeglich"
                          : "Neuen Wert eintragen"}
                        className="min-h-[96px]"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="selectAllModels"
                        checked={allFilteredSelected}
                        onCheckedChange={(checked) => toggleSelectAllFilteredModels(checked === true)}
                      />
                      <Label htmlFor="selectAllModels" className="text-sm cursor-pointer">
                        Alle gefilterten Modelle waehlen ({selectedModelIds.length} gewaehlt)
                      </Label>
                    </div>
                    <Button onClick={handleBulkApply} disabled={isSubmitting || selectedModelIds.length === 0}>
                      Bulk anwenden
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="deviceType" className="mb-2 block">Device Type</Label>
                  <Select value={selectedDeviceType} onValueChange={setSelectedDeviceType}>
                    <SelectTrigger id="deviceType">
                      <SelectValue placeholder="Select device type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      {deviceTypes.map((type: any) => (
                        <SelectItem key={type._id} value={type._id} className="capitalize">
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="manufacturer" className="mb-2 block">Manufacturer</Label>
                  <Select
                    value={selectedManufacturer}
                    onValueChange={setSelectedManufacturer}
                    disabled={selectedDeviceType === "all"}
                  >
                    <SelectTrigger id="manufacturer">
                      <SelectValue placeholder="Select manufacturer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Manufacturers</SelectItem>
                      {manufacturers.map((manufacturer: any) => (
                        <SelectItem key={manufacturer._id} value={manufacturer._id}>
                          {manufacturer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {selectedDeviceType === "all" || selectedManufacturer === "all" ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Filter className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Select Filters</h3>
                  <p className="text-muted-foreground text-center max-w-md">
                    Please select both a device type and manufacturer to view available models
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredModels.length === 0 ? (
                  <Card className="md:col-span-2 lg:col-span-3 border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <Package className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No Models Found</h3>
                      <p className="text-muted-foreground text-center max-w-md mb-4">
                        No models found for the selected filters. Try different criteria or add a new model.
                      </p>
                      <Button onClick={handleCreateModel} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Add New Model
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  filteredModels.map((model: any) => (
                    <Card
                      key={model._id}
                      className="cursor-pointer hover:shadow-lg transition-all"
                      onClick={() => handleViewModel(model)}
                    >
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={selectedModelIds.includes(model._id)}
                              onCheckedChange={(checked) => toggleModelSelection(model._id, checked === true)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span className="text-xs text-muted-foreground">Auswaehlen</span>
                          </div>
                          {(model.commonProblems?.length || 0) > 0 && (
                            <Badge variant="outline">{model.commonProblems.length} Probleme</Badge>
                          )}
                        </div>
                        {model.image ? (
                          <img src={model.image} alt={model.name} className="w-full h-40 object-cover rounded-lg mb-4" />
                        ) : (
                          <div className="w-full h-40 bg-gradient-to-br from-primary/20 to-primary/5 rounded-lg mb-4 flex items-center justify-center">
                            <Smartphone className="h-16 w-16 text-primary/40" />
                          </div>
                        )}
                        <CardTitle className="line-clamp-1">{model.name}</CardTitle>
                        <CardDescription className="capitalize">
                          {brands.find(b => b._id === (model.brandId?._id || model.brandId))?.name || 'Unknown Brand'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary" className="capitalize">
                            {model.deviceType}
                          </Badge>
                          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewModel(model)}
                              className="hover:bg-blue-100 dark:hover:bg-blue-900 rounded p-2"
                              title="View model details"
                            >
                              <Eye className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditModel(model)}
                              className="hover:bg-green-100 dark:hover:bg-green-900 rounded p-2"
                              title="Edit model"
                            >
                              <Edit className="h-5 w-5 text-green-600 dark:text-green-400" />
                            </Button>
                          </div>
                        </div>
                        {(model.commonProblems?.length || 0) > 0 && (
                          <div className="mt-3 space-y-1">
                            <p className="text-xs font-semibold text-[#1a2a5e]">HAEUFIGE PROBLEME</p>
                            <ul className="text-xs text-muted-foreground space-y-1">
                              {model.commonProblems.slice(0, 2).map((problem: string) => (
                                <li key={problem} className="truncate">• {problem}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Create/Edit Brand Dialog */}
        <Dialog open={showCreateBrand} onOpenChange={setShowCreateBrand}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{isEditMode ? 'Edit Brand' : 'Add New Brand'}</DialogTitle>
              <DialogDescription>
                {isEditMode ? 'Update device manufacturer/brand information' : 'Create a new device manufacturer/brand'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="brandName">Brand Name *</Label>
                <Input
                  id="brandName"
                  value={brandForm.name}
                  onChange={(e) => setBrandForm({ ...brandForm, name: e.target.value })}
                  placeholder="e.g., Apple, Samsung, Google"
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <Label htmlFor="brandLogo">Logo URL</Label>
                <Input
                  id="brandLogo"
                  value={brandForm.logo}
                  onChange={(e) => setBrandForm({ ...brandForm, logo: e.target.value })}
                  placeholder="https://example.com/logo.png"
                  disabled={isSubmitting}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateBrand(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button onClick={handleSaveBrand} disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : (isEditMode ? 'Update Brand' : 'Save Brand')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create/Edit Model Dialog - Single Page Layout */}
        <Dialog open={showCreateModel} onOpenChange={setShowCreateModel}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{isEditMode ? 'Edit Device Model' : 'Add New Device Model'}</DialogTitle>
              <DialogDescription>
                {isEditMode ? 'Update device model information and specifications' : 'Create a new device model with comprehensive specifications'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">

              {/* Basic Information Section */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4 shadow-sm">
                <h3 className="text-lg font-semibold pb-2 border-b border-gray-200 flex items-center gap-2 text-[#1a2a5e]">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  Basic Information
                </h3>
                <div>
                  <Label htmlFor="modelName">Model Name *</Label>
                  <Input
                    id="modelName"
                    value={modelForm.name}
                    onChange={(e) => setModelForm({ ...modelForm, name: e.target.value })}
                    placeholder="e.g., iPhone 15 Pro"
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <Label htmlFor="modelNumbers">Model Numbers</Label>
                  <Input
                    id="modelNumbers"
                    value={modelForm.modelNumbers ? modelForm.modelNumbers.join(', ') : ''}
                    onChange={e => setModelForm({ ...modelForm, modelNumbers: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                    placeholder="e.g., A3102, A3104, SM-X200"
                    disabled={isSubmitting}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Mehrere Modellnummern mit Komma trennen.</p>
                </div>
                <div>
                  <Label htmlFor="modelBrand">Brand *</Label>
                  <Select value={modelForm.brandId} onValueChange={(value) => setModelForm({ ...modelForm, brandId: value })} disabled={isSubmitting}>
                    <SelectTrigger id="modelBrand">
                      <SelectValue placeholder="Select brand" />
                    </SelectTrigger>
                    <SelectContent>
                      {brands.map((brand: any) => (
                        <SelectItem key={brand._id} value={brand._id}>
                          {brand.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="modelDeviceType">Device Type *</Label>
                  <Select value={modelForm.deviceType} onValueChange={(value) => setModelForm({ ...modelForm, deviceType: value })} disabled={isSubmitting}>
                    <SelectTrigger id="modelDeviceType">
                      <SelectValue placeholder="Select device type" />
                    </SelectTrigger>
                    <SelectContent>
                      {deviceTypes.map((type: any) => (
                        <SelectItem key={type._id} value={type._id} className="capitalize">
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="modelImage">Main Image URL</Label>
                  <Input
                    id="modelImage"
                    value={modelForm.image}
                    onChange={(e) => setModelForm({ ...modelForm, image: e.target.value })}
                    placeholder="https://example.com/device.png"
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <Label htmlFor="commonProblemInput">HAEUFIGE PROBLEME</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      id="commonProblemInput"
                      value={commonProblemInput}
                      onChange={(e) => setCommonProblemInput(e.target.value)}
                      placeholder="z.B. Displaybruch, Akku entlaedt schnell"
                      disabled={isSubmitting}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          addCommonProblemToForm()
                        }
                      }}
                    />
                    <Button type="button" variant="outline" onClick={addCommonProblemToForm} disabled={isSubmitting}>
                      Hinzufuegen
                    </Button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {modelForm.commonProblems.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Noch keine haeufigen Probleme erfasst.</p>
                    ) : (
                      modelForm.commonProblems.map((problem) => (
                        <Badge key={problem} variant="secondary" className="flex items-center gap-1">
                          <span>{problem}</span>
                          <button
                            type="button"
                            aria-label={`Problem ${problem} entfernen`}
                            className="inline-flex"
                            onClick={() => removeCommonProblemFromForm(problem)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </Badge>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Network Specifications Section */}
              <div className="bg-purple-50 dark:bg-purple-950/20 border-2 border-purple-200 dark:border-purple-800 rounded-lg p-6 space-y-4">
                <h3 className="text-lg font-semibold pb-2 border-b-2 border-purple-300 dark:border-purple-700 flex items-center gap-2">
                  <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                  Network & Connectivity
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="tech2G">2G Technology</Label>
                    <Input
                      id="tech2G"
                      value={modelForm.network.technology2G}
                      onChange={(e) => setModelForm({ ...modelForm, network: { ...modelForm.network, technology2G: e.target.value } })}
                      placeholder="e.g., GSM 850 / 900 / 1800 / 1900"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div>
                    <Label htmlFor="bands2G">2G Bands</Label>
                    <Input
                      id="bands2G"
                      value={modelForm.network.bands2G}
                      onChange={(e) => setModelForm({ ...modelForm, network: { ...modelForm.network, bands2G: e.target.value } })}
                      placeholder="e.g., GSM bands"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div>
                    <Label htmlFor="tech3G">3G Technology</Label>
                    <Input
                      id="tech3G"
                      value={modelForm.network.technology3G}
                      onChange={(e) => setModelForm({ ...modelForm, network: { ...modelForm.network, technology3G: e.target.value } })}
                      placeholder="e.g., HSDPA 850 / 900 / 1700(AWS) / 1900 / 2100"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div>
                    <Label htmlFor="bands3G">3G Bands</Label>
                    <Input
                      id="bands3G"
                      value={modelForm.network.bands3G}
                      onChange={(e) => setModelForm({ ...modelForm, network: { ...modelForm.network, bands3G: e.target.value } })}
                      placeholder="e.g., HSDPA bands"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div>
                    <Label htmlFor="tech4G">4G Technology</Label>
                    <Input
                      id="tech4G"
                      value={modelForm.network.technology4G}
                      onChange={(e) => setModelForm({ ...modelForm, network: { ...modelForm.network, technology4G: e.target.value } })}
                      placeholder="e.g., LTE"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div>
                    <Label htmlFor="bands4G">4G Bands</Label>
                    <Input
                      id="bands4G"
                      value={modelForm.network.bands4G}
                      onChange={(e) => setModelForm({ ...modelForm, network: { ...modelForm.network, bands4G: e.target.value } })}
                      placeholder="e.g., LTE bands"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div>
                    <Label htmlFor="tech5G">5G Technology</Label>
                    <Input
                      id="tech5G"
                      value={modelForm.network.technology5G}
                      onChange={(e) => setModelForm({ ...modelForm, network: { ...modelForm.network, technology5G: e.target.value } })}
                      placeholder="e.g., 5G NR"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div>
                    <Label htmlFor="bands5G">5G Bands</Label>
                    <Input
                      id="bands5G"
                      value={modelForm.network.bands5G}
                      onChange={(e) => setModelForm({ ...modelForm, network: { ...modelForm.network, bands5G: e.target.value } })}
                      placeholder="e.g., 5G bands"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="speed">Network Speed</Label>
                    <Input
                      id="speed"
                      value={modelForm.network.speed}
                      onChange={(e) => setModelForm({ ...modelForm, network: { ...modelForm.network, speed: e.target.value } })}
                      placeholder="e.g., HSPA, LTE-A"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              </div>

              {/* Physical Characteristics Section */}
              <div className="bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-200 dark:border-amber-800 rounded-lg p-6 space-y-4">
                <h3 className="text-lg font-semibold pb-2 border-b-2 border-amber-300 dark:border-amber-700 flex items-center gap-2">
                  <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                  Physical Characteristics
                </h3>
                <div>
                  <Label htmlFor="dimensions">Dimensions</Label>
                  <Input
                    id="dimensions"
                    value={modelForm.physical.dimensions}
                    onChange={(e) => setModelForm({ ...modelForm, physical: { ...modelForm.physical, dimensions: e.target.value } })}
                    placeholder="e.g., 146.7 x 71.5 x 7.8 mm"
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <Label htmlFor="weight">Weight</Label>
                  <Input
                    id="weight"
                    value={modelForm.physical.weight}
                    onChange={(e) => setModelForm({ ...modelForm, physical: { ...modelForm.physical, weight: e.target.value } })}
                    placeholder="e.g., 174 g"
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <Label htmlFor="build">Build</Label>
                  <Input
                    id="build"
                    value={modelForm.physical.build}
                    onChange={(e) => setModelForm({ ...modelForm, physical: { ...modelForm.physical, build: e.target.value } })}
                    placeholder="e.g., Glass front (Gorilla Glass), glass back, aluminum frame"
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <Label htmlFor="simType">SIM Type</Label>
                  <Input
                    id="simType"
                    value={modelForm.physical.simType}
                    onChange={(e) => setModelForm({ ...modelForm, physical: { ...modelForm.physical, simType: e.target.value } })}
                    placeholder="e.g., Nano-SIM, eSIM"
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <Label htmlFor="simCount">SIM Count</Label>
                  <Input
                    id="simCount"
                    value={modelForm.physical.simCount}
                    onChange={(e) => setModelForm({ ...modelForm, physical: { ...modelForm.physical, simCount: e.target.value } })}
                    placeholder="e.g., Single SIM or Dual SIM"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* Display Specifications Section */}
              <div className="bg-cyan-50 dark:bg-cyan-950/20 border-2 border-cyan-200 dark:border-cyan-800 rounded-lg p-6 space-y-4">
                <h3 className="text-lg font-semibold pb-2 border-b-2 border-cyan-300 dark:border-cyan-700 flex items-center gap-2">
                  <div className="w-3 h-3 bg-cyan-500 rounded-full"></div>
                  Display Specifications
                </h3>
                <div>
                  <Label htmlFor="displayType">Display Type</Label>
                  <Input
                    id="displayType"
                    value={modelForm.display.type}
                    onChange={(e) => setModelForm({ ...modelForm, display: { ...modelForm.display, type: e.target.value } })}
                    placeholder="e.g., LTPO Super Retina XDR OLED"
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <Label htmlFor="displaySize">Display Size</Label>
                  <Input
                    id="displaySize"
                    value={modelForm.display.size}
                    onChange={(e) => setModelForm({ ...modelForm, display: { ...modelForm.display, size: e.target.value } })}
                    placeholder="e.g., 6.1 inches"
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <Label htmlFor="resolution">Resolution</Label>
                  <Input
                    id="resolution"
                    value={modelForm.display.resolution}
                    onChange={(e) => setModelForm({ ...modelForm, display: { ...modelForm.display, resolution: e.target.value } })}
                    placeholder="e.g., 1179 x 2556 pixels"
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <Label htmlFor="protection">Display Protection</Label>
                  <Input
                    id="protection"
                    value={modelForm.display.protection}
                    onChange={(e) => setModelForm({ ...modelForm, display: { ...modelForm.display, protection: e.target.value } })}
                    placeholder="e.g., Ceramic Shield glass"
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <Label htmlFor="displayFeatures">Display Features</Label>
                  <Textarea
                    id="displayFeatures"
                    value={modelForm.display.features}
                    onChange={(e) => setModelForm({ ...modelForm, display: { ...modelForm.display, features: e.target.value } })}
                    placeholder="e.g., 120Hz, HDR10, Dolby Vision"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* Platform & Performance Section */}
              <div className="bg-indigo-50 dark:bg-indigo-950/20 border-2 border-indigo-200 dark:border-indigo-800 rounded-lg p-6 space-y-4">
                <h3 className="text-lg font-semibold pb-2 border-b-2 border-indigo-300 dark:border-indigo-700 flex items-center gap-2">
                  <div className="w-3 h-3 bg-indigo-500 rounded-full"></div>
                  Platform & Performance
                </h3>
                <div>
                  <Label htmlFor="os">Operating System</Label>
                  <Input
                    id="os"
                    value={modelForm.platform.os}
                    onChange={(e) => setModelForm({ ...modelForm, platform: { ...modelForm.platform, os: e.target.value } })}
                    placeholder="e.g., iOS 17"
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <Label htmlFor="chipset">Chipset</Label>
                  <Input
                    id="chipset"
                    value={modelForm.platform.chipset}
                    onChange={(e) => setModelForm({ ...modelForm, platform: { ...modelForm.platform, chipset: e.target.value } })}
                    placeholder="e.g., Apple A17 Pro (3 nm)"
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <Label htmlFor="cpu">CPU</Label>
                  <Input
                    id="cpu"
                    value={modelForm.platform.cpu}
                    onChange={(e) => setModelForm({ ...modelForm, platform: { ...modelForm.platform, cpu: e.target.value } })}
                    placeholder="e.g., Hexa-core"
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <Label htmlFor="gpu">GPU</Label>
                  <Input
                    id="gpu"
                    value={modelForm.platform.gpu}
                    onChange={(e) => setModelForm({ ...modelForm, platform: { ...modelForm.platform, gpu: e.target.value } })}
                    placeholder="e.g., Apple GPU (6-core graphics)"
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <Label htmlFor="cardSlot">Card Slot</Label>
                  <Input
                    id="cardSlot"
                    value={modelForm.memory.cardSlot}
                    onChange={(e) => setModelForm({ ...modelForm, memory: { ...modelForm.memory, cardSlot: e.target.value } })}
                    placeholder="e.g., No or microSDXC"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* Camera Section */}
              <div className="bg-rose-50 dark:bg-rose-950/20 border-2 border-rose-200 dark:border-rose-800 rounded-lg p-6 space-y-4">
                <h3 className="text-lg font-semibold pb-2 border-b-2 border-rose-300 dark:border-rose-700 flex items-center gap-2">
                  <div className="w-3 h-3 bg-rose-500 rounded-full"></div>
                  Camera System
                </h3>
                <div>
                  <h4 className="font-semibold mb-2">Rear Camera</h4>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="rearModules">Camera Modules</Label>
                      <Textarea
                        id="rearModules"
                        value={modelForm.rearCamera.modules}
                        onChange={(e) => setModelForm({ ...modelForm, rearCamera: { ...modelForm.rearCamera, modules: e.target.value } })}
                        placeholder="e.g., 48 MP (wide), 12 MP (telephoto), 12 MP (ultrawide)"
                        disabled={isSubmitting}
                      />
                    </div>
                    <div>
                      <Label htmlFor="rearFeatures">Camera Features</Label>
                      <Textarea
                        id="rearFeatures"
                        value={modelForm.rearCamera.features}
                        onChange={(e) => setModelForm({ ...modelForm, rearCamera: { ...modelForm.rearCamera, features: e.target.value } })}
                        placeholder="e.g., Dual-LED dual-tone flash, HDR, panorama"
                        disabled={isSubmitting}
                      />
                    </div>
                    <div>
                      <Label htmlFor="rearVideo">Video Recording</Label>
                      <Input
                        id="rearVideo"
                        value={modelForm.rearCamera.video}
                        onChange={(e) => setModelForm({ ...modelForm, rearCamera: { ...modelForm.rearCamera, video: e.target.value } })}
                        placeholder="e.g., 4K@24/30/60fps, 1080p@30/60/120/240fps"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Front Camera</h4>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="frontModules">Camera Modules</Label>
                      <Input
                        id="frontModules"
                        value={modelForm.frontCamera.modules}
                        onChange={(e) => setModelForm({ ...modelForm, frontCamera: { ...modelForm.frontCamera, modules: e.target.value } })}
                        placeholder="e.g., 12 MP (wide)"
                        disabled={isSubmitting}
                      />
                    </div>
                    <div>
                      <Label htmlFor="frontFeatures">Camera Features</Label>
                      <Input
                        id="frontFeatures"
                        value={modelForm.frontCamera.features}
                        onChange={(e) => setModelForm({ ...modelForm, frontCamera: { ...modelForm.frontCamera, features: e.target.value } })}
                        placeholder="e.g., HDR, Dolby Vision HDR"
                        disabled={isSubmitting}
                      />
                    </div>
                    <div>
                      <Label htmlFor="frontVideo">Video Recording</Label>
                      <Input
                        id="frontVideo"
                        value={modelForm.frontCamera.video}
                        onChange={(e) => setModelForm({ ...modelForm, frontCamera: { ...modelForm.frontCamera, video: e.target.value } })}
                        placeholder="e.g., 4K@24/25/30/60fps"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Other Features Section */}
              <div className="bg-emerald-50 dark:bg-emerald-950/20 border-2 border-emerald-200 dark:border-emerald-800 rounded-lg p-6 space-y-4">
                <h3 className="text-lg font-semibold pb-2 border-b-2 border-emerald-300 dark:border-emerald-700 flex items-center gap-2">
                  <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                  Additional Features & Information
                </h3>
                <div>
                  <h4 className="font-semibold mb-2">Audio</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="loudspeaker">Loudspeaker</Label>
                      <Input
                        id="loudspeaker"
                        value={modelForm.audio.loudspeaker}
                        onChange={(e) => setModelForm({ ...modelForm, audio: { ...modelForm.audio, loudspeaker: e.target.value } })}
                        placeholder="e.g., Yes, with stereo speakers"
                        disabled={isSubmitting}
                      />
                    </div>
                    <div>
                      <Label htmlFor="jack">3.5mm Jack</Label>
                      <Input
                        id="jack"
                        value={modelForm.audio.jack3_5mm}
                        onChange={(e) => setModelForm({ ...modelForm, audio: { ...modelForm.audio, jack3_5mm: e.target.value } })}
                        placeholder="e.g., No or Yes"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Connectivity</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="wlan">WLAN</Label>
                      <Input
                        id="wlan"
                        value={modelForm.connectivity.wlan}
                        onChange={(e) => setModelForm({ ...modelForm, connectivity: { ...modelForm.connectivity, wlan: e.target.value } })}
                        placeholder="e.g., Wi-Fi 6E"
                        disabled={isSubmitting}
                      />
                    </div>
                    <div>
                      <Label htmlFor="bluetooth">Bluetooth</Label>
                      <Input
                        id="bluetooth"
                        value={modelForm.connectivity.bluetooth}
                        onChange={(e) => setModelForm({ ...modelForm, connectivity: { ...modelForm.connectivity, bluetooth: e.target.value } })}
                        placeholder="e.g., 5.3, A2DP, LE"
                        disabled={isSubmitting}
                      />
                    </div>
                    <div>
                      <Label htmlFor="nfc">NFC</Label>
                      <Input
                        id="nfc"
                        value={modelForm.connectivity.nfc}
                        onChange={(e) => setModelForm({ ...modelForm, connectivity: { ...modelForm.connectivity, nfc: e.target.value } })}
                        placeholder="e.g., Yes or No"
                        disabled={isSubmitting}
                      />
                    </div>
                    <div>
                      <Label htmlFor="usb">USB</Label>
                      <Input
                        id="usb"
                        value={modelForm.connectivity.usb}
                        onChange={(e) => setModelForm({ ...modelForm, connectivity: { ...modelForm.connectivity, usb: e.target.value } })}
                        placeholder="e.g., USB Type-C 3.2"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Battery</h4>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="batteryType">Battery Type</Label>
                      <Input
                        id="batteryType"
                        value={modelForm.battery.type}
                        onChange={(e) => setModelForm({ ...modelForm, battery: { ...modelForm.battery, type: e.target.value } })}
                        placeholder="e.g., Li-Ion 3200 mAh, non-removable"
                        disabled={isSubmitting}
                      />
                    </div>
                    <div>
                      <Label htmlFor="charging">Charging</Label>
                      <Input
                        id="charging"
                        value={modelForm.battery.charging}
                        onChange={(e) => setModelForm({ ...modelForm, battery: { ...modelForm.battery, charging: e.target.value } })}
                        placeholder="e.g., 20W wired, 15W wireless"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Features</h4>
                  <div>
                    <Label htmlFor="sensors">Sensors</Label>
                    <Textarea
                      id="sensors"
                      value={modelForm.features.sensors}
                      onChange={(e) => setModelForm({ ...modelForm, features: { ...modelForm.features, sensors: e.target.value } })}
                      placeholder="e.g., Face ID, accelerometer, gyro, proximity, compass, barometer"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Other Information</h4>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="price">Price</Label>
                      <Input
                        id="price"
                        value={modelForm.other.price}
                        onChange={(e) => setModelForm({ ...modelForm, other: { ...modelForm.other, price: e.target.value } })}
                        placeholder="e.g., $999 / €1,099"
                        disabled={isSubmitting}
                      />
                    </div>
                    <div>
                      <Label htmlFor="releaseDate">Release Date</Label>
                      <Input
                        id="releaseDate"
                        value={modelForm.other.releaseDate}
                        onChange={(e) => setModelForm({ ...modelForm, other: { ...modelForm.other, releaseDate: e.target.value } })}
                        placeholder="e.g., Released 2023, September"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateModel(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button onClick={handleSaveModel} disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : (isEditMode ? 'Update Model' : 'Save Model')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Brand Dialog */}
        <Dialog open={showViewBrand} onOpenChange={setShowViewBrand}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Brand Details</DialogTitle>
            </DialogHeader>
            {selectedBrand && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  {selectedBrand.logo ? (
                    <img src={selectedBrand.logo} alt={selectedBrand.name} className="w-20 h-20 rounded-full object-cover" />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="h-10 w-10 text-primary" />
                    </div>
                  )}
                  <div>
                    <h3 className="text-2xl font-bold">{selectedBrand.name}</h3>
                    <Badge variant={selectedBrand.isActive ? "default" : "secondary"}>
                      {selectedBrand.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
                <div className="grid gap-4">
                  <div>
                    <Label>Models Count</Label>
                    <p className="text-sm text-muted-foreground">{(selectedBrand as any).modelCount || 0} models</p>
                  </div>
                  <div>
                    <Label>Created At</Label>
                    <p className="text-sm text-muted-foreground">
                      {new Date(selectedBrand.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowViewBrand(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create/Edit Device Category Dialog */}
        <Dialog open={showCreateDeviceType} onOpenChange={setShowCreateDeviceType}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{isEditMode ? 'Edit Device Category' : 'Add Device Category'}</DialogTitle>
              <DialogDescription>
                {isEditMode
                  ? 'Update the category name or key. Renaming the key updates linked models as well.'
                  : 'Create a new category that can be used for new device models.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="deviceTypeName">Category Name *</Label>
                <Input
                  id="deviceTypeName"
                  value={deviceTypeForm.name}
                  onChange={(e) =>
                    setDeviceTypeForm((prev) => ({
                      ...prev,
                      name: e.target.value,
                      key: prev.key ? prev.key : toTypeKey(e.target.value)
                    }))
                  }
                  placeholder="e.g., Foldable Phone"
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <Label htmlFor="deviceTypeKey">Category Key *</Label>
                <Input
                  id="deviceTypeKey"
                  value={deviceTypeForm.key}
                  onChange={(e) => setDeviceTypeForm((prev) => ({ ...prev, key: toTypeKey(e.target.value) }))}
                  placeholder="e.g., foldable-phone"
                  disabled={isSubmitting}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Lowercase letters, numbers and dashes only.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDeviceType(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button onClick={handleSaveDeviceType} disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : (isEditMode ? 'Update Category' : 'Save Category')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Device Category Dialog */}
        <Dialog open={showViewDeviceType} onOpenChange={setShowViewDeviceType}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Device Category Details</DialogTitle>
            </DialogHeader>
            {selectedDeviceTypeDetails && (
              <div className="space-y-4">
                <div className="rounded-lg border p-4">
                  <Label className="text-muted-foreground">Name</Label>
                  <p className="mt-1 text-lg font-semibold">{selectedDeviceTypeDetails.name}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <Label className="text-muted-foreground">Key</Label>
                  <p className="mt-1 font-mono text-sm">{selectedDeviceTypeDetails._id}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <Label className="text-muted-foreground">Models</Label>
                  <p className="mt-1 text-sm">{selectedDeviceTypeDetails.count || 0} models assigned</p>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowViewDeviceType(false)}>
                Close
              </Button>
              {selectedDeviceTypeDetails && (
                <Button
                  onClick={() => {
                    handleEditDeviceType(selectedDeviceTypeDetails)
                    setShowViewDeviceType(false)
                  }}
                >
                  Edit Category
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Model Dialog - Enhanced with Color Coding and Card-Based Layout */}
        <Dialog open={showViewModel} onOpenChange={setShowViewModel}>
          <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl">Device Model Details</DialogTitle>
              <DialogDescription>
                Comprehensive specifications and information
              </DialogDescription>
            </DialogHeader>
            {selectedModel && (
              <div className="space-y-6">
                {/* Header Section with Image */}
                <div className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-6 rounded-lg border">
                  <div className="flex flex-col md:flex-row gap-6 items-start">
                    {selectedModel.image ? (
                      <img
                        src={selectedModel.image}
                        alt={selectedModel.name}
                        className="w-32 h-32 object-contain rounded-lg border bg-white dark:bg-slate-950 p-2"
                      />
                    ) : (
                      <div className="w-32 h-32 bg-gradient-to-br from-primary/20 to-primary/5 rounded-lg flex items-center justify-center border">
                        <Smartphone className="h-16 w-16 text-primary/40" />
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="text-3xl font-bold mb-2">{selectedModel.name}</h3>
                      <div className="flex flex-wrap gap-2 mb-4">
                        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                          {brands.find(b => b._id === ((selectedModel as any).brandId?._id || (selectedModel as any).brandId))?.name || 'Unknown Brand'}
                        </Badge>
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 capitalize">
                          {selectedModel.deviceType}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        {(selectedModel as any).other?.releaseDate && (
                          <div>
                            <p className="text-muted-foreground">Release Date</p>
                            <p className="font-medium">{(selectedModel as any).other.releaseDate}</p>
                          </div>
                        )}
                        {(selectedModel as any).other?.price && (
                          <div>
                            <p className="text-muted-foreground">Price</p>
                            <p className="font-medium">{(selectedModel as any).other.price}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Basic Information */}
                                {/* Erweiterte Felder aus mobileapi.dev */}
                                {(selectedModel.specifications?.description || (selectedModel as any).other?.colors?.length > 0 || (selectedModel as any).memory?.internal?.length > 0 || (selectedModel as any).platform?.chipset || (selectedModel as any).other?.modelNumbers?.length > 0) && (
                                  <div>
                                    <h4 className="text-lg font-semibold mb-3 pb-2 border-b-2 border-fuchsia-200 dark:border-fuchsia-800 flex items-center gap-2">
                                      <div className="w-3 h-3 bg-fuchsia-500 rounded-full"></div>
                                      Zusätzliche Geräteinformationen
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      {/* Beschreibung */}
                                      {selectedModel.specifications?.description && (
                                        <Card className="bg-fuchsia-50 dark:bg-fuchsia-950/20 border-fuchsia-200 dark:border-fuchsia-800">
                                          <CardContent className="pt-6">
                                            <Label className="text-fuchsia-700 dark:text-fuchsia-300">Beschreibung</Label>
                                            <p className="text-sm font-medium mt-1">{selectedModel.specifications.description}</p>
                                          </CardContent>
                                        </Card>
                                      )}
                                      {/* Farben */}
                                      {(selectedModel as any).other?.colors?.length > 0 && (
                                        <Card className="bg-fuchsia-50 dark:bg-fuchsia-950/20 border-fuchsia-200 dark:border-fuchsia-800">
                                          <CardContent className="pt-6">
                                            <Label className="text-fuchsia-700 dark:text-fuchsia-300">Farben</Label>
                                            <p className="text-sm font-medium mt-1">{(selectedModel as any).other.colors.join(', ')}</p>
                                          </CardContent>
                                        </Card>
                                      )}
                                      {/* Speicher */}
                                      {(selectedModel as any).memory?.internal?.length > 0 && (
                                        <Card className="bg-fuchsia-50 dark:bg-fuchsia-950/20 border-fuchsia-200 dark:border-fuchsia-800">
                                          <CardContent className="pt-6">
                                            <Label className="text-fuchsia-700 dark:text-fuchsia-300">Speicher</Label>
                                            <ul className="text-sm font-medium mt-1 space-y-1">
                                              {(selectedModel as any).memory.internal.map((mem: any, idx: number) => (
                                                <li key={idx}>{mem.ram ? `${mem.ram} / ` : ''}{mem.storage}</li>
                                              ))}
                                            </ul>
                                          </CardContent>
                                        </Card>
                                      )}
                                      {/* Hardware */}
                                      {(selectedModel as any).platform?.chipset && (
                                        <Card className="bg-fuchsia-50 dark:bg-fuchsia-950/20 border-fuchsia-200 dark:border-fuchsia-800">
                                          <CardContent className="pt-6">
                                            <Label className="text-fuchsia-700 dark:text-fuchsia-300">Hardware</Label>
                                            <p className="text-sm font-medium mt-1">{(selectedModel as any).platform.chipset}</p>
                                          </CardContent>
                                        </Card>
                                      )}
                                      {/* Modellnummern */}
                                      {(selectedModel.modelNumbers?.length > 0) && (
                                        <Card className="bg-fuchsia-50 dark:bg-fuchsia-950/20 border-fuchsia-200 dark:border-fuchsia-800">
                                          <CardContent className="pt-6">
                                            <Label className="text-fuchsia-700 dark:text-fuchsia-300">Modellnummern</Label>
                                            <ul className="text-sm font-medium mt-1 space-y-1">
                                              {selectedModel.modelNumbers.map((num: string, idx: number) => (
                                                <li key={idx}>{num}</li>
                                              ))}
                                            </ul>
                                          </CardContent>
                                        </Card>
                                      )}
                                    </div>
                                  </div>
                                )}
                <div>
                  <h4 className="text-lg font-semibold mb-3 pb-2 border-b-2 border-blue-200 dark:border-blue-800 flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    Basic Information
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="bg-white border-gray-200 shadow-sm">
                      <CardContent className="pt-6">
                        <Label className="text-[#1a2a5e]">Device Type</Label>
                        <p className="text-sm font-medium capitalize mt-1">{selectedModel.deviceType}</p>
                      </CardContent>
                    </Card>
                    {(selectedModel as any).other?.releaseDate && (
                      <Card className="bg-white border-gray-200 shadow-sm">
                        <CardContent className="pt-6">
                          <Label className="text-[#1a2a5e]">Release Date</Label>
                          <p className="text-sm font-medium mt-1">{(selectedModel as any).other.releaseDate}</p>
                        </CardContent>
                      </Card>
                    )}
                    {(selectedModel as any).other?.price && (
                      <Card className="bg-white border-gray-200 shadow-sm">
                        <CardContent className="pt-6">
                          <Label className="text-[#1a2a5e]">Price</Label>
                          <p className="text-sm font-medium mt-1">{(selectedModel as any).other.price}</p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>

                {/* Frequent Problems */}
                <div>
                  <h4 className="text-lg font-semibold mb-3 pb-2 border-b-2 border-[#f5b800] flex items-center gap-2">
                    <div className="w-3 h-3 bg-[#f5b800] rounded-full"></div>
                    HAEUFIGE PROBLEME
                  </h4>
                  {(selectedModel.commonProblems || []).length === 0 ? (
                    <Card className="bg-white border-gray-200 shadow-sm">
                      <CardContent className="pt-6">
                        <p className="text-sm text-muted-foreground">Fuer dieses Modell wurden noch keine haeufigen Probleme hinterlegt.</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {selectedModel.commonProblems?.map((problem) => (
                        <Badge key={problem} className="bg-[#fff6da] text-[#1a2a5e] border border-[#f5d677] hover:bg-[#ffefbe]">
                          {problem}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Network Section */}
                {(selectedModel as any).network && Object.values((selectedModel as any).network).some(v => v) && (
                  <div>
                    <h4 className="text-lg font-semibold mb-3 pb-2 border-b-2 border-purple-200 dark:border-purple-800 flex items-center gap-2">
                      <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                      Network & Connectivity
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries((selectedModel as any).network).map(([key, value]) => (
                        value && (
                          <Card key={key} className="bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800">
                            <CardContent className="pt-6">
                              <Label className="text-purple-700 dark:text-purple-300 capitalize">
                                {key.replace(/([A-Z])/g, ' $1').trim()}
                              </Label>
                              <p className="text-sm font-medium mt-1">{value as string}</p>
                            </CardContent>
                          </Card>
                        )
                      ))}
                    </div>
                  </div>
                )}

                {/* Physical Characteristics */}
                {(selectedModel as any).physical && Object.values((selectedModel as any).physical).some(v => v) && (
                  <div>
                    <h4 className="text-lg font-semibold mb-3 pb-2 border-b-2 border-amber-200 dark:border-amber-800 flex items-center gap-2">
                      <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                      Physical Characteristics
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries((selectedModel as any).physical).map(([key, value]) => (
                        value && (
                          <Card key={key} className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
                            <CardContent className="pt-6">
                              <Label className="text-amber-700 dark:text-amber-300 capitalize">
                                {key.replace(/([A-Z])/g, ' $1').trim()}
                              </Label>
                              <p className="text-sm font-medium mt-1">{value as string}</p>
                            </CardContent>
                          </Card>
                        )
                      ))}
                    </div>
                  </div>
                )}

                {/* Display */}
                {(selectedModel as any).display && Object.values((selectedModel as any).display).some(v => v) && (
                  <div>
                    <h4 className="text-lg font-semibold mb-3 pb-2 border-b-2 border-cyan-200 dark:border-cyan-800 flex items-center gap-2">
                      <div className="w-3 h-3 bg-cyan-500 rounded-full"></div>
                      Display
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries((selectedModel as any).display).map(([key, value]) => (
                        value && (
                          <Card key={key} className="bg-cyan-50 dark:bg-cyan-950/20 border-cyan-200 dark:border-cyan-800">
                            <CardContent className="pt-6">
                              <Label className="text-cyan-700 dark:text-cyan-300 capitalize">
                                {key}
                              </Label>
                              <p className="text-sm font-medium mt-1 line-clamp-2">{value as string}</p>
                            </CardContent>
                          </Card>
                        )
                      ))}
                    </div>
                  </div>
                )}

                {/* Platform & Performance */}
                {((selectedModel as any).platform || (selectedModel as any).memory) && (
                  <div>
                    <h4 className="text-lg font-semibold mb-3 pb-2 border-b-2 border-indigo-200 dark:border-indigo-800 flex items-center gap-2">
                      <div className="w-3 h-3 bg-indigo-500 rounded-full"></div>
                      Platform & Performance
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(selectedModel as any).platform && Object.entries((selectedModel as any).platform).map(([key, value]) => (
                        value && (
                          <Card key={key} className="bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800">
                            <CardContent className="pt-6">
                              <Label className="text-indigo-700 dark:text-indigo-300 uppercase">
                                {key}
                              </Label>
                              <p className="text-sm font-medium mt-1">{value as string}</p>
                            </CardContent>
                          </Card>
                        )
                      ))}
                      {(selectedModel as any).memory?.cardSlot && (
                        <Card className="bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800">
                          <CardContent className="pt-6">
                            <Label className="text-indigo-700 dark:text-indigo-300">Card Slot</Label>
                            <p className="text-sm font-medium mt-1">{(selectedModel as any).memory.cardSlot}</p>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </div>
                )}

                {/* Camera */}
                {((selectedModel as any).rearCamera || (selectedModel as any).frontCamera) && (
                  <div>
                    <h4 className="text-lg font-semibold mb-3 pb-2 border-b-2 border-rose-200 dark:border-rose-800 flex items-center gap-2">
                      <div className="w-3 h-3 bg-rose-500 rounded-full"></div>
                      Camera
                    </h4>
                    <div className="grid grid-cols-1 gap-6">
                      {(selectedModel as any).rearCamera && Object.values((selectedModel as any).rearCamera).some(v => v) && (
                        <div>
                          <h5 className="font-medium text-rose-700 dark:text-rose-300 mb-3">Rear Camera</h5>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {Object.entries((selectedModel as any).rearCamera).map(([key, value]) => (
                              value && (
                                <Card key={key} className="bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800">
                                  <CardContent className="pt-6">
                                    <Label className="text-rose-700 dark:text-rose-300 capitalize">
                                      {key}
                                    </Label>
                                    <p className="text-sm font-medium mt-1 line-clamp-3">{value as string}</p>
                                  </CardContent>
                                </Card>
                              )
                            ))}
                          </div>
                        </div>
                      )}
                      {(selectedModel as any).frontCamera && Object.values((selectedModel as any).frontCamera).some(v => v) && (
                        <div>
                          <h5 className="font-medium text-rose-700 dark:text-rose-300 mb-3">Front Camera</h5>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {Object.entries((selectedModel as any).frontCamera).map(([key, value]) => (
                              value && (
                                <Card key={key} className="bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800">
                                  <CardContent className="pt-6">
                                    <Label className="text-rose-700 dark:text-rose-300 capitalize">
                                      {key}
                                    </Label>
                                    <p className="text-sm font-medium mt-1 line-clamp-3">{value as string}</p>
                                  </CardContent>
                                </Card>
                              )
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Other Features */}
                {((selectedModel as any).audio || (selectedModel as any).connectivity || (selectedModel as any).battery || (selectedModel as any).features) && (
                  <div>
                    <h4 className="text-lg font-semibold mb-3 pb-2 border-b-2 border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
                      <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                      Features & Additional Info
                    </h4>
                    <div className="grid grid-cols-1 gap-6">
                      {(selectedModel as any).audio && Object.values((selectedModel as any).audio).some(v => v) && (
                        <div>
                          <h5 className="font-medium text-emerald-700 dark:text-emerald-300 mb-3">Audio</h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {Object.entries((selectedModel as any).audio).map(([key, value]) => (
                              value && (
                                <Card key={key} className="bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800">
                                  <CardContent className="pt-6">
                                    <Label className="text-emerald-700 dark:text-emerald-300 capitalize">
                                      {key.replace(/_/g, ' ')}
                                    </Label>
                                    <p className="text-sm font-medium mt-1">{value as string}</p>
                                  </CardContent>
                                </Card>
                              )
                            ))}
                          </div>
                        </div>
                      )}
                      {(selectedModel as any).connectivity && Object.values((selectedModel as any).connectivity).some(v => v) && (
                        <div>
                          <h5 className="font-medium text-emerald-700 dark:text-emerald-300 mb-3">Connectivity</h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {Object.entries((selectedModel as any).connectivity).map(([key, value]) => (
                              value && (
                                <Card key={key} className="bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800">
                                  <CardContent className="pt-6">
                                    <Label className="text-emerald-700 dark:text-emerald-300 uppercase">
                                      {key}
                                    </Label>
                                    <p className="text-sm font-medium mt-1">{value as string}</p>
                                  </CardContent>
                                </Card>
                              )
                            ))}
                          </div>
                        </div>
                      )}
                      {(selectedModel as any).battery && Object.values((selectedModel as any).battery).some(v => v) && (
                        <div>
                          <h5 className="font-medium text-emerald-700 dark:text-emerald-300 mb-3">Battery</h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {Object.entries((selectedModel as any).battery).map(([key, value]) => (
                              value && (
                                <Card key={key} className="bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800">
                                  <CardContent className="pt-6">
                                    <Label className="text-emerald-700 dark:text-emerald-300 capitalize">
                                      {key.replace(/([A-Z])/g, ' $1').trim()}
                                    </Label>
                                    <p className="text-sm font-medium mt-1">{value as string}</p>
                                  </CardContent>
                                </Card>
                              )
                            ))}
                          </div>
                        </div>
                      )}
                      {(selectedModel as any).features && Object.values((selectedModel as any).features).some(v => v) && (
                        <div>
                          <h5 className="font-medium text-emerald-700 dark:text-emerald-300 mb-3">Features</h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {Object.entries((selectedModel as any).features).map(([key, value]) => (
                              value && (
                                <Card key={key} className="bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800">
                                  <CardContent className="pt-6">
                                    <Label className="text-emerald-700 dark:text-emerald-300 capitalize">
                                      {key}
                                    </Label>
                                    <p className="text-sm font-medium mt-1">
                                      {Array.isArray(value) ? value.join(', ') : value as string}
                                    </p>
                                  </CardContent>
                                </Card>
                              )
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Legacy Specifications */}
                {selectedModel.specifications && Object.keys(selectedModel.specifications).length > 0 && (
                  <div>
                    <h4 className="text-lg font-semibold mb-3 pb-2 border-b-2 border-gray-200 dark:border-gray-800 flex items-center gap-2">
                      <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                      Legacy Specifications
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(selectedModel.specifications).map(([key, value]) => (
                        <Card key={key} className="bg-gray-50 dark:bg-gray-950/20 border-gray-200 dark:border-gray-800">
                          <CardContent className="pt-6">
                            <Label className="text-gray-700 dark:text-gray-300 capitalize">
                              {key.replace(/_/g, ' ')}
                            </Label>
                            <p className="text-sm font-medium mt-1">{value as string}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowViewModel(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Help Dialog */}
        <Dialog open={showHelp} onOpenChange={setShowHelp}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5" />
                Device Management Help
              </DialogTitle>
              <DialogDescription>
                Learn how to use the Device Management interface
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Dashboard Overview
                </h4>
                <p className="text-sm text-muted-foreground">
                  The dashboard provides a quick overview of your device database with key metrics including total brands, models, device types, and recent additions.
                </p>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Managing Brands</h4>
                <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                  <li>Click "Add Brand" to create a new device manufacturer</li>
                  <li>Use the search bar to quickly find specific brands</li>
                  <li>Click the eye icon to view detailed brand information</li>
                  <li>Click the edit icon to modify brand details</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Managing Models</h4>
                <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                  <li>Select a device type and manufacturer to view available models</li>
                  <li>Click "Add Model" to create a new device model</li>
                  <li>Use search and filters to find specific models</li>
                  <li>Click on any model card to view full specifications</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Search & Filters</h4>
                <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                  <li>Use the search bar to find devices by name</li>
                  <li>Apply device type and manufacturer filters for refined results</li>
                  <li>Filters are interactive and update results in real-time</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Tips & Best Practices</h4>
                <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                  <li>Keep brand and model names consistent for better organization</li>
                  <li>Add logo/image URLs for better visual identification</li>
                  <li>Use specifications to store detailed device information</li>
                  <li>Regularly review and update device information</li>
                </ul>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setShowHelp(false)}>Got it!</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
