import { Helmet } from 'react-helmet-async'

interface SEOProps {
  title: string
  description: string
  canonical?: string
  noindex?: boolean
  ogType?: 'website' | 'article'
  ogImage?: string
  /** Alt text for the OG/Twitter image */
  ogImageAlt?: string
  /** Comma-separated keywords for the <meta name="keywords"> tag */
  keywords?: string
  /** One or more schema.org JSON-LD objects. Arrays are merged under @graph. */
  jsonLd?: object | object[]
  /** Product price – enables product:price:*, og:price:* and Twitter card labels */
  productPrice?: number
  /** ISO-4217 currency code, defaults to EUR */
  productCurrency?: string
  /** Availability state – enables product:availability and Twitter card label */
  productAvailability?: 'InStock' | 'OutOfStock' | 'PreOrder'
  /** ISO-8601 timestamp for article:published_time */
  publishedTime?: string
  /** ISO-8601 timestamp for article:modified_time */
  modifiedTime?: string
}

const BASE_URL = 'https://www.mcrepair.de'
const SITE_NAME = 'McRepair.de'
const DEFAULT_OG_IMAGE = `${BASE_URL}/og-default.jpg`

export function SEO({
  title,
  description,
  canonical,
  noindex = false,
  ogType = 'website',
  ogImage = DEFAULT_OG_IMAGE,
  ogImageAlt,
  keywords,
  jsonLd,
  productPrice,
  productCurrency = 'EUR',
  productAvailability,
  publishedTime,
  modifiedTime,
}: SEOProps) {
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`
  const canonicalUrl = canonical ? `${BASE_URL}${canonical}` : undefined

  let jsonLdScript: string | null = null
  if (jsonLd) {
    if (Array.isArray(jsonLd)) {
      // Strip per-item @context and wrap in a single @graph block
      const graph = jsonLd.map(({ '@context': _ctx, ...rest }: any) => rest)
      jsonLdScript = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph })
    } else {
      jsonLdScript = JSON.stringify(jsonLd)
    }
  }

  const twitterPrice =
    productPrice !== undefined
      ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: productCurrency }).format(productPrice)
      : undefined

  const availabilityLabel =
    productAvailability === 'InStock'
      ? 'Auf Lager'
      : productAvailability === 'OutOfStock'
      ? 'Ausverkauft'
      : productAvailability === 'PreOrder'
      ? 'Vorbestellung'
      : undefined

  const productAvailabilityContent =
    productAvailability === 'InStock'
      ? 'in stock'
      : productAvailability === 'OutOfStock'
      ? 'out of stock'
      : 'preorder'

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      <meta name="robots" content={noindex ? 'noindex, nofollow' : 'index, follow'} />
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}

      {/* Open Graph – core */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={ogType} />
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
      <meta property="og:image" content={ogImage} />
      {ogImageAlt && <meta property="og:image:alt" content={ogImageAlt} />}
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="de_DE" />

      {/* Open Graph – product enrichment */}
      {productPrice !== undefined && <meta property="product:price:amount" content={productPrice.toFixed(2)} />}
      {productPrice !== undefined && <meta property="product:price:currency" content={productCurrency} />}
      {productPrice !== undefined && <meta property="og:price:amount" content={productPrice.toFixed(2)} />}
      {productPrice !== undefined && <meta property="og:price:currency" content={productCurrency} />}
      {productAvailability && <meta property="product:availability" content={productAvailabilityContent} />}

      {/* Timestamps */}
      {publishedTime && <meta property="article:published_time" content={publishedTime} />}
      {modifiedTime && <meta property="article:modified_time" content={modifiedTime} />}

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
      {ogImageAlt && <meta name="twitter:image:alt" content={ogImageAlt} />}
      {twitterPrice && <meta name="twitter:label1" content="Preis" />}
      {twitterPrice && <meta name="twitter:data1" content={twitterPrice} />}
      {availabilityLabel && <meta name="twitter:label2" content="Verfügbarkeit" />}
      {availabilityLabel && <meta name="twitter:data2" content={availabilityLabel} />}

      {/* JSON-LD Structured Data */}
      {jsonLdScript && (
        <script type="application/ld+json">{jsonLdScript}</script>
      )}
    </Helmet>
  )
}
