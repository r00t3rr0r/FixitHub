import { useEffect, useMemo, useState } from "react"
import {
  getDeviceTypes,
  getManufacturersByDeviceType,
  getModelsByTypeAndManufacturer,
  DeviceType as ApiDeviceType,
  Manufacturer,
  DeviceModel,
} from "@/api/devices"
import { Input } from "@/components/ui/input"
import { AlertCircle, CheckCircle, HelpCircle, Loader2, RefreshCw, Search } from "lucide-react"

export interface PickedCatalogDevice {
  _id: string
  name: string
  deviceType: string // Anzeigename (z. B. "Smartphone")
  deviceTypeKey: string // Katalogschlüssel (z. B. "smartphone")
  manufacturer: string
  manufacturerId: string
  image?: string
}

export interface CantFindPrefill {
  deviceType?: string
  brand?: string
}

interface CatalogDevicePickerProps {
  /** Modell gewählt => sofort übernommen (kein zusätzlicher Bestätigen-Klick). */
  onSelect: (device: PickedCatalogDevice) => void
  /** "Mein Gerät ist nicht aufgeführt" – ohne Handler wird der Link nicht gezeigt. */
  onCantFind?: (prefill: CantFindPrefill) => void
  cantFindLabel?: string
  /** Kompakte Darstellung (z. B. im Admin-Dialog). */
  compact?: boolean
  disabled?: boolean
  selectedModelId?: string | null
}

type LoadState = "idle" | "loading" | "ready" | "error"

const chipClass = (active: boolean) =>
  `rounded-full border px-4 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1a2a5e]/40 ${
    active
      ? "border-transparent bg-[#1a2a5e] text-white shadow"
      : "border-slate-300 bg-white text-[#1a2a5e] hover:bg-slate-50"
  }`

/**
 * Inline-Katalogauswahl in drei Schritten: 1. Gerätetyp (Chips aus dem Katalog), 2. Marke,
 * 3. Modell (mit Suche). Laden, leer und Fehler sind getrennte Zustände mit eigenen Texten.
 */
export function CatalogDevicePicker({
  onSelect,
  onCantFind,
  cantFindLabel = "Mein Gerät ist nicht aufgeführt",
  compact = false,
  disabled = false,
  selectedModelId = null,
}: CatalogDevicePickerProps) {
  const [types, setTypes] = useState<ApiDeviceType[]>([])
  const [typesState, setTypesState] = useState<LoadState>("idle")
  const [typeKey, setTypeKey] = useState("")

  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [manufacturersState, setManufacturersState] = useState<LoadState>("idle")
  const [manufacturerId, setManufacturerId] = useState("")

  const [models, setModels] = useState<DeviceModel[]>([])
  const [modelsState, setModelsState] = useState<LoadState>("idle")
  const [search, setSearch] = useState("")

  const loadTypes = async () => {
    setTypesState("loading")
    try {
      const res: any = await getDeviceTypes()
      const list: ApiDeviceType[] = (res?.deviceTypes || []).filter((t: ApiDeviceType) => Number(t.count || 0) > 0)
      setTypes(list)
      setTypesState("ready")
    } catch {
      setTypesState("error")
    }
  }

  useEffect(() => {
    loadTypes()
  }, [])

  const loadManufacturers = async (key: string) => {
    setManufacturersState("loading")
    setManufacturers([])
    try {
      const res: any = await getManufacturersByDeviceType(key)
      setManufacturers(res?.manufacturers || [])
      setManufacturersState("ready")
    } catch {
      setManufacturersState("error")
    }
  }

  const loadModels = async (key: string, mfrId: string) => {
    setModelsState("loading")
    setModels([])
    try {
      const res: any = await getModelsByTypeAndManufacturer(key, mfrId, { lite: true })
      setModels(res?.models || [])
      setModelsState("ready")
    } catch {
      setModelsState("error")
    }
  }

  const chooseType = (key: string) => {
    if (disabled) return
    setTypeKey(key)
    setManufacturerId("")
    setModels([])
    setModelsState("idle")
    setSearch("")
    loadManufacturers(key)
  }

  const chooseManufacturer = (id: string) => {
    if (disabled) return
    setManufacturerId(id)
    setSearch("")
    if (id && typeKey) loadModels(typeKey, id)
  }

  const typeName = types.find((t) => t._id === typeKey)?.name || ""
  const manufacturerName = manufacturers.find((m) => m._id === manufacturerId)?.name || ""

  const visibleModels = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return models
    return models.filter((m) => {
      const hay = [m.name, ...(m.synonyms || []), ...(m.modelNumbers || [])].join(" ").toLowerCase()
      return hay.includes(q)
    })
  }, [models, search])

  const chooseModel = (model: DeviceModel) => {
    if (disabled) return
    onSelect({
      _id: model._id,
      name: model.name,
      deviceType: typeName || typeKey,
      deviceTypeKey: typeKey,
      manufacturer: manufacturerName,
      manufacturerId,
      image: model.image,
    })
  }

  const cantFind = () => onCantFind?.({ deviceType: typeName || undefined, brand: manufacturerName || undefined })

  const stepLabel = "text-sm font-semibold text-slate-800"
  const selectClass =
    "h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-[#1a2a5e] focus:outline-none focus:ring-2 focus:ring-[#1a2a5e]/20 disabled:cursor-not-allowed disabled:bg-slate-50"

  const CantFindLink = onCantFind ? (
    <button
      type="button"
      onClick={cantFind}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1a2a5e] underline decoration-[#f5b800] decoration-2 underline-offset-4 hover:text-[#2f57b0]"
    >
      <HelpCircle className="h-4 w-4" aria-hidden="true" /> {cantFindLabel}
    </button>
  ) : null

  return (
    <div className={compact ? "space-y-3" : "space-y-5"}>
      {/* 1. Gerätetyp */}
      <div className="space-y-2">
        <p className={stepLabel}>1. Gerätetyp</p>
        {typesState === "loading" || typesState === "idle" ? (
          <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Wird geladen …</p>
        ) : typesState === "error" ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4" /> Gerätetypen konnten nicht geladen werden.
            <button type="button" onClick={loadTypes} className="inline-flex items-center gap-1 font-semibold underline">
              <RefreshCw className="h-3.5 w-3.5" /> Erneut versuchen
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Gerätetyp">
            {types.map((type) => (
              <button
                key={type._id}
                type="button"
                className={chipClass(typeKey === type._id)}
                aria-pressed={typeKey === type._id}
                onClick={() => chooseType(type._id)}
                disabled={disabled}
              >
                {type.name}
              </button>
            ))}
            {onCantFind && (
              <button type="button" className={chipClass(false)} onClick={() => onCantFind({ deviceType: "Anderes" })} disabled={disabled}>
                Anderes Gerät
              </button>
            )}
            {types.length === 0 && <p className="text-sm text-slate-500">Noch keine Gerätetypen im Katalog.</p>}
          </div>
        )}
      </div>

      {/* 2. Marke */}
      {typeKey && (
        <div className="space-y-2">
          <label htmlFor="catalog-picker-brand" className={stepLabel}>2. Marke</label>
          {manufacturersState === "loading" ? (
            <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Wird geladen …</p>
          ) : manufacturersState === "error" ? (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertCircle className="h-4 w-4" /> Marken konnten nicht geladen werden.
              <button type="button" onClick={() => loadManufacturers(typeKey)} className="inline-flex items-center gap-1 font-semibold underline">
                <RefreshCw className="h-3.5 w-3.5" /> Erneut versuchen
              </button>
            </div>
          ) : manufacturers.length === 0 ? (
            <p className="text-sm text-slate-600">Für diesen Gerätetyp sind noch keine Marken hinterlegt.</p>
          ) : (
            <select
              id="catalog-picker-brand"
              className={selectClass}
              value={manufacturerId}
              onChange={(e) => chooseManufacturer(e.target.value)}
              disabled={disabled}
            >
              <option value="">Marke wählen …</option>
              {manufacturers.map((m) => (
                <option key={m._id} value={m._id}>{m.name}</option>
              ))}
            </select>
          )}
          {!manufacturerId && CantFindLink}
        </div>
      )}

      {/* 3. Modell */}
      {typeKey && manufacturerId && (
        <div className="space-y-2">
          <label htmlFor="catalog-picker-model-search" className={stepLabel}>3. Modell</label>
          {modelsState === "loading" ? (
            <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Wird geladen …</p>
          ) : modelsState === "error" ? (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertCircle className="h-4 w-4" /> Modelle konnten nicht geladen werden.
              <button type="button" onClick={() => loadModels(typeKey, manufacturerId)} className="inline-flex items-center gap-1 font-semibold underline">
                <RefreshCw className="h-3.5 w-3.5" /> Erneut versuchen
              </button>
            </div>
          ) : models.length === 0 ? (
            <p className="text-sm text-slate-600">Für diese Marke sind noch keine Modelle hinterlegt.</p>
          ) : (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="catalog-picker-model-search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Modell suchen …"
                  className="h-11 pl-9"
                  disabled={disabled}
                  autoComplete="off"
                />
              </div>
              <div
                className={`overflow-y-auto rounded-lg border border-slate-200 bg-white ${compact ? "max-h-48" : "max-h-64"}`}
                role="listbox"
                aria-label="Modelle"
              >
                {visibleModels.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-slate-500">Kein Modell passt zu „{search}“.</p>
                ) : (
                  visibleModels.map((model) => {
                    const active = selectedModelId === model._id
                    return (
                      <button
                        key={model._id}
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => chooseModel(model)}
                        disabled={disabled}
                        className={`flex w-full items-center gap-3 border-b border-slate-100 px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none ${active ? "bg-blue-50 font-semibold" : ""}`}
                      >
                        {model.image ? (
                          <img src={model.image} alt="" className="h-7 w-7 shrink-0 object-contain" onError={(e) => (e.currentTarget.style.display = "none")} />
                        ) : (
                          <span className="h-7 w-7 shrink-0" />
                        )}
                        <span className="flex-1 text-slate-900">{model.name}</span>
                        {active ? <CheckCircle className="h-4 w-4 text-emerald-600" aria-hidden="true" /> : <span className="text-xs font-semibold text-[#1a2a5e]">Auswählen</span>}
                      </button>
                    )
                  })
                )}
              </div>
            </>
          )}
          {CantFindLink}
        </div>
      )}
    </div>
  )
}
