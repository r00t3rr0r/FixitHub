import { useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { useToast } from "@/hooks/useToast"
import { useAuth } from "@/contexts/AuthContext"
import { LoginDialog } from "@/components/home/LoginDialog"
import { createRepairRequest } from "@/api/repairRequests"
import {
  getDeviceTypes,
  getManufacturersByDeviceType,
  getModelsByTypeAndManufacturer,
  DeviceType as ApiDeviceType,
  Manufacturer,
  DeviceModel
} from "@/api/devices"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Smartphone,
  Upload,
  CheckCircle,
  ArrowLeft,
  AlertCircle,
  Wrench,
  Loader2,
  Package,
  X,
  Droplets,
  Edit2,
  Database,
  Laptop,
  Tablet,
} from "lucide-react"

interface SelectedDevice {
  _id: string
  name: string
  deviceType: string
  manufacturer: string
  manufacturerId: string
  image?: string
}

const DEVICE_TYPES = ["Smartphone", "Tablet", "Laptop", "Anderes"]

export function RepairRequestQuestionnaire() {
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()
  const { isAuthenticated } = useAuth()
  const [showLoginDialog, setShowLoginDialog] = useState(false)

  // Device from configurator nav state (DB device)
  const [selectedDevice, setSelectedDevice] = useState<SelectedDevice | null>(
    location.state?.device as SelectedDevice | null
  )

  // Manual device entry
  const [manualDeviceType, setManualDeviceType] = useState("Smartphone")
  const [manualDeviceName, setManualDeviceName] = useState("")
  const [manualModelNumber, setManualModelNumber] = useState("")

  // Is the device card in edit / entry mode?
  const [editingDevice, setEditingDevice] = useState(!location.state?.device)

  // DB selection dialog
  const [showDeviceDialog, setShowDeviceDialog] = useState(false)
  const [deviceTypes, setDeviceTypes] = useState<ApiDeviceType[]>([])
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [models, setModels] = useState<DeviceModel[]>([])
  const [selectedDeviceType, setSelectedDeviceType] = useState("")
  const [selectedManufacturer, setSelectedManufacturer] = useState("")
  const [selectedModel, setSelectedModel] = useState("")
  const [loadingManufacturers, setLoadingManufacturers] = useState(false)
  const [loadingModels, setLoadingModels] = useState(false)

  // Request form
  const [issueDescription, setIssueDescription] = useState("")
  const [issueOccurredDate, setIssueOccurredDate] = useState("")
  const [images, setImages] = useState<File[]>([])
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Quick toggles
  const [waterDamage, setWaterDamage] = useState<"no" | "yes" | "unsure">("no")
  const [previousRepairAttempts, setPreviousRepairAttempts] = useState<"no" | "yes" | "unsure">("no")
  const [previousRepairDetails, setPreviousRepairDetails] = useState("")
  const [itemCondition, setItemCondition] = useState<"original" | "refurbished" | "unsure">("unsure")

  // Navigation back
  const navigateBack = () => {
    if (selectedDevice?.deviceType && selectedDevice?.manufacturer && selectedDevice?.name) {
      sessionStorage.setItem(
        "navDeviceSelection",
        JSON.stringify({
          deviceType: selectedDevice.deviceType,
          manufacturer: selectedDevice.manufacturer,
          modelName: selectedDevice.name,
          searchQuery: selectedDevice.name,
        })
      )
      sessionStorage.setItem("navConfiguratorStep", "3")
    }
    navigate("/")
  }

  // Device icon helper
  const getDeviceTypeIcon = (deviceType: string) => {
    switch (deviceType?.toLowerCase()) {
      case "smartphone": return <Smartphone className="h-5 w-5" />
      case "tablet": return <Tablet className="h-5 w-5" />
      case "laptop": return <Laptop className="h-5 w-5" />
      default: return <Package className="h-5 w-5" />
    }
  }

  // Toggle button style
  const toggleStyle = (active: boolean, variant: "blue" | "yellow" = "blue"): React.CSSProperties => ({
    borderColor: active ? "transparent" : "rgba(26,42,94,0.14)",
    background: active
      ? variant === "blue"
        ? "linear-gradient(135deg, #1a2a5e 0%, #2f57b0 100%)"
        : "linear-gradient(135deg, #f5c518 0%, rgba(245,197,24,0.85) 100%)"
      : "white",
    color: active ? (variant === "blue" ? "white" : "#1a2a5e") : "#1a2a5e",
    boxShadow: active
      ? variant === "blue"
        ? "0 6px 18px rgba(26,42,94,0.18)"
        : "0 6px 18px rgba(245,197,24,0.22)"
      : "none",
  })

  // Confirm manual device entry
  const confirmManualDevice = () => {
    if (!manualDeviceName.trim()) {
      setErrors((prev) => ({ ...prev, manualDeviceName: "Bitte Gerätebezeichnung eingeben" }))
      return
    }
    setSelectedDevice(null)
    setEditingDevice(false)
    setErrors((prev) => {
      const next = { ...prev }
      delete next.manualDeviceName
      delete next.device
      return next
    })
  }

  // Open DB dialog
  const openDbDialog = async () => {
    setShowDeviceDialog(true)
    setSelectedDeviceType("")
    setSelectedManufacturer("")
    setSelectedModel("")
    setManufacturers([])
    setModels([])
    try {
      const res = await getDeviceTypes()
      setDeviceTypes((res as any).deviceTypes || [])
    } catch {
      toast({ title: "Fehler", description: "Gerätetypen konnten nicht geladen werden", variant: "destructive" })
    }
  }

  const handleDbDeviceTypeChange = async (id: string) => {
    setSelectedDeviceType(id)
    setSelectedManufacturer("")
    setSelectedModel("")
    setManufacturers([])
    setModels([])
    if (!id) return
    try {
      setLoadingManufacturers(true)
      const res = await getManufacturersByDeviceType(id)
      setManufacturers((res as any).manufacturers || [])
    } catch {
      toast({ title: "Fehler", description: "Marken konnten nicht geladen werden", variant: "destructive" })
    } finally {
      setLoadingManufacturers(false)
    }
  }

  const handleDbManufacturerChange = async (id: string) => {
    setSelectedManufacturer(id)
    setSelectedModel("")
    setModels([])
    if (!id || !selectedDeviceType) return
    try {
      setLoadingModels(true)
      const res = await getModelsByTypeAndManufacturer(selectedDeviceType, id)
      setModels((res as any).models || [])
    } catch {
      toast({ title: "Fehler", description: "Modelle konnten nicht geladen werden", variant: "destructive" })
    } finally {
      setLoadingModels(false)
    }
  }

  const confirmDbDevice = () => {
    if (!selectedModel) return
    const modelData = models.find((m) => m._id === selectedModel)
    const mfrData = manufacturers.find((m) => m._id === selectedManufacturer)
    const typeData = deviceTypes.find((dt) => dt._id === selectedDeviceType)
    if (modelData && mfrData && typeData) {
      setSelectedDevice({
        _id: modelData._id,
        name: modelData.name,
        deviceType: typeData.name,
        manufacturer: mfrData.name,
        manufacturerId: mfrData._id,
        image: modelData.image,
      })
      setEditingDevice(false)
      setShowDeviceDialog(false)
      setErrors((prev) => { const next = { ...prev }; delete next.device; return next })
    }
  }

  // Image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length + images.length > 5) {
      toast({ title: "Zu viele Bilder", description: "Maximal 5 Bilder erlaubt", variant: "destructive" })
      return
    }
    const valid = files.filter((file) => {
      if (!file.type.startsWith("image/")) {
        toast({ title: "Ungültiger Dateityp", description: `${file.name} ist keine Bilddatei`, variant: "destructive" })
        return false
      }
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "Datei zu groß", description: `${file.name} überschreitet 5 MB`, variant: "destructive" })
        return false
      }
      return true
    })
    setImages((prev) => [...prev, ...valid])
    valid.forEach((file) => {
      const reader = new FileReader()
      reader.onloadend = () => setImagePreviewUrls((prev) => [...prev, reader.result as string])
      reader.readAsDataURL(file)
    })
  }

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
    setImagePreviewUrls((prev) => prev.filter((_, i) => i !== index))
  }

  // Validation & submit
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (editingDevice || (!selectedDevice && !manualDeviceName.trim())) {
      newErrors.device = "Bitte Geräteinformationen angeben"
    }
    if (!issueDescription.trim()) {
      newErrors.issueDescription = "Fehlerbeschreibung ist erforderlich"
    } else if (issueDescription.trim().length < 20) {
      newErrors.issueDescription = "Bitte geben Sie eine detailliertere Beschreibung an (mindestens 20 Zeichen)"
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAuthenticated) {
      toast({ title: "Anmeldung erforderlich", description: "Bitte melden Sie sich an, um eine Reparaturanfrage zu stellen" })
      setShowLoginDialog(true)
      return
    }
    if (!validateForm()) return

    const isDbDevice = !editingDevice && selectedDevice !== null
    const deviceTypeFinal = isDbDevice ? selectedDevice!.deviceType : manualDeviceType
    const deviceBrandFinal = isDbDevice ? selectedDevice!.manufacturer : manualDeviceName.split(" ")[0]
    const deviceModelFinal = isDbDevice ? selectedDevice!.name : manualDeviceName
    const deviceModelIdFinal = isDbDevice ? selectedDevice!._id : ""
    const modelNumberFinal = isDbDevice ? "" : manualModelNumber

    try {
      setSubmitting(true)
      await createRepairRequest({
        deviceType: deviceTypeFinal,
        deviceBrand: deviceBrandFinal,
        deviceModel: deviceModelFinal,
        deviceModelId: deviceModelIdFinal,
        issueDescription,
        issueOccurredDate: issueOccurredDate || "",
        repairAttempts: previousRepairAttempts,
        modelNumber: modelNumberFinal,
        waterDamage,
        previousRepairDetails: previousRepairAttempts === "yes" ? previousRepairDetails : "",
        itemCondition,
        images: imagePreviewUrls,
      })
      toast({
        title: "Erfolg!",
        description: "Ihre Reparaturanfrage wurde erfolgreich übermittelt. Unser Team meldet sich innerhalb von 24 Stunden* bei Ihnen.",
      })
      navigate("/my-repair-requests")
    } catch (error: any) {
      toast({ title: "Fehler", description: error.message || "Reparaturanfrage konnte nicht übermittelt werden.", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {/* Hero Banner */}
      <section className="relative overflow-hidden bg-[linear-gradient(135deg,_#1a2a5e_0%,_#2f57b0_100%)] px-6 py-14 text-white md:px-12 md:py-20">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-12 h-56 w-56 rounded-full bg-yellow-300/15 blur-3xl" />

        <div className="relative z-10 text-center">
          <button
            type="button"
            onClick={navigateBack}
            className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20"
          >
            <ArrowLeft className="h-4 w-4" />
            Zurück
          </button>

          <h1 className="text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
            Reparaturanfrage
          </h1>
          <p className="mt-5 text-base leading-7 text-blue-100 md:text-lg">
            Manche Defekte erfordern individuelle Begutachtung. Bei McRepair.de ist das kein Problem:
            schildern Sie uns Ihr Problem, und Sie erhalten innerhalb von 24 Stunden* eine Rückmeldung.
          </p>
          <p className="mt-3 text-sm text-blue-200/70">* werktags</p>
        </div>
      </section>

      <form onSubmit={handleSubmit} className="space-y-6 px-6 py-10 md:px-12 md:py-14">

        {/* Card 1: Device */}
        <Card className="border-0 shadow-xl">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle
              className="flex items-center gap-2.5 text-xl"
              style={{ color: "var(--primary-blue, #1a2a5e)" }}
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ background: "rgba(26,42,94,0.08)", color: "var(--primary-blue, #1a2a5e)" }}
              >
                <Smartphone className="h-5 w-5" />
              </span>
              Ihr Gerät
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-5 pt-6">
            {/* Confirmed DB device display */}
            {!editingDevice && selectedDevice && (
              <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                  style={{ color: "var(--primary-blue, #1a2a5e)" }}
                >
                  {selectedDevice.image ? (
                    <img
                      src={selectedDevice.image}
                      alt={selectedDevice.name}
                      className="h-full w-full object-contain p-1"
                      onError={(e) => {
                        e.currentTarget.style.display = "none"
                        const next = e.currentTarget.nextElementSibling as HTMLElement
                        if (next) next.style.display = "flex"
                      }}
                    />
                  ) : null}
                  <div
                    className="h-full w-full items-center justify-center"
                    style={{ display: selectedDevice.image ? "none" : "flex" }}
                  >
                    {getDeviceTypeIcon(selectedDevice.deviceType)}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ausgewähltes Gerät</p>
                  <p className="truncate text-base font-bold" style={{ color: "var(--primary-blue, #1a2a5e)" }}>
                    {selectedDevice.name}
                  </p>
                  <p className="text-sm text-slate-500">
                    {selectedDevice.manufacturer} · {selectedDevice.deviceType}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingDevice(true)}
                  className="shrink-0 rounded-full border-slate-200 text-sm font-semibold"
                  style={{ color: "var(--primary-blue, #1a2a5e)" }}
                >
                  <Edit2 className="mr-1.5 h-4 w-4" /> Ändern
                </Button>
              </div>
            )}

            {/* Confirmed manual device display */}
            {!editingDevice && !selectedDevice && manualDeviceName && (
              <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm"
                  style={{ color: "var(--primary-blue, #1a2a5e)" }}
                >
                  {getDeviceTypeIcon(manualDeviceType)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{manualDeviceType}</p>
                  <p className="truncate text-base font-bold" style={{ color: "var(--primary-blue, #1a2a5e)" }}>
                    {manualDeviceName}
                  </p>
                  {manualModelNumber && (
                    <p className="text-sm text-slate-500">Modellnr.: {manualModelNumber}</p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingDevice(true)}
                  className="shrink-0 rounded-full border-slate-200 text-sm font-semibold"
                  style={{ color: "var(--primary-blue, #1a2a5e)" }}
                >
                  <Edit2 className="mr-1.5 h-4 w-4" /> Ändern
                </Button>
              </div>
            )}

            {/* Entry / edit form */}
            {editingDevice && (
              <div className="space-y-5">
                {/* Device type */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">
                    Gerätetyp <span className="text-red-500">*</span>
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {DEVICE_TYPES.map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setManualDeviceType(type)}
                        className="rounded-full border px-4 py-2 text-sm font-semibold transition"
                        style={toggleStyle(manualDeviceType === type)}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Device name incl. manufacturer */}
                <div className="space-y-2">
                  <Label htmlFor="manualDeviceName" className="text-sm font-semibold">
                    Gerätebezeichnung inkl. Hersteller <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="manualDeviceName"
                    type="text"
                    placeholder='z. B. „Microsoft Lumia 650 Dual SIM" oder „Apple iPhone 14 Pro"'
                    value={manualDeviceName}
                    onChange={(e) => {
                      setManualDeviceName(e.target.value)
                      if (errors.manualDeviceName)
                        setErrors((prev) => { const next = { ...prev }; delete next.manualDeviceName; return next })
                    }}
                    className={errors.manualDeviceName ? "border-red-500 focus-visible:ring-red-200" : ""}
                  />
                  {errors.manualDeviceName && (
                    <p className="flex items-center gap-1.5 text-sm text-red-600">
                      <AlertCircle className="h-4 w-4" /> {errors.manualDeviceName}
                    </p>
                  )}
                </div>

                {/* Model number */}
                <div className="space-y-2">
                  <Label htmlFor="manualModelNumber" className="text-sm font-semibold">
                    Modellnummer
                    <span className="ml-2 text-xs font-normal text-slate-500">
                      (besonders wichtig bei Laptops)
                    </span>
                  </Label>
                  <Input
                    id="manualModelNumber"
                    type="text"
                    placeholder="z. B. A2215, SM-G998B, HP 255 G8, ThinkPad T14s …"
                    value={manualModelNumber}
                    onChange={(e) => setManualModelNumber(e.target.value)}
                  />
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    onClick={confirmManualDevice}
                    className="rounded-full font-semibold text-white"
                    style={{ background: "var(--primary-blue, #1a2a5e)" }}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Gerät übernehmen
                  </Button>
                  <button
                    type="button"
                    onClick={openDbDialog}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold transition hover:bg-slate-50"
                    style={{ color: "var(--primary-blue, #1a2a5e)" }}
                  >
                    <Database className="h-4 w-4" />
                    Aus Datenbank wählen
                  </button>
                </div>
              </div>
            )}

            {errors.device && (
              <p className="flex items-center gap-1.5 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" /> {errors.device}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Card 2: Repair Request */}
        <Card className="border-0 shadow-xl">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle
              className="flex items-center gap-2.5 text-xl"
              style={{ color: "var(--primary-blue, #1a2a5e)" }}
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ background: "rgba(26,42,94,0.08)", color: "var(--primary-blue, #1a2a5e)" }}
              >
                <Wrench className="h-5 w-5" />
              </span>
              Ihre Anfrage
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-6 pt-6">

            {/* Issue description */}
            <div className="space-y-2">
              <Label htmlFor="issueDescription" className="text-sm font-semibold">
                Fehlerbeschreibung <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="issueDescription"
                placeholder="Beschreiben Sie das Problem so genau wie möglich: Was passiert genau? Wann tritt es auf? Was haben Sie bereits versucht?"
                value={issueDescription}
                onChange={(e) => {
                  setIssueDescription(e.target.value)
                  if (errors.issueDescription)
                    setErrors((prev) => { const next = { ...prev }; delete next.issueDescription; return next })
                }}
                className={`min-h-[140px] ${errors.issueDescription ? "border-red-500 focus-visible:ring-red-200" : ""}`}
              />
              {errors.issueDescription && (
                <p className="flex items-center gap-1.5 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4" /> {errors.issueDescription}
                </p>
              )}
            </div>

            {/* Image upload */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">
                Bilder hochladen
                <span className="ml-2 text-xs font-normal text-slate-500">(optional, max. 5 Bilder)</span>
              </Label>
              <input
                id="images"
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                disabled={images.length >= 5}
              />
              <label
                htmlFor="images"
                className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-8 text-center transition ${images.length >= 5 ? "cursor-not-allowed opacity-60" : "hover:bg-slate-50"}`}
                style={{ borderColor: "rgba(26,42,94,0.16)", background: "rgba(248,250,252,0.9)" }}
              >
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-2xl"
                  style={{ background: "rgba(245,197,24,0.18)", color: "var(--primary-blue, #1a2a5e)" }}
                >
                  <Upload className="h-5 w-5" />
                </span>
                <p className="mt-3 text-sm font-semibold" style={{ color: "var(--primary-blue, #1a2a5e)" }}>
                  Fotos hinzufügen
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {images.length}/5 Bilder · JPG, PNG oder GIF · max. 5 MB
                </p>
              </label>
              {imagePreviewUrls.length > 0 && (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                  {imagePreviewUrls.map((url, index) => (
                    <div
                      key={index}
                      className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                    >
                      <img
                        src={url}
                        alt={`Vorschau ${index + 1}`}
                        className="aspect-square h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white shadow transition hover:scale-110 sm:opacity-0 sm:group-hover:opacity-100"
                        aria-label="Bild entfernen"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* When did it happen — optional */}
            <div className="space-y-2">
              <Label htmlFor="issueOccurredDate" className="text-sm font-semibold">
                Wann ist das passiert?
                <span className="ml-2 text-xs font-normal text-slate-500">(optional)</span>
              </Label>
              <Input
                id="issueOccurredDate"
                type="text"
                placeholder="z. B. Gestern, letzte Woche, vor 3 Monaten …"
                value={issueOccurredDate}
                onChange={(e) => setIssueOccurredDate(e.target.value)}
              />
            </div>

            {/* Water damage */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-semibold">
                <Droplets className="h-4 w-4" /> Flüssigkeitsschaden?
              </Label>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["no", "Nein"],
                    ["yes", "Ja"],
                    ["unsure", "Nicht sicher"],
                  ] as const
                ).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setWaterDamage(val)}
                    className="rounded-full border px-4 py-2 text-sm font-semibold transition"
                    style={toggleStyle(waterDamage === val)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Previous repair attempts */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2 text-sm font-semibold">
                <Wrench className="h-4 w-4" /> Frühere Reparaturversuche?
              </Label>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["no", "Nein"],
                    ["yes", "Ja"],
                    ["unsure", "Nicht sicher"],
                  ] as const
                ).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setPreviousRepairAttempts(val)}
                    className="rounded-full border px-4 py-2 text-sm font-semibold transition"
                    style={toggleStyle(previousRepairAttempts === val)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {previousRepairAttempts === "yes" && (
                <Textarea
                  placeholder="Beschreiben Sie kurz, was bereits versucht wurde …"
                  value={previousRepairDetails}
                  onChange={(e) => setPreviousRepairDetails(e.target.value)}
                  className="min-h-[80px]"
                />
              )}
            </div>

            {/* Device condition */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-semibold">
                <Package className="h-4 w-4" /> Gerätezustand?
              </Label>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["original", "Original"],
                    ["refurbished", "Gebraucht"],
                    ["unsure", "Nicht sicher"],
                  ] as const
                ).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setItemCondition(val)}
                    className="rounded-full border px-4 py-2 text-sm font-semibold transition"
                    style={toggleStyle(itemCondition === val, "yellow")}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit area */}
            <div className="space-y-3 border-t border-slate-100 pt-5">
              <div
                className="rounded-xl border px-4 py-3 text-sm leading-6"
                style={{ borderColor: "rgba(16,185,129,0.24)", background: "rgba(236,253,245,0.9)", color: "#065f46" }}
              >
                <div className="flex items-start gap-3">
                  <CheckCircle className="mt-0.5 h-5 w-5 shrink-0" />
                  <span>
                    Nach Einreichung prüft unser Team Ihre Anfrage und meldet sich innerhalb von 24 Stunden* bei Ihnen.
                  </span>
                </div>
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="h-12 w-full rounded-full text-base font-bold text-white"
                style={{ background: "var(--primary-blue, #1a2a5e)" }}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Wird gesendet…
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" /> Reparaturanfrage absenden
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      {/* DB Selection Dialog */}
      <Dialog open={showDeviceDialog} onOpenChange={setShowDeviceDialog}>
        <DialogContent className="sm:max-w-[580px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Database className="h-5 w-5" />
              Gerät aus Datenbank wählen
            </DialogTitle>
            <DialogDescription>
              Suchen Sie Ihr Gerät in unserer Gerätedatenbank
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">
                1. Gerätetyp <span className="text-red-500">*</span>
              </label>
              <Select value={selectedDeviceType} onValueChange={handleDbDeviceTypeChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Gerätetyp wählen …" />
                </SelectTrigger>
                <SelectContent>
                  {deviceTypes.map((type) => (
                    <SelectItem key={type._id} value={type._id}>
                      <span className="capitalize">{type.name}</span>
                      <span className="ml-2 text-xs text-gray-500">({type.count})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">
                2. Marke <span className="text-red-500">*</span>
              </label>
              <Select
                value={selectedManufacturer}
                onValueChange={handleDbManufacturerChange}
                disabled={!selectedDeviceType || loadingManufacturers}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      loadingManufacturers ? "Lädt …" : !selectedDeviceType ? "Zuerst Gerätetyp wählen" : "Marke wählen …"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {manufacturers.map((m) => (
                    <SelectItem key={m._id} value={m._id}>
                      {m.name}
                      <span className="ml-2 text-xs text-gray-500">({m.count} Modelle)</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">
                3. Modell <span className="text-red-500">*</span>
              </label>
              <Select
                value={selectedModel}
                onValueChange={setSelectedModel}
                disabled={!selectedManufacturer || loadingModels}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      loadingModels ? "Lädt …" : !selectedManufacturer ? "Zuerst Marke wählen" : "Modell wählen …"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {models.map((m) => (
                    <SelectItem key={m._id} value={m._id}>
                      <div className="flex items-center gap-2">
                        {m.image && (
                          <img
                            src={m.image}
                            alt={m.name}
                            className="h-6 w-6 object-contain"
                            onError={(e) => (e.currentTarget.style.display = "none")}
                          />
                        )}
                        <span>{m.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedModel && models.find((m) => m._id === selectedModel) && (
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <div className="flex items-center gap-3">
                  {models.find((m) => m._id === selectedModel)?.image && (
                    <img
                      src={models.find((m) => m._id === selectedModel)?.image}
                      alt="Ausgewähltes Gerät"
                      className="h-14 w-14 object-contain"
                    />
                  )}
                  <div>
                    <p className="font-semibold text-gray-900">
                      {models.find((m) => m._id === selectedModel)?.name}
                    </p>
                    <p className="text-sm text-gray-600">
                      {manufacturers.find((m) => m._id === selectedManufacturer)?.name} ·{" "}
                      {deviceTypes.find((dt) => dt._id === selectedDeviceType)?.name}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeviceDialog(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={confirmDbDevice}
              disabled={!selectedModel}
              className="bg-[#1a2a5e] hover:bg-[#0f1d45]"
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Gerät übernehmen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Login Dialog */}
      {showLoginDialog && (
        <>
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.3)",
              zIndex: 9998,
            }}
            onClick={() => setShowLoginDialog(false)}
          />
          <LoginDialog
            isOpen={showLoginDialog}
            onClose={() => setShowLoginDialog(false)}
          />
        </>
      )}
    </>
  )
}
