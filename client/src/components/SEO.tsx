import { Helmet } from 'react-helmet-async'

interface SEOProps {
  title: string
  description: string
  canonical?: string
  noindex?: boolean
  ogType?: 'website' | 'article'
  ogImage?: string
  /** Comma-separated keywords for the <meta name="keywords"> tag */
  keywords?: string
  /** One or more schema.org JSON-LD objects. Arrays are merged under @graph. */
  jsonLd?: object | object[]
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
  keywords,
  jsonLd,
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

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={ogType} />
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
      <meta property="og:image" content={ogImage} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="de_DE" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {/* JSON-LD Structured Data */}
      {jsonLdScript && (
        <script type="application/ld+json">{jsonLdScript}</script>
      )}
    </Helmet>
  )
}
