import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Camera,
  CheckCircle2,
  CircleDollarSign,
  Lock,
  MessageSquareText,
  Package,
  Shield,
  Smartphone,
  Wrench,
  Zap,
} from "lucide-react"

type RepairOrderLike = {
  _id: string
  deviceType?: string
  deviceBrand?: string
  deviceModel?: string
  deviceImage?: string
  services?: any[]
  serviceNames?: string[]
  addOns?: any[]
  customerNotes?: string
  photos?: string[]
  totalCost?: number
  unlockPattern?: string[]
  unlockCode?: string
  noLock?: boolean
}

interface RepairOrderDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: RepairOrderLike | null
  quantity?: number
}

const getDeviceLabel = (order: RepairOrderLike | null) => {
  if (!order) return "Reparaturauftrag"
  return [order.deviceBrand, order.deviceModel].filter(Boolean).join(" ") || order.deviceType || "Reparaturauftrag"
}

const getServiceLabels = (services?: any[]) => {
  if (!Array.isArray(services)) return []
  return services
    .map((service) => {
      if (typeof service === "string") return service
      if (service?.name) return service.name
      if (service?.title) return service.title
      if (service?.label) return service.label
      return null
    })
    .filter(Boolean)
}

const getAddOnEntries = (addOns?: any[]) => {
  if (!Array.isArray(addOns)) return []
  return addOns
    .map((addOn) => {
      if (typeof addOn === "string") {
        return { name: addOn, price: null as number | null, description: "" }
      }

      return {
        name: addOn?.name || addOn?.title || "Extra",
        price: typeof addOn?.price === "number" ? addOn.price : null,
        description: addOn?.description || "",
      }
    })
    .filter((entry) => entry.name)
}

const getUnlockValue = (order: RepairOrderLike) => {
  if (order.noLock) return "Kein Sperrcode hinterlegt"
  if (order.unlockCode) return `Code: ${order.unlockCode}`
  if (Array.isArray(order.unlockPattern) && order.unlockPattern.length > 0) {
    return `Muster: ${order.unlockPattern.join(" → ")}`
  }
  return "Keine Angabe"
}

export function RepairOrderDetailsDialog({
  open,
  onOpenChange,
  order,
  quantity = 1,
}: RepairOrderDetailsDialogProps) {
  const serviceLabels = Array.isArray(order?.serviceNames) && order.serviceNames.length > 0
    ? order.serviceNames.filter(Boolean)
    : getServiceLabels(order?.services)
  const addOnEntries = getAddOnEntries(order?.addOns)
  const primaryImage = order?.deviceImage || order?.photos?.[0] || null
  const deviceLabel = getDeviceLabel(order)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-12px)] sm:max-w-3xl max-h-[92dvh] gap-0 overflow-hidden border-0 bg-white p-0 shadow-2xl [&>button]:text-[#f5b800] [&>button]:opacity-100 [&>button:hover]:text-[#f5b800]">
        <DialogHeader className="gap-2 bg-[#1a2a5e] px-3 py-3 text-left sm:px-6 sm:py-5">
          <div className="flex items-start justify-between gap-3 pr-7 sm:gap-4 sm:pr-8">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-0 bg-white/14 px-2 py-0.5 text-[11px] font-semibold text-white shadow-none">
                  <Wrench className="mr-1 h-3 w-3" />
                  Reparaturauftrag
                </Badge>
                {quantity > 1 && (
                  <Badge className="border-0 bg-[#f5b800] px-2 py-0.5 text-[11px] font-bold text-[#1a2a5e] shadow-none">
                    <Package className="mr-1 h-3 w-3" />
                    {quantity} identische Aufträge
                  </Badge>
                )}
              </div>
              <DialogTitle className="text-sm font-bold tracking-tight sm:text-[1.35rem]" style={{ color: "#f5b800" }}>
                {deviceLabel}
              </DialogTitle>
              <DialogDescription className="text-xs leading-5 text-blue-100 sm:text-sm">
                Alle Angaben zum Reparaturauftrag in kompakter Übersicht.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {order && (
          <div className="max-h-[82dvh] overflow-y-auto px-2.5 py-2.5 sm:px-6 sm:py-5">
            <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
              <div className="space-y-3">
                <div className="overflow-hidden rounded-xl border border-[#d8dce6] bg-[#eef3fb]">
                  {primaryImage ? (
                    <img
                      src={primaryImage}
                      alt={deviceLabel}
                      className="h-36 w-full bg-[#eef3fb] p-2.5 object-contain sm:h-44 sm:p-3"
                      onError={(event) => {
                        event.currentTarget.style.display = "none"
                        const placeholder = event.currentTarget.nextElementSibling as HTMLElement | null
                        placeholder?.classList.remove("hidden")
                      }}
                    />
                  ) : null}
                  <div className={`${primaryImage ? "hidden" : "flex"} h-36 items-center justify-center sm:h-44`}>
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1a2a5e] shadow-sm sm:h-20 sm:w-20">
                      <Smartphone className="h-8 w-8 text-white sm:h-10 sm:w-10" />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-[#d8dce6] bg-[#f8f9fc] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#636e85]">
                      <CircleDollarSign className="h-3.5 w-3.5 text-[#1a2a5e]" />
                      Gesamtpreis
                    </span>
                    <span className="text-lg font-bold text-[#1a2a5e]">
                      {((order.totalCost || 0) * quantity).toFixed(2)} €
                    </span>
                  </div>
                  {quantity > 1 && (
                    <p className="mt-1 text-[11px] text-[#636e85]">
                      {(order.totalCost || 0).toFixed(2)} € pro Auftrag
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <section className="rounded-xl border border-[#d8dce6] bg-white">
                  <div className="border-b border-[#d8dce6] bg-[#1a2a5e] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white">
                    Gerätedaten
                  </div>
                  <div className="grid gap-2 px-3 py-3 sm:grid-cols-3">
                    <div className="rounded-lg bg-[#f8f9fc] px-3 py-2">
                      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#636e85]">Gerätetyp</p>
                      <p className="mt-1 text-sm font-semibold text-[#1a2a5e]">{order.deviceType || "-"}</p>
                    </div>
                    <div className="rounded-lg bg-[#f8f9fc] px-3 py-2">
                      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#636e85]">Marke</p>
                      <p className="mt-1 text-sm font-semibold text-[#1a2a5e]">{order.deviceBrand || "-"}</p>
                    </div>
                    <div className="rounded-lg bg-[#f8f9fc] px-3 py-2">
                      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#636e85]">Modell</p>
                      <p className="mt-1 text-sm font-semibold text-[#1a2a5e]">{order.deviceModel || "-"}</p>
                    </div>
                  </div>
                </section>

                <section className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-[#d8dce6] bg-white">
                    <div className="border-b border-[#d8dce6] bg-[#1a2a5e] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white">
                      Serviceleistungen
                    </div>
                    <div className="space-y-2 px-3 py-3">
                      {serviceLabels.length > 0 ? (
                        serviceLabels.map((service, index) => (
                          <div key={`${service}-${index}`} className="flex items-start gap-2 rounded-lg bg-[#f8f9fc] px-3 py-2">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#38a169]" />
                            <span className="text-sm leading-5 text-[#1a2a5e]">{service}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-[#636e85]">Keine Services hinterlegt.</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#d8dce6] bg-white">
                    <div className="border-b border-[#d8dce6] bg-[#1a2a5e] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white">
                      Extras
                    </div>
                    <div className="space-y-2 px-3 py-3">
                      {addOnEntries.length > 0 ? (
                        addOnEntries.map((addOn, index) => (
                          <div key={`${addOn.name}-${index}`} className="rounded-lg bg-[#f8f9fc] px-3 py-2">
                            <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
                              <span className="flex items-center gap-2 text-xs font-semibold text-[#1a2a5e] sm:text-sm">
                                <Zap className="h-4 w-4 text-[#f5b800]" />
                                {addOn.name}
                              </span>
                              {addOn.price !== null && (
                                <span className="text-xs font-semibold text-[#636e85]">+{addOn.price.toFixed(2)} €</span>
                              )}
                            </div>
                            {addOn.description && (
                              <p className="mt-1 text-xs leading-5 text-[#636e85]">{addOn.description}</p>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-[#636e85]">Keine Extras ausgewählt.</p>
                      )}
                    </div>
                  </div>
                </section>

                <section className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-[#d8dce6] bg-white">
                    <div className="border-b border-[#d8dce6] bg-[#1a2a5e] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white">
                      Hinweise
                    </div>
                    <div className="space-y-3 px-3 py-3">
                      <div className="rounded-lg bg-[#f8f9fc] px-3 py-2.5">
                        <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#636e85]">
                          <MessageSquareText className="h-3.5 w-3.5 text-[#1a2a5e]" />
                          Kundennotiz
                        </p>
                        <p className="text-sm leading-5 text-[#1a2a5e]">
                          {order.customerNotes?.trim() || "Keine zusätzlichen Hinweise angegeben."}
                        </p>
                      </div>
                      <div className="rounded-lg bg-[#f8f9fc] px-3 py-2.5">
                        <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#636e85]">
                          <Shield className="h-3.5 w-3.5 text-[#1a2a5e]" />
                          Zusammenfassung
                        </p>
                        <p className="text-sm leading-5 text-[#1a2a5e]">
                          {serviceLabels.length} Service{serviceLabels.length === 1 ? "" : "s"}
                          {addOnEntries.length > 0 ? `, ${addOnEntries.length} Extra${addOnEntries.length === 1 ? "" : "s"}` : ""}
                          {quantity > 1 ? `, ${quantity} Aufträge` : ""}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#d8dce6] bg-white">
                    <div className="border-b border-[#d8dce6] bg-[#1a2a5e] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white">
                      Sperrbildschirm
                    </div>
                    <div className="px-3 py-3">
                      <div className="rounded-lg bg-[#f8f9fc] px-3 py-2.5">
                        <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#636e85]">
                          <Lock className="h-3.5 w-3.5 text-[#1a2a5e]" />
                          Entsperrinformation
                        </p>
                        <p className="break-all text-sm leading-5 text-[#1a2a5e]">{getUnlockValue(order)}</p>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-xl border border-[#d8dce6] bg-white">
                  <div className="border-b border-[#d8dce6] bg-[#1a2a5e] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white">
                    Bilder
                  </div>
                  <div className="px-3 py-3">
                    {order.photos && order.photos.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {order.photos.map((photo, index) => (
                          <div key={`${photo}-${index}`} className="overflow-hidden rounded-lg border border-[#d8dce6] bg-[#eef3fb]">
                            <img
                              src={photo}
                              alt={`${deviceLabel} Foto ${index + 1}`}
                              className="h-24 w-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 rounded-lg bg-[#f8f9fc] px-3 py-3 text-sm text-[#636e85]">
                        <Camera className="h-4 w-4 text-[#1a2a5e]" />
                        Keine Bilder hinterlegt.
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}