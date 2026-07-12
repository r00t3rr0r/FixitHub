import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { SEO } from "@/components/SEO"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/useToast"
import { getProduct, addToCart, Product } from "@/api/shop"
import { formatEUR } from "@/lib/utils"
import {
  ShoppingCart,
  Star,
  ChevronLeft,
  Shield,
  Package,
  Tag,
  CheckCircle2,
  Layers3,
  Sparkles,
  Eye,
} from "lucide-react"

const BASE_URL = "https://www.mcrepair.de"

function buildProductJsonLd(product: Product) {
  const productUrl = `${BASE_URL}/shop/product/${product._id}`

  const additionalProperty: any[] = []
  product.features?.forEach((f) =>
    additionalProperty.push({ "@type": "PropertyValue", name: "Merkmal", value: f })
  )
  product.compatibility?.forEach((c) =>
    additionalProperty.push({ "@type": "PropertyValue", name: "Kompatibilität", value: c })
  )

  const jsonLd: any = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${productUrl}#product`,
    name: product.seoName || product.name,
    description: product.seoMetaDescription || product.description,
    sku: product.sku,
    ...(product.sku && { mpn: product.sku }),
    brand: { "@type": "Brand", name: product.brand },
    category: product.category,
    image: product.images.filter(Boolean).map((url, i) => ({
      "@type": "ImageObject",
      "@id": `${productUrl}#image${i}`,
      url,
      name: `${product.seoName || product.name}${i > 0 ? ` – Ansicht ${i + 1}` : ""}`,
    })),
    url: productUrl,
    ...(additionalProperty.length > 0 && { additionalProperty }),
    ...(product.weight && {
      weight: { "@type": "QuantitativeValue", value: product.weight, unitCode: "GRM" },
    }),
    ...(product.dimensions && {
      depth:  { "@type": "QuantitativeValue", value: product.dimensions.length, unitCode: "CMT" },
      width:  { "@type": "QuantitativeValue", value: product.dimensions.width,  unitCode: "CMT" },
      height: { "@type": "QuantitativeValue", value: product.dimensions.height, unitCode: "CMT" },
    }),
    offers: {
      "@type": "Offer",
      "@id": `${productUrl}#offer`,
      url: productUrl,
      priceCurrency: "EUR",
      price: product.price.toFixed(2),
      priceValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      priceSpecification: {
        "@type": "PriceSpecification",
        price: product.price.toFixed(2),
        priceCurrency: "EUR",
        valueAddedTaxIncluded: true,
      },
      availability: product.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: "McRepair.de", url: BASE_URL },
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingRate: { "@type": "MonetaryAmount", value: "4.99", currency: "EUR" },
        shippingDestination: { "@type": "DefinedRegion", addressCountry: "DE" },
        deliveryTime: {
          "@type": "ShippingDeliveryTime",
          handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 1, unitCode: "DAY" },
          transitTime:  { "@type": "QuantitativeValue", minValue: 1, maxValue: 3, unitCode: "DAY" },
          businessDays: {
            "@type": "OpeningHoursSpecification",
            dayOfWeek: [
              "https://schema.org/Monday",
              "https://schema.org/Tuesday",
              "https://schema.org/Wednesday",
              "https://schema.org/Thursday",
              "https://schema.org/Friday",
            ],
          },
        },
      },
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        applicableCountry: "DE",
        returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
        merchantReturnDays: 14,
        returnMethod: "https://schema.org/ReturnByMail",
        returnFees: "https://schema.org/FreeReturn",
      },
    },
  }

  if (product.reviewCount > 0) {
    jsonLd.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: product.rating.toFixed(1),
      reviewCount: product.reviewCount,
      bestRating: "5",
      worstRating: "1",
    }
  }
  return jsonLd
}

function buildBreadcrumbJsonLd(product: Product) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
      { "@type": "ListItem", position: 2, name: "Shop", item: `${BASE_URL}/shop` },
      { "@type": "ListItem", position: 3, name: product.category, item: `${BASE_URL}/shop?category=${encodeURIComponent(product.category)}` },
      { "@type": "ListItem", position: 4, name: product.seoName || product.name, item: `${BASE_URL}/shop/product/${product._id}` },
    ],
  }
}

function buildItemPageJsonLd(product: Product) {
  const productUrl = `${BASE_URL}/shop/product/${product._id}`
  return {
    "@context": "https://schema.org",
    "@type": "ItemPage",
    "@id": `${productUrl}#webpage`,
    url: productUrl,
    name: product.seoTitleTag || product.seoName || product.name,
    description: product.seoMetaDescription || product.description,
    inLanguage: "de-DE",
    isPartOf: {
      "@type": "WebSite",
      "@id": `${BASE_URL}/#website`,
      url: BASE_URL,
      name: "McRepair.de",
      inLanguage: "de-DE",
    },
    ...(product.images[0] && {
      primaryImageOfPage: {
        "@type": "ImageObject",
        "@id": `${productUrl}#image0`,
        url: product.images[0],
        caption: product.seoName || product.name,
      },
    }),
    datePublished: product.createdAt,
    dateModified: product.updatedAt,
    potentialAction: { "@type": "ReadAction", target: [productUrl] },
  }
}

export function ProductDetail() {
  const { id } = useParams<{ id: string }>()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [activeImage, setActiveImage] = useState<string | null>(null)
  const [addingToCart, setAddingToCart] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setNotFound(false)
    getProduct(id)
      .then((data: any) => {
        const p: Product = data.product
        if (!p) { setNotFound(true); return }
        setProduct(p)
        setActiveImage(p.images?.[0] || null)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id])

  const handleAddToCart = async () => {
    if (!product) return
    try {
      setAddingToCart(true)
      await addToCart({ productId: product._id, quantity: 1, product })
      window.dispatchEvent(new Event("cartUpdated"))
      toast({ title: "Zum Warenkorb hinzugefügt!", description: product.name })
    } catch (error: any) {
      toast({ title: "Fehler", description: error.message || "Konnte nicht zum Warenkorb hinzugefügt werden", variant: "destructive" })
    } finally {
      setAddingToCart(false)
    }
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f9fc]">
        {/* Header skeleton */}
        <div className="bg-gradient-to-r from-[#1a2a5e] via-[#22366f] to-[#2d4a8f] px-4 py-5 sm:px-6">
          <div className="container mx-auto max-w-5xl space-y-3">
            <div className="h-4 w-40 rounded bg-white/20 animate-pulse" />
            <div className="h-7 w-72 rounded bg-white/30 animate-pulse" />
            <div className="flex gap-2 mt-2">
              <div className="h-6 w-20 rounded-full bg-white/20 animate-pulse" />
              <div className="h-6 w-24 rounded-full bg-white/20 animate-pulse" />
            </div>
          </div>
        </div>
        {/* Body skeleton */}
        <div className="container mx-auto max-w-5xl px-4 py-6">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <div className="h-80 rounded-[24px] bg-gray-200 animate-pulse" />
            <div className="space-y-4">
              <div className="h-32 rounded-[24px] bg-gray-200 animate-pulse" />
              <div className="h-48 rounded-[24px] bg-gray-200 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Not found ─────────────────────────────────────────────────────────────
  if (notFound || !product) {
    return (
      <div className="min-h-screen bg-[#f8f9fc]">
        <SEO
          title="Produkt nicht gefunden – McRepair.de Shop"
          description="Das gesuchte Produkt existiert nicht oder ist nicht mehr verfügbar."
          canonical="/shop"
          noindex
        />
        <div className="container mx-auto max-w-5xl px-4 py-24 flex flex-col items-center text-center">
          <div className="rounded-full bg-[#eef3fb] p-6 mb-5">
            <Package className="h-12 w-12 text-[#1a2a5e]" />
          </div>
          <h1 className="text-xl font-bold text-[#1a2a5e] mb-2">Produkt nicht gefunden</h1>
          <p className="text-[#63708a] mb-7 max-w-sm">
            Das gesuchte Produkt ist nicht mehr verfügbar oder wurde entfernt.
          </p>
          <Button
            asChild
            className="bg-gradient-to-r from-[#f5b800] to-[#f0c419] text-[#1a2a5e] font-bold shadow-md hover:shadow-lg"
          >
            <Link to="/shop">
              <ChevronLeft className="h-4 w-4 mr-1.5" />
              Zurück zum Shop
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  const images = product.images.filter(Boolean)
  const primaryImage = activeImage || images[0] || "/placeholder-product.png"
  const savings = product.originalPrice ? product.originalPrice - product.price : 0
  const seoTitle = product.seoTitleTag || `${product.seoName || product.name} – ${product.brand} | McRepair.de Shop`
  const seoDescription = product.seoMetaDescription ||
    `${product.name} von ${product.brand} – ${product.category}. Jetzt für ${formatEUR(product.price)} im McRepair.de Shop bestellen.`
  const seoKeywords = product.seoMetaKeywords ||
    `${product.name}, ${product.brand}, ${product.category}, Ersatzteile, Zubehör, Smartphone, McRepair`

  return (
    <div className="min-h-screen bg-[#f8f9fc]">
      <SEO
        title={seoTitle}
        description={seoDescription}
        canonical={`/shop/product/${product._id}`}
        keywords={seoKeywords}
        ogType="website"
        ogImage={images[0] || undefined}
        ogImageAlt={product.seoName || product.name}
        productPrice={product.price}
        productCurrency="EUR"
        productAvailability={product.inStock ? "InStock" : "OutOfStock"}
        publishedTime={product.createdAt}
        modifiedTime={product.updatedAt}
        jsonLd={[buildProductJsonLd(product), buildBreadcrumbJsonLd(product), buildItemPageJsonLd(product)]}
      />

      {/* ── Page header – matches shop header style ──────────────────────── */}
      <div className="px-2.5 sm:px-4 pt-2">
        <div className="rounded-2xl bg-gradient-to-r from-[#1a2a5e] via-[#22366f] to-[#2d4a8f] shadow-lg">
        <div className="container mx-auto max-w-5xl px-4 py-4 sm:px-6 sm:py-5">

          {/* Breadcrumb – crawlable, subtle on dark background */}
          <nav aria-label="Breadcrumb" className="mb-3">
            <ol className="flex flex-wrap items-center gap-1 text-[11px] font-medium text-blue-200/70">
              <li><Link to="/" className="hover:text-white transition-colors">Home</Link></li>
              <li className="text-blue-300/40">/</li>
              <li><Link to="/shop" className="hover:text-white transition-colors">Shop</Link></li>
              <li className="text-blue-300/40">/</li>
              <li>
                <Link to={`/shop?category=${encodeURIComponent(product.category)}`} className="hover:text-white transition-colors">
                  {product.category}
                </Link>
              </li>
              <li className="text-blue-300/40">/</li>
              <li className="text-blue-100/90 truncate max-w-[180px]">{product.name}</li>
            </ol>
          </nav>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2.5 flex-1 min-w-0">
              {/* Badge strip */}
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-0 bg-white/[0.13] px-2.5 py-1 text-[11px] font-semibold text-white shadow-none">
                  <Eye className="mr-1 h-3.5 w-3.5" />
                  Produktdetails
                </Badge>
                <Badge className="border-0 bg-[#f5b800] px-2.5 py-1 text-[11px] font-bold text-[#1a2a5e] shadow-none">
                  <Sparkles className="mr-1 h-3.5 w-3.5" />
                  {product.category}
                </Badge>
                {product.inStock ? (
                  <Badge className="border-0 bg-[#38a169] px-2.5 py-1 text-[11px] font-semibold text-white shadow-none">
                    Sofort verfügbar
                  </Badge>
                ) : (
                  <Badge className="border-0 bg-[#c53030] px-2.5 py-1 text-[11px] font-semibold text-white shadow-none">
                    Nicht verfügbar
                  </Badge>
                )}
                {savings > 0 && (
                  <Badge className="border-0 bg-[#e53e3e] px-2.5 py-1 text-[11px] font-bold text-white shadow-none">
                    -{formatEUR(savings)} gespart
                  </Badge>
                )}
              </div>

              {/* Product title */}
              <h1 className="text-xl font-bold tracking-tight text-[#f5b800] sm:text-[1.6rem] leading-tight">
                {product.name}
              </h1>
              <p className="text-sm text-blue-100/80">
                {product.brand}
                {product.sku && <span className="ml-2 opacity-70">• SKU {product.sku}</span>}
              </p>
            </div>

            {/* Back button */}
            <Button
              asChild
              variant="outline"
              size="sm"
              className="self-start shrink-0 border-white/30 bg-white/10 text-white text-xs font-semibold hover:bg-white hover:text-[#1a2a5e] transition-all h-9 px-3 mt-0.5"
              style={{ borderWidth: "1px", borderColor: "rgba(255,255,255,0.3)" }}
            >
              <Link to="/shop">
                <ChevronLeft className="h-4 w-4 mr-1" />
                Zurück zum Shop
              </Link>
            </Button>
          </div>
        </div>
        </div>
      </div>

      {/* ── Content area ─────────────────────────────────────────────────── */}
      <div className="bg-[linear-gradient(180deg,#f7f9fd_0%,#ffffff_50%)] px-2.5 sm:px-4 pb-6 mt-4 sm:mt-5">
        <div className="container mx-auto !px-0 py-5 sm:py-6">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">

            {/* ── LEFT: Image gallery ────────────────────────────────────── */}
            <div className="space-y-4">
              {/* Main image */}
              <section className="overflow-hidden rounded-[24px] border border-[#d9dfeb] bg-white shadow-[0_14px_36px_rgba(26,42,94,0.08)]">
                <div className="flex items-center justify-between border-b border-[#e4e8f0] bg-[#f8f9fc] px-4 py-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#63708a]">Produktfoto</p>
                    <p className="mt-0.5 text-sm font-semibold text-[#1a2a5e]">Hauptansicht</p>
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
                      alt={product.name}
                      className="h-[260px] w-full object-contain p-4 sm:h-[400px] sm:p-6"
                      loading="eager"
                      fetchPriority="high"
                      onError={(e) => { e.currentTarget.src = "/placeholder-product.png" }}
                    />
                  </div>
                </div>
              </section>

              {/* Thumbnail strip */}
              {images.length > 1 && (
                <section className="rounded-[24px] border border-[#d9dfeb] bg-white p-3 shadow-[0_14px_36px_rgba(26,42,94,0.08)] sm:p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#63708a]">Galerie</p>
                      <p className="mt-0.5 text-sm font-semibold text-[#1a2a5e]">Weitere Ansichten</p>
                    </div>
                    <span className="text-xs font-medium text-[#63708a]">{images.length} Bilder</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                    {images.slice(0, 5).map((img, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setActiveImage(img)}
                        className={`overflow-hidden rounded-2xl border p-1.5 transition-all ${
                          activeImage === img
                            ? "border-[#f5b800] bg-[#fff9e6] shadow-[0_10px_24px_rgba(245,184,0,0.18)]"
                            : "border-[#d9dfeb] bg-[#f8f9fc] hover:border-[#1a2a5e]/30 hover:bg-white"
                        }`}
                      >
                        <img
                          src={img}
                          alt={`${product.name} Ansicht ${i + 1}`}
                          className="h-16 w-full rounded-xl object-cover sm:h-20"
                          loading="lazy"
                          onError={(e) => { e.currentTarget.src = "/placeholder-product.png" }}
                        />
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </div>

            {/* ── RIGHT: Info panels ─────────────────────────────────────── */}
            <div className="space-y-4">

              {/* Price & status */}
              <section className="rounded-[24px] border border-[#d9dfeb] bg-white shadow-[0_14px_36px_rgba(26,42,94,0.08)]">
                <div className="border-b border-[#e4e8f0] bg-[#f8f9fc] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#63708a]">Preis & Status</p>
                  <p className="mt-0.5 text-sm font-semibold text-[#1a2a5e]">Schneller Überblick</p>
                </div>
                <div className="space-y-4 px-4 py-4 sm:px-5">

                  {/* Price row */}
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#63708a]">Aktueller Preis</p>
                      <div className="mt-1 flex items-end gap-2">
                        <span className="text-3xl font-bold tracking-tight text-[#1a2a5e]">
                          {formatEUR(product.price)}
                        </span>
                        {product.originalPrice && (
                          <span className="pb-1 text-sm font-medium text-[#8a94a6] line-through">
                            {formatEUR(product.originalPrice)}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge className={`border-0 px-3 py-1 text-xs font-semibold shadow-none ${
                      product.inStock ? "bg-[#e8f6ee] text-[#2f855a]" : "bg-[#fdecec] text-[#c53030]"
                    }`}>
                      <Shield className="mr-1 h-3.5 w-3.5" />
                      {product.inStock ? `${product.stockCount} verfügbar` : "Aktuell ausverkauft"}
                    </Badge>
                  </div>

                  {/* Low-stock warning */}
                  {product.inStock && product.stockCount <= 5 && (
                    <div className="flex items-center gap-1.5 rounded-2xl bg-[#fff8f0] px-3 py-2.5">
                      <div className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
                      <p className="text-xs font-semibold text-orange-700">
                        Nur noch {product.stockCount} auf Lager – schnell zugreifen!
                      </p>
                    </div>
                  )}

                  {/* Rating */}
                  {product.reviewCount > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 ${
                              i < Math.floor(product.rating)
                                ? "fill-[#f5b800] text-[#f5b800]"
                                : "text-[#d2d8e4]"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm font-medium text-[#43506a]">
                        {product.rating.toFixed(1)} von 5 ({product.reviewCount} Bewertungen)
                      </span>
                    </div>
                  )}

                  {/* Info tiles */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-2xl bg-[#f8f9fc] px-2.5 py-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#63708a]">Kategorie</p>
                      <p className="mt-0.5 text-xs font-semibold text-[#1a2a5e] truncate">{product.category}</p>
                    </div>
                    <div className="rounded-2xl bg-[#f8f9fc] px-2.5 py-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#63708a]">Marke</p>
                      <p className="mt-0.5 text-xs font-semibold text-[#1a2a5e] truncate">{product.brand}</p>
                    </div>
                    <div className="rounded-2xl bg-[#f8f9fc] px-2.5 py-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#63708a]">Lieferung</p>
                      <p className="mt-0.5 text-xs font-semibold text-[#1a2a5e]">
                        {product.inStock ? "Sofort" : "Vergriffen"}
                      </p>
                    </div>
                  </div>

                  {/* Tag badges */}
                  <div className="flex flex-wrap gap-1.5">
                    <Badge className="border-0 bg-[#eef3fb] px-2.5 py-1 text-[11px] font-semibold text-[#1a2a5e] shadow-none">
                      <Tag className="mr-1 h-3.5 w-3.5" />{product.category}
                    </Badge>
                    <Badge className="border-0 bg-[#fff7db] px-2.5 py-1 text-[11px] font-semibold text-[#a16207] shadow-none">
                      <Layers3 className="mr-1 h-3.5 w-3.5" />{product.brand}
                    </Badge>
                    {product.sku && (
                      <Badge className="border-0 bg-[#edf2f7] px-2.5 py-1 text-[11px] font-semibold text-[#43506a] shadow-none">
                        SKU {product.sku}
                      </Badge>
                    )}
                  </div>
                </div>
              </section>

              {/* Description */}
              <section className="rounded-[24px] border border-[#d9dfeb] bg-white shadow-[0_14px_36px_rgba(26,42,94,0.08)]">
                <div className="border-b border-[#e4e8f0] bg-[#f8f9fc] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#63708a]">Beschreibung</p>
                  <p className="mt-0.5 text-sm font-semibold text-[#1a2a5e]">Produktinformation</p>
                </div>
                <div className="px-4 py-4 sm:px-5">
                  <p className="text-sm leading-7 text-[#43506a]">{product.description}</p>
                </div>
              </section>

              {/* Features */}
              {product.features && product.features.length > 0 && (
                <section className="rounded-[24px] border border-[#d9dfeb] bg-white shadow-[0_14px_36px_rgba(26,42,94,0.08)]">
                  <div className="border-b border-[#e4e8f0] bg-[#f8f9fc] px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#63708a]">Highlights</p>
                    <p className="mt-0.5 text-sm font-semibold text-[#1a2a5e]">Wichtige Merkmale</p>
                  </div>
                  <div className="grid gap-2 px-4 py-4 sm:px-5">
                    {product.features.map((feature, i) => (
                      <div key={i} className="flex items-start gap-2 rounded-2xl bg-[#f8f9fc] px-3 py-2.5">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#38a169]" />
                        <span className="text-sm leading-6 text-[#1a2a5e]">{feature}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Compatibility */}
              {product.compatibility && product.compatibility.length > 0 && (
                <section className="rounded-[24px] border border-[#d9dfeb] bg-white shadow-[0_14px_36px_rgba(26,42,94,0.08)]">
                  <div className="border-b border-[#e4e8f0] bg-[#f8f9fc] px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#63708a]">Kompatibilität</p>
                    <p className="mt-0.5 text-sm font-semibold text-[#1a2a5e]">Passend für diese Geräte</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 px-4 py-4 sm:px-5">
                    {product.compatibility.map((c, i) => (
                      <Badge key={i} className="border-0 bg-[#eef3fb] px-2.5 py-1 text-[11px] font-semibold text-[#1a2a5e] shadow-none">
                        {c}
                      </Badge>
                    ))}
                  </div>
                </section>
              )}

              {/* Add to cart CTA */}
              <div className="rounded-[24px] border border-[#d9dfeb] bg-white p-4 shadow-[0_14px_36px_rgba(26,42,94,0.08)] sm:p-5">
                <Button
                  onClick={handleAddToCart}
                  disabled={!product.inStock || addingToCart}
                  className="h-12 w-full bg-gradient-to-r from-[#f5b800] to-[#f0c419] text-[#1a2a5e] font-bold text-sm shadow-[0_14px_28px_rgba(245,184,0,0.28)] transition-all duration-300 hover:from-[#f0c419] hover:to-[#e0b000] hover:shadow-[0_18px_34px_rgba(245,184,0,0.34)] disabled:opacity-50"
                >
                  {addingToCart ? (
                    <span className="flex items-center gap-2">
                      <div className="h-4 w-4 border-2 border-[#1a2a5e] border-t-transparent rounded-full animate-spin" />
                      Wird hinzugefügt...
                    </span>
                  ) : (
                    <>
                      <ShoppingCart className="mr-2 h-4 w-4" />
                      In den Warenkorb
                    </>
                  )}
                </Button>
                {!product.inStock && (
                  <p className="mt-2.5 text-center text-xs text-[#c53030] font-medium">
                    Dieses Produkt ist derzeit nicht verfügbar.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
