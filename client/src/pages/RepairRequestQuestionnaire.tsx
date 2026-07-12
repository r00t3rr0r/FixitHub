import { useState } from "react"
import { SEO } from '@/components/SEO'
import { useNavigate, useLocation } from "react-router-dom"
import { useToast } from "@/hooks/useToast"
import { useAuth } from "@/contexts/AuthContext"
import { AuthRequiredDialog, GuestInfo } from "@/components/auth/AuthRequiredDialog"
import { createRepairRequest } from "@/api/repairRequests"
import { createGuestRepairRequest } from "@/api/guestRepairRequest"
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
  Clock3,
  ShieldCheck,
  Eye,
  HelpCircle,
  MessageSquare,
  Star,
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

/* ─────────────────────────────────────────────
   JSON-LD structured data (rendered in <head>)
───────────────────────────────────────────── */
const repairRequestJsonLd = [
  /* 1 — WebPage --------------------------------------------------- */
  {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': 'https://www.mcrepair.de/repair-request',
    url: 'https://www.mcrepair.de/repair-request',
    name: 'Reparaturanfrage stellen – Smartphone, Tablet & Laptop | McRepair.de',
    description:
      'Individuelle Reparaturanfrage für Smartphones, Tablets und Laptops online stellen. Kostenlose Ersteinschätzung innerhalb von 24 Werktags-Stunden. Für alle Marken: Apple, Samsung, Huawei, Xiaomi u. v. m.',
    inLanguage: 'de-DE',
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Startseite', item: 'https://www.mcrepair.de/' },
        { '@type': 'ListItem', position: 2, name: 'Reparaturanfrage', item: 'https://www.mcrepair.de/repair-request' },
      ],
    },
    publisher: {
      '@type': 'Organization',
      '@id': 'https://www.mcrepair.de/#business',
      name: 'McRepair.de',
    },
  },
  /* 2 — Service --------------------------------------------------- */
  {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'Individuelle Reparaturanfrage – Smartphone, Tablet & Laptop',
    serviceType: 'Gerätereparatur',
    provider: {
      '@type': 'LocalBusiness',
      '@id': 'https://www.mcrepair.de/#business',
      name: 'McRepair.de',
      url: 'https://www.mcrepair.de',
    },
    description:
      'Online-Reparaturanfrage für Smartphones (iPhone, Samsung, Huawei, Xiaomi), Tablets und Laptops. Unser Technik-Team prüft jeden individuellen Fall und antwortet innerhalb von 24 Werktags-Stunden mit einer konkreten Ersteinschätzung und einem Kostenvoranschlag.',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'EUR',
      description: 'Kostenlose Ersteinschätzung – keine Registrierung erforderlich, auch als Gast nutzbar',
    },
    areaServed: { '@type': 'Country', name: 'Deutschland' },
    availableChannel: {
      '@type': 'ServiceChannel',
      serviceUrl: 'https://www.mcrepair.de/repair-request',
      serviceType: 'Online-Formular',
    },
    termsOfService: 'https://www.mcrepair.de/terms',
  },
  /* 3 — HowTo ----------------------------------------------------- */
  {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'Reparaturanfrage bei McRepair.de stellen – in 3 Schritten',
    description:
      'So erhalten Sie innerhalb von 24 Werktags-Stunden eine individuelle Einschätzung Ihres Geräteschadens.',
    totalTime: 'PT5M',
    step: [
      {
        '@type': 'HowToStep',
        position: 1,
        name: 'Gerät auswählen',
        text: 'Wählen Sie Ihr Gerät (Smartphone, Tablet oder Laptop) aus unserer Gerätedatenbank oder geben Sie Hersteller und Modellbezeichnung manuell ein. Optional: Modellnummer für präzisere Diagnose.',
      },
      {
        '@type': 'HowToStep',
        position: 2,
        name: 'Problem und Schadenbild beschreiben',
        text: 'Beschreiben Sie den Defekt so genau wie möglich: Was passiert? Wann tritt das Problem auf? Geben Sie an, ob ein Flüssigkeitsschaden vorliegt oder frühere Reparaturversuche stattfanden, und laden Sie optional bis zu 5 Fotos des Schadens hoch.',
      },
      {
        '@type': 'HowToStep',
        position: 3,
        name: 'Anfrage absenden & Antwort erhalten',
        text: 'Nach dem Absenden prüft unser Technik-Team Ihre Anfrage und kontaktiert Sie innerhalb von 24 Werktags-Stunden. Sie erhalten eine Einschätzung des Schadens und, sofern möglich, einen konkreten Kostenvoranschlag per E-Mail. Eine Reparatur beginnt erst nach Ihrer ausdrücklichen Zustimmung.',
      },
    ],
  },
  /* 4 — FAQPage --------------------------------------------------- */
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Kostet die Reparaturanfrage etwas?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Nein. Die Reparaturanfrage und die erste Einschätzung durch unser Team sind vollständig kostenlos. Kosten entstehen erst, wenn Sie einem konkreten Kostenvoranschlag ausdrücklich zustimmen.',
        },
      },
      {
        '@type': 'Question',
        name: 'Wie lange dauert es, bis ich eine Antwort auf meine Reparaturanfrage erhalte?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Unser Team antwortet in der Regel innerhalb von 24 Stunden an Werktagen. Sie erhalten eine E-Mail mit einer ersten Einschätzung und – wenn möglich – einem Kostenvoranschlag.',
        },
      },
      {
        '@type': 'Question',
        name: 'Welche Geräte kann ich zur Reparatur anfragen?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Sie können Reparaturanfragen für Smartphones (z. B. iPhone, Samsung Galaxy, Huawei, Xiaomi), Tablets und Laptops stellen. Für andere Gerätekategorien wählen Sie „Anderes" und beschreiben das Gerät manuell.',
        },
      },
      {
        '@type': 'Question',
        name: 'Muss ich ein Konto erstellen, um eine Reparaturanfrage zu stellen?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Nein. Sie können die Anfrage auch als Gast absenden. In diesem Fall erhalten Sie einen persönlichen Tracking-Link per E-Mail, über den Sie den Status Ihrer Anfrage jederzeit einsehen können.',
        },
      },
      {
        '@type': 'Question',
        name: 'Kann ich Fotos des Schadens mit der Anfrage hochladen?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Ja, Sie können bis zu 5 Fotos (JPG, PNG oder GIF, max. 5 MB pro Bild) hochladen. Bilder helfen unserem Team, den Schaden bereits vorab präziser einzuschätzen und schneller zu antworten.',
        },
      },
      {
        '@type': 'Question',
        name: 'Was passiert, nachdem ich die Reparaturanfrage abgesendet habe?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Unser Technik-Team prüft Ihre Anfrage und kontaktiert Sie innerhalb von 24 Werktags-Stunden mit einer Einschätzung und, falls möglich, einem Kostenvoranschlag. Die Reparatur wird erst nach Ihrer ausdrücklichen Zustimmung durchgeführt.',
        },
      },
      {
        '@type': 'Question',
        name: 'Was soll ich angeben, wenn mein Gerät nicht in der Datenbank ist?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Kein Problem – wählen Sie den Gerätetyp (Smartphone, Tablet, Laptop oder Anderes) und geben Sie Hersteller, Modellbezeichnung und – besonders bei Laptops – die Modellnummer manuell ein. Unser Team kann so die passende Einschätzung vornehmen.',
        },
      },
      {
        '@type': 'Question',
        name: 'Ist die Reparatur garantiert?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Alle bei McRepair.de durchgeführten Reparaturen sind mit 12 Monaten Garantie auf Teile und Arbeit abgesichert.',
        },
      },
    ],
  },
]

export function RepairRequestQuestionnaire() {
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()
  const { isAuthenticated } = useAuth()
  const [showAuthDialog, setShowAuthDialog] = useState(false)
  const [pendingSubmit, setPendingSubmit] = useState(false)

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
    const originState = location.state?.repairRequestOrigin as {
      selectedRepairCategory?: string | null
      selectedServiceId?: string
      selectedServiceName?: string
    } | undefined

    let persistedBackContext: {
      selectedRepairCategory?: string | null
      selectedServiceId?: string
      selectedServiceName?: string
    } = {}

    try {
      const rawBackContext = sessionStorage.getItem("repairRequestBackContext")
      if (rawBackContext) {
        persistedBackContext = JSON.parse(rawBackContext)
      }
    } catch {
      persistedBackContext = {}
    }

    if (selectedDevice?.deviceType && selectedDevice?.manufacturer && selectedDevice?.name) {
      sessionStorage.setItem(
        "navDeviceSelection",
        JSON.stringify({
          deviceType: selectedDevice.deviceType,
          manufacturer: selectedDevice.manufacturer,
          modelName: selectedDevice.name,
          searchQuery: selectedDevice.name,
          selectedRepairCategory: originState?.selectedRepairCategory ?? persistedBackContext.selectedRepairCategory ?? null,
          selectedServiceId: originState?.selectedServiceId ?? persistedBackContext.selectedServiceId,
          selectedServiceName: originState?.selectedServiceName ?? persistedBackContext.selectedServiceName,
        })
      )
      sessionStorage.setItem("navConfiguratorStep", "3")
    }
    sessionStorage.removeItem("repairRequestBackContext")
    navigate("/#repair-order-configurator")
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

  const doSubmitRequest = async () => {
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

  const doSubmitGuestRequest = async (guestInfo: GuestInfo) => {
    const isDbDevice = !editingDevice && selectedDevice !== null
    const deviceTypeFinal = isDbDevice ? selectedDevice!.deviceType : manualDeviceType
    const deviceBrandFinal = isDbDevice ? selectedDevice!.manufacturer : manualDeviceName.split(" ")[0]
    const deviceModelFinal = isDbDevice ? selectedDevice!.name : manualDeviceName
    const deviceModelIdFinal = isDbDevice ? selectedDevice!._id : ""
    const modelNumberFinal = isDbDevice ? "" : manualModelNumber

    try {
      setSubmitting(true)
      const result = await createGuestRepairRequest(guestInfo, {
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
        title: "Reparaturanfrage eingegangen!",
        description: "Wir haben Ihre Anfrage erhalten. Ein Tracking-Link wurde an Ihre E-Mail gesendet.",
      })
      navigate(`/guest-repair-tracking?token=${result.guestTrackingToken}&email=${encodeURIComponent(guestInfo.email)}`)
    } catch (error: any) {
      toast({ title: "Fehler", description: error.message || "Reparaturanfrage konnte nicht übermittelt werden.", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const handleAuthSuccess = () => {
    if (pendingSubmit) {
      setPendingSubmit(false)
      doSubmitRequest()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return
    if (!isAuthenticated) {
      setPendingSubmit(true)
      setShowAuthDialog(true)
      return
    }
    doSubmitRequest()
  }

  const cardShellClass = "border border-slate-200/90 bg-white/95 shadow-[0_14px_42px_-24px_rgba(15,23,42,0.55)]"
  const formControlClass = "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:border-[#1a2a5e] focus-visible:ring-[#1a2a5e]/20"
  const deviceReady = !editingDevice && (!!selectedDevice || !!manualDeviceName.trim())
  const descriptionReady = issueDescription.trim().length >= 20
  const uploadReady = images.length > 0

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_-10%,rgba(245,184,0,0.16),transparent_42%),radial-gradient(circle_at_100%_0%,rgba(26,42,94,0.2),transparent_48%),linear-gradient(180deg,#f8fbff_0%,#eef3fb_42%,#f5f8fe_100%)]">
      <SEO
        title="Reparaturanfrage stellen – Smartphone, Tablet & Laptop | McRepair.de"
        description="Reparaturanfrage für Smartphone, Tablet oder Laptop online stellen – kostenlos & unverbindlich. Antwort innerhalb von 24 Stunden. Alle Marken: Apple, Samsung, Huawei, Xiaomi u. v. m."
        canonical="/repair-request"
        keywords="Reparaturanfrage, Handy reparieren lassen, Smartphone Reparatur anfragen, iPhone Reparatur Anfrage, Samsung Reparatur, Tablet Reparatur, Laptop Reparatur anfragen, Gerätereparatur Anfrage, Reparaturservice online, Kostenvoranschlag Reparatur, McRepair Reparatur"
        jsonLd={repairRequestJsonLd}
      />
      {/* Hero Banner */}
      <section aria-label="Reparaturanfrage – Übersicht" className="relative overflow-hidden border-b border-white/20 bg-[linear-gradient(132deg,#1a2a5e_0%,#21408e_54%,#2e5cc1_100%)] px-6 py-14 text-white md:px-12 md:py-20">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-12 h-56 w-56 rounded-full bg-yellow-300/15 blur-3xl" />

        <div className="relative z-10 mx-auto max-w-6xl text-center">
          <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-50">
              <ShieldCheck className="h-3.5 w-3.5" /> McRepair Service
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-yellow-200/40 bg-yellow-300/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-yellow-100">
              <Clock3 className="h-3.5 w-3.5" /> Antwort in 24h*
            </span>
          </div>
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
          <p className="mx-auto mt-5 max-w-3xl text-base leading-7 text-blue-100 md:text-lg">
            Manche Defekte erfordern individuelle Begutachtung. Bei McRepair.de ist das kein Problem:
            schildern Sie uns Ihr Problem, und Sie erhalten innerhalb von 24 Stunden* eine Rückmeldung.
          </p>
          <p className="mt-3 text-sm font-medium text-blue-200/80">* werktags</p>
        </div>
      </section>

      <form onSubmit={handleSubmit} aria-label="Reparaturanfrage Formular" className="mx-auto grid w-full max-w-6xl gap-6 px-6 py-10 md:px-12 md:py-14 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">

        {/* Card 1: Device */}
        <Card className={cardShellClass}>
          <CardHeader className="border-b border-slate-100/80 pb-4">
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
                    className={`${formControlClass} ${errors.manualDeviceName ? "border-red-500 focus-visible:ring-red-200" : ""}`}
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
                    className={formControlClass}
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
        <Card className={cardShellClass}>
          <CardHeader className="border-b border-slate-100/80 pb-4">
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
                className={`min-h-[140px] ${formControlClass} ${errors.issueDescription ? "border-red-500 focus-visible:ring-red-200" : ""}`}
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
                className={formControlClass}
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
                  className={`min-h-[80px] ${formControlClass}`}
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
        </div>

        <aside className="h-fit xl:sticky xl:top-24">
          <Card className="border border-[#1a2a5e]/10 bg-white/95 shadow-[0_14px_40px_-24px_rgba(26,42,94,0.45)]">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg font-extrabold text-[#1a2a5e]">
                <Eye className="h-5 w-5" /> Ihr Anfrage-Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
                Alle wichtigen Informationen sind hier auf einen Blick sichtbar. Unvollständige Punkte werden markiert.
              </div>

              <div className={`rounded-xl border px-3 py-2.5 text-sm ${deviceReady ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
                <p className="font-semibold">Gerät</p>
                <p>{deviceReady ? "Vollständig" : "Bitte Gerät auswählen oder manuell ergänzen"}</p>
              </div>

              <div className={`rounded-xl border px-3 py-2.5 text-sm ${descriptionReady ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
                <p className="font-semibold">Fehlerbeschreibung</p>
                <p>{descriptionReady ? "Ausreichend detailliert" : "Mindestens 20 Zeichen für schnellere Bearbeitung"}</p>
              </div>

              <div className={`rounded-xl border px-3 py-2.5 text-sm ${uploadReady ? "border-blue-200 bg-blue-50 text-blue-900" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
                <p className="font-semibold">Bilder</p>
                <p>{uploadReady ? `${images.length} Bild(er) hinzugefügt` : "Optional, aber hilfreich für die Vorabprüfung"}</p>
              </div>

              <div className="rounded-xl border border-[#1a2a5e]/10 bg-[#1a2a5e]/5 px-3 py-3 text-sm text-[#1a2a5e]">
                <p className="font-semibold">Tipp von McRepair</p>
                <p>Je genauer die Angaben, desto schneller erhalten Sie eine präzise Ersteinschätzung.</p>
              </div>
            </CardContent>
          </Card>
        </aside>
      </form>

      {/* ── SEO content: How it works ── */}
      <section
        aria-label="So funktioniert Ihre Reparaturanfrage"
        className="border-t border-slate-200/60 bg-white/70 px-6 py-14 md:px-12"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 text-center">
            <span
              className="mb-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider"
              style={{ borderColor: "rgba(26,42,94,0.18)", color: "#1a2a5e", background: "rgba(26,42,94,0.05)" }}
            >
              <Wrench className="h-3.5 w-3.5" /> Ablauf
            </span>
            <h2 className="text-2xl font-extrabold tracking-tight text-[#1a2a5e] md:text-3xl">
              So funktioniert Ihre Reparaturanfrage
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-600 md:text-base">
              In nur drei Schritten erhalten Sie von unserem Technik-Team eine individuelle Einschätzung
              und einen konkreten Kostenvoranschlag – kostenlos und unverbindlich.
            </p>
          </div>

          <ol className="grid gap-6 sm:grid-cols-3" aria-label="Reparaturanfrage Schritte">
            {[
              {
                step: 1,
                icon: Smartphone,
                title: "Gerät auswählen",
                desc: "Wählen Sie Ihr Smartphone, Tablet oder Laptop aus unserer Gerätedatenbank, oder geben Sie Hersteller und Modell manuell ein. Alle Marken werden akzeptiert: Apple iPhone, Samsung Galaxy, Huawei, Xiaomi, Lenovo, HP u. v. m.",
              },
              {
                step: 2,
                icon: Edit2,
                title: "Problem beschreiben",
                desc: "Schildern Sie den Defekt so genau wie möglich: Was passiert? Wann tritt es auf? Geben Sie optional an, ob ein Flüssigkeitsschaden vorliegt oder Vorrepara­turen stattfanden, und laden Sie bis zu 5 Fotos des Schadens hoch.",
              },
              {
                step: 3,
                icon: ShieldCheck,
                title: "Antwort in 24 Stunden*",
                desc: "Unser Team prüft Ihre Anfrage und antwortet innerhalb von 24 Werktags-Stunden mit einer ersten Einschätzung und – sofern möglich – einem Kostenvoranschlag. Die Reparatur beginnt erst nach Ihrer ausdrücklichen Zustimmung.",
              },
            ].map(({ step, icon: Icon, title, desc }) => (
              <li
                key={step}
                className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div
                  className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl text-white text-sm font-extrabold"
                  style={{ background: "linear-gradient(135deg,#1a2a5e 0%,#2f57b0 100%)" }}
                  aria-hidden="true"
                >
                  {step}
                </div>
                <Icon className="mb-3 h-5 w-5" style={{ color: "#1a2a5e" }} aria-hidden="true" />
                <h3 className="mb-2 text-base font-bold text-[#1a2a5e]">{title}</h3>
                <p className="text-sm leading-6 text-slate-600">{desc}</p>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-center text-xs text-slate-400">* werktags</p>
        </div>
      </section>

      {/* ── SEO content: Trust signals ── */}
      <section
        aria-label="Vorteile der McRepair Reparaturanfrage"
        className="border-t border-slate-200/60 bg-[#f8fbff] px-6 py-10 md:px-12"
      >
        <div className="mx-auto max-w-6xl">
          <ul className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Vorteile">
            {[
              { icon: CheckCircle, title: "100 % kostenlos & unverbindlich", desc: "Die Anfrage und Ersteinschätzung sind völlig gratis. Kosten entstehen erst nach Ihrer Zustimmung zum Kostenvoranschlag." },
              { icon: Clock3, title: "Antwort innerhalb von 24 h*", desc: "Unser Technik-Team meldet sich werktags innerhalb von 24 Stunden mit einer konkreten Einschätzung." },
              { icon: Star, title: "12 Monate Garantie", desc: "Alle durchgeführten Reparaturen sind mit 12 Monaten Garantie auf Teile und Arbeitsleistung abgesichert." },
              { icon: MessageSquare, title: "Auch als Gast nutzbar", desc: "Keine Registrierung nötig. Als Gast erhalten Sie einen persönlichen Tracking-Link per E-Mail." },
            ].map(({ icon: Icon, title, desc }) => (
              <li key={title} className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <span
                  className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: "rgba(26,42,94,0.07)", color: "#1a2a5e" }}
                  aria-hidden="true"
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-bold text-[#1a2a5e]">{title}</p>
                  <p className="mt-0.5 text-xs leading-5 text-slate-600">{desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── SEO content: FAQ ── */}
      <section
        aria-label="Häufige Fragen zur Reparaturanfrage"
        className="border-t border-slate-200/60 bg-white px-6 py-14 md:px-12"
      >
        <div className="mx-auto max-w-4xl">
          <div className="mb-10 text-center">
            <span
              className="mb-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider"
              style={{ borderColor: "rgba(26,42,94,0.18)", color: "#1a2a5e", background: "rgba(26,42,94,0.05)" }}
            >
              <HelpCircle className="h-3.5 w-3.5" /> FAQ
            </span>
            <h2 className="text-2xl font-extrabold tracking-tight text-[#1a2a5e] md:text-3xl">
              Häufige Fragen zur Reparaturanfrage
            </h2>
          </div>

          <dl className="space-y-5">
            {[
              {
                q: "Kostet die Reparaturanfrage etwas?",
                a: "Nein. Die Reparaturanfrage und die erste Einschätzung durch unser Team sind vollständig kostenlos und unverbindlich. Kosten entstehen erst, wenn Sie einem konkreten Kostenvoranschlag ausdrücklich zustimmen.",
              },
              {
                q: "Wie lange dauert es, bis ich eine Antwort erhalte?",
                a: "Unser Technik-Team antwortet in der Regel innerhalb von 24 Stunden an Werktagen. Sie erhalten eine E-Mail mit einer ersten Einschätzung und – wenn möglich – einem Kostenvoranschlag.",
              },
              {
                q: "Welche Geräte kann ich zur Reparatur anfragen?",
                a: 'Sie können Anfragen für Smartphones (z. B. Apple iPhone, Samsung Galaxy, Huawei, Xiaomi), Tablets und Laptops stellen. Für andere Gerätekategorien wählen Sie \u201EAnderes\u201C und beschreiben das Gerät manuell.',
              },
              {
                q: "Muss ich ein Konto erstellen?",
                a: "Nein. Sie können die Anfrage als registrierter Nutzer oder als Gast absenden. Als Gast erhalten Sie einen persönlichen Tracking-Link per E-Mail, über den Sie den Status Ihrer Anfrage jederzeit einsehen können.",
              },
              {
                q: "Kann ich Fotos des Schadens hochladen?",
                a: "Ja, Sie können bis zu 5 Fotos (JPG, PNG oder GIF, max. 5 MB pro Bild) hochladen. Bilder helfen unserem Team, den Schaden bereits vorab präziser einzuschätzen und schneller zu antworten.",
              },
              {
                q: "Was passiert, wenn mein Gerät nicht in der Datenbank ist?",
                a: "Kein Problem. Wählen Sie den passenden Gerätetyp (Smartphone, Tablet, Laptop oder Anderes) und geben Sie Hersteller sowie Modellbezeichnung manuell ein. Bei Laptops ist auch die Modellnummer hilfreich.",
              },
              {
                q: "Ist die Reparatur garantiert?",
                a: "Alle bei McRepair.de durchgeführten Reparaturen sind mit 12 Monaten Garantie auf Teile und Arbeitsleistung abgesichert.",
              },
            ].map(({ q, a }) => (
              <div
                key={q}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-6 py-5"
                itemScope
                itemType="https://schema.org/Question"
              >
                <dt className="text-sm font-bold text-[#1a2a5e] md:text-base" itemProp="name">{q}</dt>
                <dd
                  className="mt-2 text-sm leading-6 text-slate-600"
                  itemScope
                  itemType="https://schema.org/Answer"
                  itemProp="acceptedAnswer"
                >
                  <span itemProp="text">{a}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* DB Selection Dialog */}
      <Dialog open={showDeviceDialog} onOpenChange={setShowDeviceDialog}>
        <DialogContent className="border-slate-200 bg-white sm:max-w-[580px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl text-[#1a2a5e]">
              <Database className="h-5 w-5" />
              Gerät aus Datenbank wählen
            </DialogTitle>
            <DialogDescription className="text-slate-600">
              Suchen Sie Ihr Gerät in unserer Gerätedatenbank
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">
                1. Gerätetyp <span className="text-red-500">*</span>
              </label>
              <Select value={selectedDeviceType} onValueChange={handleDbDeviceTypeChange}>
                <SelectTrigger className={`w-full ${formControlClass}`}>
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
                <SelectTrigger className={`w-full ${formControlClass}`}>
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
                <SelectTrigger className={`w-full ${formControlClass}`}>
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
            <Button variant="outline" className="border-slate-300 text-slate-700" onClick={() => setShowDeviceDialog(false)}>
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
      <AuthRequiredDialog
        open={showAuthDialog}
        onOpenChange={(open) => {
          setShowAuthDialog(open)
          if (!open) setPendingSubmit(false)
        }}
        onSuccess={handleAuthSuccess}
        onGuestProceed={(guestInfo) => {
          setPendingSubmit(false)
          doSubmitGuestRequest(guestInfo)
        }}
        showGuestTab
        title="Authentifizierung erforderlich"
        description="Melden Sie sich an, erstellen Sie ein Konto oder fahren Sie als Gast fort, um Ihre Reparaturanfrage abzusenden."
      />
    </div>
  )
}
