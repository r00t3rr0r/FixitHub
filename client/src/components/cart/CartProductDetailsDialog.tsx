import { useEffect, useState } from "react"
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
  CheckCircle2,
  Eye,
  Layers3,
  Shield,
  Sparkles,
  Star,
  Tag,
} from "lucide-react"
import { formatEUR } from '@/lib/utils'

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
  const [selectedQuickViewImage, setSelectedQuickViewImage] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setSelectedQuickViewImage(null)
    }
  }, [open, product?._id])

  const images = getProductImages(product)
  const primaryImage = selectedQuickViewImage || images[0] || "/placeholder-product.png"
  const price = typeof product?.price === "number" ? product.price : 0
  const originalPrice = typeof product?.originalPrice === "number" ? product.originalPrice : undefined
  const rating = typeof product?.rating === "number" ? product.rating : 0
  const reviewCount = typeof product?.reviewCount === "number" ? product.reviewCount : 0
  const rawStockCount = (product as any)?.stockCount
  const parsedStockCount = Number(rawStockCount)
  const hasStockCount =
    rawStockCount !== null &&
    rawStockCount !== undefined &&
    rawStockCount !== "" &&
    Number.isFinite(parsedStockCount)
  const stockCount = hasStockCount ? Math.max(0, parsedStockCount) : 0
  const hasInStockFlag = typeof product?.inStock === "boolean"
  const fallbackInStock = hasInStockFlag ? Boolean(product?.inStock) : true
  const effectiveInStock = hasStockCount
    ? (stockCount > 0 || fallbackInStock)
    : fallbackInStock
  const totalPrice = price * quantity
  const savings = typeof originalPrice === "number" ? originalPrice - price : 0
  const productName = product?.name || "Produktdetails"
  const productBrand = product?.brand || "Unbekannt"
  const productCategory = product?.category || "Unbekannt"
  const productDescription = product?.description || "Keine Beschreibung verfuegbar."
  const productFeatures = product?.features || []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-16px)] sm:max-w-5xl max-h-[92dvh] overflow-hidden border-0 bg-white p-0 gap-0 rounded-[20px] sm:rounded-[28px] shadow-[0_24px_80px_rgba(26,42,94,0.32)] [&>button]:top-4 [&>button]:right-4 [&>button]:text-white/80 [&>button]:opacity-100 [&>button:hover]:text-white [&>button]:focus:ring-white/50 [&>button]:ring-offset-transparent">
        {product && (
          <>
            <DialogHeader className="gap-4 bg-gradient-to-r from-[#1a2a5e] via-[#22366f] to-[#2d4a8f] px-4 py-4 text-left sm:px-6 sm:py-5">
              <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="border-0 bg-white/14 px-2.5 py-1 text-[11px] font-semibold text-white shadow-none">
                      <Eye className="mr-1 h-3.5 w-3.5" />
                      Produktdetails
                    </Badge>
                    <Badge className="border-0 bg-[#f5b800] px-2.5 py-1 text-[11px] font-bold text-[#1a2a5e] shadow-none">
                      <Sparkles className="mr-1 h-3.5 w-3.5" />
                      {quantity} im Warenkorb
                    </Badge>
                    {effectiveInStock ? (
                      <Badge className="border-0 bg-[#38a169] px-2.5 py-1 text-[11px] font-semibold text-white shadow-none">
                        Sofort verfuegbar
                      </Badge>
                    ) : (
                      <Badge className="border-0 bg-[#c53030] px-2.5 py-1 text-[11px] font-semibold text-white shadow-none">
                        Nicht verfuegbar
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <DialogTitle className="text-xl font-bold tracking-tight !text-[#f5b800] sm:text-[1.65rem]">
                      {productName}
                    </DialogTitle>
                    <DialogDescription className="max-w-2xl text-sm leading-6 text-blue-100/90">
                      {productBrand} • {productCategory}
                      {product.sku ? ` • SKU ${product.sku}` : ""}
                    </DialogDescription>
                  </div>
                </div>
              </div>
            </DialogHeader>

            <div className="max-h-[calc(92dvh-136px)] overflow-y-auto bg-[linear-gradient(180deg,#f7f9fd_0%,#ffffff_42%)]">
              <div className="grid gap-5 p-3 sm:p-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                <div className="space-y-4">
                  <section className="overflow-hidden rounded-[24px] border border-[#d9dfeb] bg-white shadow-[0_14px_36px_rgba(26,42,94,0.08)]">
                    <div className="flex items-center justify-between border-b border-[#e4e8f0] bg-[#f8f9fc] px-4 py-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#63708a]">Produktfoto</p>
                        <p className="mt-1 text-sm font-semibold text-[#1a2a5e]">Hauptansicht</p>
                      </div>
                      {savings > 0 && (
                        <Badge className="border-0 bg-[#fff4cc] px-3 py-1 text-[11px] font-semibold text-[#8b5e00] shadow-none">
                          <Sparkles className="mr-1 h-3.5 w-3.5" />
                          {formatEUR(savings)} sparen
                        </Badge>
                      )}
                    </div>

                    <div className="bg-[radial-gradient(circle_at_top,#eef4ff_0%,#f8f9fc_48%,#ffffff_100%)] p-4 sm:p-6">
                      <div className="overflow-hidden rounded-[20px] border border-[#dfe4ee] bg-white shadow-sm">
                        <img
                          src={primaryImage}
                          alt={productName}
                          className="h-[260px] w-full object-contain p-4 sm:h-[420px] sm:p-6"
                          onError={(event) => {
                            event.currentTarget.src = "/placeholder-product.png"
                          }}
                        />
                      </div>
                    </div>
                  </section>

                  {images.length > 1 && (
                    <section className="rounded-[24px] border border-[#d9dfeb] bg-white p-3 shadow-[0_14px_36px_rgba(26,42,94,0.08)] sm:p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#63708a]">Galerie</p>
                          <p className="mt-1 text-sm font-semibold text-[#1a2a5e]">Weitere Ansichten</p>
                        </div>
                        <span className="text-xs font-medium text-[#63708a]">{images.length} Bilder</span>
                      </div>

                      <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                        {images.slice(0, 5).map((image, index) => {
                          const isActive = primaryImage === image

                          return (
                            <button
                              key={`${image}-${index}`}
                              type="button"
                              onClick={() => setSelectedQuickViewImage(image)}
                              className={`overflow-hidden rounded-2xl border p-1.5 transition-all ${
                                isActive
                                  ? "border-[#f5b800] bg-[#fff9e6] shadow-[0_10px_24px_rgba(245,184,0,0.18)]"
                                  : "border-[#d9dfeb] bg-[#f8f9fc] hover:border-[#1a2a5e]/30 hover:bg-white"
                              }`}
                            >
                              <img
                                src={image}
                                alt={`${productName} Ansicht ${index + 1}`}
                                className="h-16 w-full rounded-xl object-cover sm:h-20"
                                onError={(event) => {
                                  event.currentTarget.src = "/placeholder-product.png"
                                }}
                              />
                            </button>
                          )
                        })}
                      </div>
                    </section>
                  )}
                </div>

                <div className="space-y-4">
                  <section className="rounded-[24px] border border-[#d9dfeb] bg-white shadow-[0_14px_36px_rgba(26,42,94,0.08)]">
                    <div className="border-b border-[#e4e8f0] bg-[#f8f9fc] px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#63708a]">Preis & Status</p>
                      <p className="mt-1 text-sm font-semibold text-[#1a2a5e]">Schneller Ueberblick</p>
                    </div>

                    <div className="space-y-4 px-4 py-4 sm:px-5">
                      <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#63708a]">Aktueller Preis</p>
                          <div className="mt-1 flex items-end gap-2">
                            <span className="text-3xl font-bold tracking-tight text-[#1a2a5e]">
                              {formatEUR(price)}
                            </span>
                            {typeof originalPrice === "number" && (
                              <span className="pb-1 text-sm font-medium text-[#8a94a6] line-through">
                                {formatEUR(originalPrice)}
                              </span>
                            )}
                          </div>
                        </div>

                        <Badge className={`border-0 px-3 py-1 text-xs font-semibold shadow-none ${
                          effectiveInStock
                            ? "bg-[#e8f6ee] text-[#2f855a]"
                            : "bg-[#fdecec] text-[#c53030]"
                        }`}>
                          <Shield className="mr-1 h-3.5 w-3.5" />
                          {effectiveInStock
                            ? (hasStockCount && stockCount > 0 ? `${stockCount} verfuegbar` : "Verfuegbar")
                            : "Aktuell ausverkauft"}
                        </Badge>
                      </div>

                      <div className="rounded-2xl bg-[#f8f9fc] px-3 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#63708a]">Gesamtwert im Warenkorb</p>
                        <p className="mt-1 text-sm font-semibold text-[#1a2a5e]">{formatEUR(totalPrice)} ({quantity}x)</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${
                                i < Math.floor(rating)
                                  ? "fill-[#f5b800] text-[#f5b800]"
                                  : "text-[#d2d8e4]"
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-sm font-medium text-[#43506a]">
                          {rating.toFixed(1)} von 5 ({reviewCount} Bewertungen)
                        </span>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-2xl bg-[#f8f9fc] px-3 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#63708a]">Kategorie</p>
                          <p className="mt-1 text-sm font-semibold text-[#1a2a5e]">{productCategory}</p>
                        </div>
                        <div className="rounded-2xl bg-[#f8f9fc] px-3 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#63708a]">Marke</p>
                          <p className="mt-1 text-sm font-semibold text-[#1a2a5e]">{productBrand}</p>
                        </div>
                        <div className="rounded-2xl bg-[#f8f9fc] px-3 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#63708a]">Lieferstatus</p>
                          <p className="mt-1 text-sm font-semibold text-[#1a2a5e]">
                              {effectiveInStock ? "Sofort lieferbar" : "Nicht verfuegbar"}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Badge className="border-0 bg-[#eef3fb] px-2.5 py-1 text-[11px] font-semibold text-[#1a2a5e] shadow-none">
                          <Tag className="mr-1 h-3.5 w-3.5" />
                          {productCategory}
                        </Badge>
                        <Badge className="border-0 bg-[#fff7db] px-2.5 py-1 text-[11px] font-semibold text-[#a16207] shadow-none">
                          <Layers3 className="mr-1 h-3.5 w-3.5" />
                          {productBrand}
                        </Badge>
                        {product.sku && (
                          <Badge className="border-0 bg-[#edf2f7] px-2.5 py-1 text-[11px] font-semibold text-[#43506a] shadow-none">
                            SKU {product.sku}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </section>

                  <section className="rounded-[24px] border border-[#d9dfeb] bg-white shadow-[0_14px_36px_rgba(26,42,94,0.08)]">
                    <div className="border-b border-[#e4e8f0] bg-[#f8f9fc] px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#63708a]">Beschreibung</p>
                      <p className="mt-1 text-sm font-semibold text-[#1a2a5e]">Produktinformation</p>
                    </div>

                    <div className="px-4 py-4 sm:px-5">
                      <p className="text-sm leading-7 text-[#43506a]">
                        {productDescription}
                      </p>
                    </div>
                  </section>

                  {productFeatures.length > 0 && (
                    <section className="rounded-[24px] border border-[#d9dfeb] bg-white shadow-[0_14px_36px_rgba(26,42,94,0.08)]">
                      <div className="border-b border-[#e4e8f0] bg-[#f8f9fc] px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#63708a]">Highlights</p>
                        <p className="mt-1 text-sm font-semibold text-[#1a2a5e]">Wichtige Merkmale</p>
                      </div>

                      <div className="grid gap-2 px-4 py-4 sm:px-5">
                        {productFeatures.map((feature, index) => (
                          <div
                            key={index}
                            className="flex items-start gap-2 rounded-2xl bg-[#f8f9fc] px-3 py-3"
                          >
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#38a169]" />
                            <span className="text-sm leading-6 text-[#1a2a5e]">{feature}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}