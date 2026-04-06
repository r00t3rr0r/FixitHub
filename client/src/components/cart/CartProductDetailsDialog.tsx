import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Product } from "@/api/shop"
import {
  BadgeEuro,
  CheckCircle2,
  Layers3,
  Package,
  Shield,
  ShoppingBag,
  Sparkles,
  Star,
  Tag,
} from "lucide-react"

interface CartProductDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product | null
  quantity: number
}

const getProductImages = (product: Product | null) => {
  if (!product?.images?.length) return []
  return product.images.filter(Boolean)
}

export function CartProductDetailsDialog({
  open,
  onOpenChange,
  product,
  quantity,
}: CartProductDetailsDialogProps) {
  const images = getProductImages(product)
  const primaryImage = images[0] || "/placeholder-product.png"
  const totalPrice = (product?.price || 0) * quantity
  const savings = product?.originalPrice ? product.originalPrice - product.price : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-12px)] sm:max-w-4xl max-h-[92dvh] gap-0 overflow-hidden border-0 bg-white p-0 shadow-2xl [&>button]:text-[#f5b800] [&>button]:opacity-100 [&>button:hover]:text-[#f5b800]">
        <DialogHeader className="gap-2 bg-[#1a2a5e] px-3 py-3 text-left sm:px-6 sm:py-5">
          <div className="flex items-start justify-between gap-3 pr-7 sm:gap-4 sm:pr-8">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-0 bg-white/14 px-2 py-0.5 text-[11px] font-semibold text-white shadow-none">
                  <ShoppingBag className="mr-1 h-3 w-3" />
                  Shopping-Artikel
                </Badge>
                <Badge className="border-0 bg-[#f5b800] px-2 py-0.5 text-[11px] font-bold text-[#1a2a5e] shadow-none">
                  <Package className="mr-1 h-3 w-3" />
                  {quantity} im Warenkorb
                </Badge>
                {product?.inStock ? (
                  <Badge className="border-0 bg-[#38a169] px-2 py-0.5 text-[11px] font-semibold text-white shadow-none">
                    Sofort verfuegbar
                  </Badge>
                ) : (
                  <Badge className="border-0 bg-[#c53030] px-2 py-0.5 text-[11px] font-semibold text-white shadow-none">
                    Derzeit nicht verfuegbar
                  </Badge>
                )}
              </div>
              <DialogTitle className="text-sm font-bold tracking-tight sm:text-[1.35rem]" style={{ color: "#f5b800" }}>
                {product?.name || "Produktdetails"}
              </DialogTitle>
              <DialogDescription className="text-xs leading-5 text-blue-100 sm:text-sm">
                Produktansicht im Stil der Homepage mit allen relevanten Warenkorbdetails.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {product && (
          <div className="max-h-[82dvh] overflow-y-auto px-2.5 py-2.5 sm:px-6 sm:py-5">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
              <div className="space-y-4">
                <div className="overflow-hidden rounded-2xl border border-[#d8dce6] bg-[linear-gradient(145deg,#f8f9fc_0%,#eef3fb_100%)] p-3 shadow-sm">
                  <div className="overflow-hidden rounded-xl bg-white">
                    <img
                      src={primaryImage}
                      alt={product.name}
                      className="h-[180px] w-full object-contain p-2.5 sm:h-[360px] sm:p-4"
                      onError={(event) => {
                        event.currentTarget.src = "/placeholder-product.png"
                      }}
                    />
                  </div>
                </div>

                {images.length > 1 && (
                  <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5 sm:gap-2">
                    {images.slice(0, 5).map((image, index) => (
                      <div
                        key={`${image}-${index}`}
                        className="overflow-hidden rounded-xl border border-[#d8dce6] bg-[#f8f9fc] p-1.5 shadow-sm"
                      >
                        <img
                          src={image}
                          alt={`${product.name} Ansicht ${index + 1}`}
                          className="h-14 w-full rounded-lg object-cover sm:h-20"
                          onError={(event) => {
                            event.currentTarget.src = "/placeholder-product.png"
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <section className="rounded-2xl border border-[#d8dce6] bg-white shadow-sm">
                  <div className="border-b border-[#d8dce6] bg-[#1a2a5e] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-white">
                    Preis & Status
                  </div>
                  <div className="space-y-4 px-4 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#636e85]">Einzelpreis</p>
                        <div className="mt-1 flex items-end gap-2">
                          <span className="text-xl font-bold text-[#1a2a5e] sm:text-3xl">
                            {product.price.toFixed(2)} €
                          </span>
                          {product.originalPrice && (
                            <span className="pb-1 text-sm font-medium text-[#8a94a6] line-through">
                              {product.originalPrice.toFixed(2)} €
                            </span>
                          )}
                        </div>
                      </div>
                      {savings > 0 && (
                        <Badge className="border-0 bg-[#fff4cc] px-3 py-1 text-xs font-semibold text-[#8b5e00] shadow-none">
                          <Sparkles className="mr-1 h-3.5 w-3.5" />
                          Sie sparen {savings.toFixed(2)} €
                        </Badge>
                      )}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl bg-[#f8f9fc] px-3 py-3">
                        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#636e85]">
                          <Package className="h-3.5 w-3.5 text-[#1a2a5e]" />
                          Menge im Warenkorb
                        </p>
                        <p className="mt-1 text-lg font-bold text-[#1a2a5e]">{quantity}</p>
                      </div>
                      <div className="rounded-xl bg-[#f8f9fc] px-3 py-3">
                        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#636e85]">
                          <BadgeEuro className="h-3.5 w-3.5 text-[#1a2a5e]" />
                          Gesamtwert
                        </p>
                        <p className="mt-1 text-lg font-bold text-[#1a2a5e]">{totalPrice.toFixed(2)} €</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge className="border-0 bg-[#eef6f1] px-2.5 py-1 text-[11px] font-semibold text-[#2f855a] shadow-none">
                        <Shield className="mr-1 h-3 w-3" />
                        {product.inStock ? `${product.stockCount} auf Lager` : "Aktuell ausverkauft"}
                      </Badge>
                      <Badge className="border-0 bg-[#eef3fb] px-2.5 py-1 text-[11px] font-semibold text-[#1a2a5e] shadow-none">
                        <Tag className="mr-1 h-3 w-3" />
                        {product.category}
                      </Badge>
                      <Badge className="border-0 bg-[#fff7db] px-2.5 py-1 text-[11px] font-semibold text-[#a16207] shadow-none">
                        <Layers3 className="mr-1 h-3 w-3" />
                        {product.brand}
                      </Badge>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-[#d8dce6] bg-white shadow-sm">
                  <div className="border-b border-[#d8dce6] bg-[#1a2a5e] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-white">
                    Produktbeschreibung
                  </div>
                  <div className="px-4 py-4">
                    <p className="text-sm leading-6 text-[#1a2a5e]">
                      {product.description || "Keine Beschreibung verfuegbar."}
                    </p>
                  </div>
                </section>

                <section className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-[#d8dce6] bg-white shadow-sm">
                    <div className="border-b border-[#d8dce6] bg-[#1a2a5e] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-white">
                      Highlights
                    </div>
                    <div className="space-y-2 px-4 py-4">
                      {product.features?.length ? (
                        product.features.map((feature, index) => (
                          <div key={`${feature}-${index}`} className="flex items-start gap-2 rounded-xl bg-[#f8f9fc] px-3 py-2.5">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#38a169]" />
                            <span className="text-sm leading-5 text-[#1a2a5e]">{feature}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-[#636e85]">Keine Highlights hinterlegt.</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#d8dce6] bg-white shadow-sm">
                    <div className="border-b border-[#d8dce6] bg-[#1a2a5e] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-white">
                      Details
                    </div>
                    <div className="grid gap-2 px-4 py-4">
                      <div className="rounded-xl bg-[#f8f9fc] px-3 py-2.5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#636e85]">Marke</p>
                        <p className="mt-1 text-sm font-semibold text-[#1a2a5e]">{product.brand}</p>
                      </div>
                      <div className="rounded-xl bg-[#f8f9fc] px-3 py-2.5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#636e85]">Kategorie</p>
                        <p className="mt-1 text-sm font-semibold text-[#1a2a5e]">{product.category}</p>
                      </div>
                      {product.sku && (
                        <div className="rounded-xl bg-[#f8f9fc] px-3 py-2.5">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#636e85]">SKU</p>
                          <p className="mt-1 text-sm font-semibold text-[#1a2a5e]">{product.sku}</p>
                        </div>
                      )}
                      {typeof product.weight === "number" && (
                        <div className="rounded-xl bg-[#f8f9fc] px-3 py-2.5">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#636e85]">Gewicht</p>
                          <p className="mt-1 text-sm font-semibold text-[#1a2a5e]">{product.weight} g</p>
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                <section className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-[#d8dce6] bg-white shadow-sm">
                    <div className="border-b border-[#d8dce6] bg-[#1a2a5e] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-white">
                      Kompatibilitaet
                    </div>
                    <div className="space-y-2 px-4 py-4">
                      {product.compatibility?.length ? (
                        product.compatibility.map((entry, index) => (
                          <div key={`${entry}-${index}`} className="rounded-xl bg-[#f8f9fc] px-3 py-2.5 text-sm text-[#1a2a5e]">
                            {entry}
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-[#636e85]">Keine Kompatibilitaetsangaben hinterlegt.</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#d8dce6] bg-white shadow-sm">
                    <div className="border-b border-[#d8dce6] bg-[#1a2a5e] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-white">
                      Kundenbewertung
                    </div>
                    <div className="space-y-3 px-4 py-4">
                      <div className="flex items-center gap-1.5">
                        {[...Array(5)].map((_, index) => (
                          <Star
                            key={index}
                            className={`h-4 w-4 ${
                              index < Math.floor(product.rating)
                                ? "fill-[#f5b800] text-[#f5b800]"
                                : "text-[#d8dce6]"
                            }`}
                          />
                        ))}
                        <span className="ml-1 text-sm font-semibold text-[#1a2a5e]">
                          {product.rating.toFixed(1)} / 5
                        </span>
                      </div>
                      <p className="text-sm text-[#636e85]">
                        Basierend auf {product.reviewCount} Bewertung{product.reviewCount === 1 ? "" : "en"}.
                      </p>
                    </div>
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