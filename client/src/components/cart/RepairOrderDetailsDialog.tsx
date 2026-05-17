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
      <DialogContent className="w-[calc(100vw-16px)] sm:max-w-5xl max-h-[92dvh] overflow-hidden border-0 bg-white p-0 gap-0 rounded-[20px] sm:rounded-[28px] shadow-[0_24px_80px_rgba(26,42,94,0.32)] [&>button]:top-4 [&>button]:right-4 [&>button]:text-white/80 [&>button]:opacity-100 [&>button:hover]:text-white [&>button]:focus:ring-white/50 [&>button]:ring-offset-transparent">
        {order && (
          <>
            <DialogHeader className="gap-4 bg-gradient-to-r from-[#1a2a5e] via-[#22366f] to-[#2d4a8f] px-4 py-4 text-left sm:px-6 sm:py-5">
              <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="border-0 bg-white/14 px-2.5 py-1 text-[11px] font-semibold text-white shadow-none">
                      <Wrench className="mr-1 h-3.5 w-3.5" />
                      Reparaturauftrag
                    </Badge>
                    {quantity > 1 && (
                      <Badge className="border-0 bg-[#f5b800] px-2.5 py-1 text-[11px] font-bold text-[#1a2a5e] shadow-none">
                        <Package className="mr-1 h-3.5 w-3.5" />
                        {quantity} Aufträge
                      </Badge>
                    )}
                    <Badge className="border-0 bg-[#38a169] px-2.5 py-1 text-[11px] font-semibold text-white shadow-none">
                      <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                      Detaillansicht
                    </Badge>
                  </div>

                  <div className="space-y-1.5">
                    <DialogTitle className="text-xl font-bold tracking-tight !text-[#f5b800] sm:text-[1.65rem]">
                      {deviceLabel}
                    </DialogTitle>
                    <DialogDescription className="max-w-2xl text-sm leading-6 text-blue-100/90">
                      {[order.deviceType, order.deviceBrand, order.deviceModel].filter(Boolean).join(" • ")}
                    </DialogDescription>
                  </div>
                </div>
              </div>
            </DialogHeader>

            <div className="max-h-[calc(92dvh-136px)] overflow-y-auto bg-[linear-gradient(180deg,#f7f9fd_0%,#ffffff_42%)]">
              <div className="grid gap-3 p-2 sm:p-4 lg:grid-cols-[180px_minmax(0,1fr)]">
                {/* Left Column - Device Image and Photos */}
                <div className="space-y-2">
                  <section className="overflow-hidden rounded-[16px] border border-[#d9dfeb] bg-white shadow-[0_8px_16px_rgba(26,42,94,0.06)]">
                    <div className="border-b border-[#e4e8f0] bg-[#f8f9fc] px-2 py-1.5">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#63708a]">Gerät</p>
                    </div>

                    <div className="bg-[radial-gradient(circle_at_top,#eef4ff_0%,#f8f9fc_48%,#ffffff_100%)] p-2">
                      <div className="overflow-hidden rounded-[12px] border border-[#dfe4ee] bg-white shadow-sm">
                        {primaryImage ? (
                          <img
                            src={primaryImage}
                            alt={deviceLabel}
                            className="h-[140px] w-full object-contain p-2 sm:h-[160px]"
                            onError={(event) => {
                              event.currentTarget.style.display = "none"
                              const placeholder = event.currentTarget.nextElementSibling as HTMLElement | null
                              placeholder?.classList.remove("hidden")
                            }}
                          />
                        ) : null}
                        <div className={`${primaryImage ? "hidden" : "flex"} h-[140px] items-center justify-center sm:h-[160px]`}>
                          <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-[#1a2a5e] shadow-sm sm:h-14 sm:w-14">
                            <Smartphone className="h-6 w-6 text-white sm:h-7 sm:w-7" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  {order.photos && order.photos.length > 0 && (
                    <section className="rounded-[16px] border border-[#d9dfeb] bg-white p-2 shadow-[0_8px_16px_rgba(26,42,94,0.06)]">
                      <p className="text-[8px] font-semibold uppercase tracking-[0.1em] text-[#63708a] mb-1">Fotos ({order.photos.length})</p>
                      <div className="grid grid-cols-3 gap-1">
                        {order.photos.slice(0, 3).map((photo, index) => (
                          <button
                            key={`${photo}-${index}`}
                            type="button"
                            className="overflow-hidden rounded-lg border border-[#d9dfeb] bg-[#f8f9fc] hover:border-[#1a2a5e]/30 hover:bg-white transition-all"
                          >
                            <img
                              src={photo}
                              alt={`${deviceLabel} Bild ${index + 1}`}
                              className="h-12 w-full object-cover rounded-md"
                            />
                          </button>
                        ))}
                      </div>
                    </section>
                  )}
                </div>

                {/* Right Column - Information */}
                <div className="space-y-2">
                  {/* Price and Status */}
                  <section className="rounded-[16px] border border-[#d9dfeb] bg-white shadow-[0_8px_16px_rgba(26,42,94,0.06)]">
                    <div className="border-b border-[#e4e8f0] bg-[#f8f9fc] px-2 py-1.5">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#63708a]">Preis</p>
                    </div>

                    <div className="space-y-2 px-2 py-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#63708a]">Gesamt</p>
                          <span className="text-lg font-bold text-[#1a2a5e]">
                            {((order.totalCost || 0) * quantity).toFixed(2)} €
                          </span>
                        </div>
                        <Badge className="border-0 px-2 py-0.5 text-[8px] font-semibold shadow-none bg-[#e8f6ee] text-[#2f855a]">
                          <CheckCircle2 className="mr-0.5 h-2.5 w-2.5" />
                          OK
                        </Badge>
                      </div>

                      {quantity > 1 && (
                        <div className="text-[11px] text-[#636e85] border-t border-[#e4e8f0] pt-1">
                          <p>{(order.totalCost || 0).toFixed(2)} € × {quantity}</p>
                        </div>
                      )}

                      <div className="grid grid-cols-3 gap-1 text-[10px] border-t border-[#e4e8f0] pt-1">
                        <div className="rounded-lg bg-[#f8f9fc] px-1.5 py-1">
                          <p className="text-[8px] font-semibold text-[#63708a] uppercase">Typ</p>
                          <p className="font-semibold text-[#1a2a5e] line-clamp-1">{order.deviceType || "-"}</p>
                        </div>
                        <div className="rounded-lg bg-[#f8f9fc] px-1.5 py-1">
                          <p className="text-[8px] font-semibold text-[#63708a] uppercase">Marke</p>
                          <p className="font-semibold text-[#1a2a5e] line-clamp-1">{order.deviceBrand || "-"}</p>
                        </div>
                        <div className="rounded-lg bg-[#f8f9fc] px-1.5 py-1">
                          <p className="text-[8px] font-semibold text-[#63708a] uppercase">Modell</p>
                          <p className="font-semibold text-[#1a2a5e] line-clamp-1">{order.deviceModel || "-"}</p>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Services */}
                  {serviceLabels.length > 0 && (
                    <section className="rounded-[16px] border border-[#d9dfeb] bg-white shadow-[0_8px_16px_rgba(26,42,94,0.06)]">
                      <div className="border-b border-[#e4e8f0] bg-[#f8f9fc] px-2 py-1.5">
                        <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#63708a]">Services ({serviceLabels.length})</p>
                      </div>

                      <div className="space-y-1 px-2 py-2">
                        {serviceLabels.map((service, index) => (
                          <div
                            key={`${service}-${index}`}
                            className="flex items-start gap-1.5 rounded-lg bg-[#f8f9fc] px-2 py-1"
                          >
                            <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-[#38a169]" />
                            <span className="text-[11px] leading-4 text-[#1a2a5e]">{service}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Extras */}
                  {addOnEntries.length > 0 && (
                    <section className="rounded-[16px] border border-[#d9dfeb] bg-white shadow-[0_8px_16px_rgba(26,42,94,0.06)]">
                      <div className="border-b border-[#e4e8f0] bg-[#f8f9fc] px-2 py-1.5">
                        <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#63708a]">Extras ({addOnEntries.length})</p>
                      </div>

                      <div className="space-y-1 px-2 py-2">
                        {addOnEntries.map((addOn, index) => (
                          <div key={`${addOn.name}-${index}`} className="rounded-lg bg-[#f8f9fc] px-2 py-1">
                            <div className="flex items-start justify-between gap-1">
                              <div className="flex items-start gap-1 flex-1 min-w-0">
                                <Zap className="mt-0.5 h-3 w-3 shrink-0 text-[#f5b800]" />
                                <div className="min-w-0">
                                  <p className="text-[11px] font-semibold text-[#1a2a5e] line-clamp-1">{addOn.name}</p>
                                  {addOn.description && (
                                    <p className="text-[9px] leading-3 text-[#636e85] line-clamp-1">{addOn.description}</p>
                                  )}
                                </div>
                              </div>
                              {addOn.price !== null && (
                                <span className="text-[10px] font-semibold text-[#636e85] flex-shrink-0">+{addOn.price.toFixed(2)} €</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Notes & Lock Info */}
                  {(order.customerNotes?.trim() || getUnlockValue(order) !== "Keine Angabe") && (
                    <section className="rounded-[16px] border border-[#d9dfeb] bg-white shadow-[0_8px_16px_rgba(26,42,94,0.06)]">
                      <div className="border-b border-[#e4e8f0] bg-[#f8f9fc] px-2 py-1.5">
                        <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#63708a]">Hinweise</p>
                      </div>

                      <div className="space-y-1 px-2 py-2">
                        {order.customerNotes?.trim() && (
                          <div className="rounded-lg bg-[#f8f9fc] px-2 py-1">
                            <p className="text-[9px] font-semibold text-[#63708a] uppercase flex items-center gap-1 mb-0.5">
                              <MessageSquareText className="h-3 w-3 text-[#1a2a5e]" />
                              Notiz
                            </p>
                            <p className="text-[10px] leading-4 text-[#1a2a5e] line-clamp-2">{order.customerNotes}</p>
                          </div>
                        )}

                        {getUnlockValue(order) !== "Keine Angabe" && (
                          <div className="rounded-lg bg-[#f8f9fc] px-2 py-1">
                            <p className="text-[9px] font-semibold text-[#63708a] uppercase flex items-center gap-1 mb-0.5">
                              <Lock className="h-3 w-3 text-[#1a2a5e]" />
                              Lock
                            </p>
                            <p className="break-all text-[10px] leading-4 text-[#1a2a5e]">{getUnlockValue(order)}</p>
                          </div>
                        )}
                      </div>
                    </section>
                  )}

                  {/* Summary */}
                  <section className="rounded-[16px] border border-[#d9dfeb] bg-white shadow-[0_8px_16px_rgba(26,42,94,0.06)]">
                    <div className="border-b border-[#e4e8f0] bg-[#f8f9fc] px-2 py-1.5">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#63708a]">Übersicht</p>
                    </div>

                    <div className="space-y-1 px-2 py-2 text-[10px]">
                      <div className="flex items-center justify-between">
                        <span className="text-[#636e85]">Services:</span>
                        <span className="font-semibold text-[#1a2a5e]">{serviceLabels.length}</span>
                      </div>
                      <div className="flex items-center justify-between border-t border-[#e4e8f0] pt-1">
                        <span className="text-[#636e85]">Extras:</span>
                        <span className="font-semibold text-[#1a2a5e]">{addOnEntries.length}</span>
                      </div>
                      {quantity > 1 && (
                        <div className="flex items-center justify-between border-t border-[#e4e8f0] pt-1">
                          <span className="text-[#636e85]">Aufträge:</span>
                          <span className="font-semibold text-[#1a2a5e]">{quantity}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-xs border-t border-[#e4e8f0] pt-1 mt-1">
                        <span className="font-semibold text-[#1a2a5e]">Gesamt:</span>
                        <span className="font-bold text-[#f5b800]">{((order.totalCost || 0) * quantity).toFixed(2)} €</span>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}