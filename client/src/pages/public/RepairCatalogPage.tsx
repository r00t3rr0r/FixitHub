/**
 * RepairCatalogPage
 *
 * Three-level SEO landing page hierarchy for the repair configurator catalog:
 *   /reparatur/:deviceType               → list all manufacturers + link to service order
 *   /reparatur/:deviceType/:manufacturer → list all models
 *   /reparatur/:deviceType/:manufacturer/:model → list all services + add-ons with prices
 *
 * Every level renders crawlable HTML, a <SEO> component with title/description/canonical,
 * BreadcrumbList JSON-LD, and (on model level) Service/Offer JSON-LD for each repair.
 */

import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { SEO } from '@/components/SEO'
import {
  getRepairCatalog,
  getRepairCatalogServices,
  type RepairCatalogDeviceType,
  type RepairCatalogManufacturer,
  type RepairCatalogModel,
  type RepairCatalogService,
  type RepairCatalogAddOn,
} from '@/api/seo'

const BASE_URL = 'https://www.fixithub.de'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatPrice(price: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(price)
}

function BreadcrumbJsonLd({ items }: { items: { name: string; url: string }[] }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }
  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(data)}</script>
    </Helmet>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Level 1 – Device-type page: /reparatur/:deviceType
// ─────────────────────────────────────────────────────────────────────────────

function DeviceTypePage({
  dtEntry,
  deviceTypeSlug,
}: {
  dtEntry: RepairCatalogDeviceType
  deviceTypeSlug: string
}) {
  const navigate = useNavigate()
  const canonical = `/reparatur/${deviceTypeSlug}`
  const title = `${dtEntry.name} Reparatur | FixitHub`
  const description = `Professionelle ${dtEntry.name}-Reparatur bei FixitHub. ${dtEntry.manufacturers.length} Hersteller verfügbar – wähle deinen Hersteller und starte jetzt deine Reparaturanfrage.`

  const serviceJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: `${dtEntry.name} Reparatur`,
    provider: {
      '@type': 'LocalBusiness',
      name: 'FixitHub',
      url: BASE_URL,
    },
    areaServed: { '@type': 'Country', name: 'Deutschland' },
    description,
    url: `${BASE_URL}${canonical}`,
    serviceType: 'Gerätereparatur',
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: `${dtEntry.name} Reparaturen`,
      itemListElement: dtEntry.manufacturers.map((mfr) => ({
        '@type': 'Offer',
        name: `${mfr.name} ${dtEntry.name} Reparatur`,
        url: `${BASE_URL}/reparatur/${deviceTypeSlug}/${mfr.slug}`,
      })),
    },
  }

  return (
    <>
      <SEO title={title} description={description} canonical={canonical} />
      <BreadcrumbJsonLd
        items={[
          { name: 'FixitHub', url: BASE_URL },
          { name: `${dtEntry.name} Reparatur`, url: `${BASE_URL}${canonical}` },
        ]}
      />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(serviceJsonLd)}</script>
      </Helmet>

      <main className="container mx-auto px-4 py-10 max-w-5xl">
        {/* Breadcrumb */}
        <nav aria-label="Brotkrumennavigation" className="text-sm text-muted-foreground mb-6">
          <ol className="flex flex-wrap gap-1">
            <li><Link to="/" className="hover:underline">FixitHub</Link></li>
            <li aria-hidden="true">›</li>
            <li aria-current="page">{dtEntry.name} Reparatur</li>
          </ol>
        </nav>

        <h1 className="text-3xl font-bold mb-3">{dtEntry.name} Reparatur</h1>
        <p className="text-muted-foreground mb-8 max-w-2xl">
          Bei FixitHub reparieren wir dein {dtEntry.name} schnell, fair und mit Garantie.
          Wähle deinen Hersteller, um alle verfügbaren Modelle und Reparaturservices zu sehen.
        </p>

        <section aria-labelledby="manufacturers-heading">
          <h2 id="manufacturers-heading" className="text-xl font-semibold mb-4">
            Hersteller ({dtEntry.manufacturers.length})
          </h2>
          <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {dtEntry.manufacturers.map((mfr) => (
              <li key={mfr.slug}>
                <Link
                  to={`/reparatur/${deviceTypeSlug}/${mfr.slug}`}
                  className="block rounded-lg border p-4 hover:border-primary hover:bg-accent transition-colors text-center font-medium"
                >
                  {mfr.name}
                  <span className="block text-xs text-muted-foreground mt-1">
                    {mfr.models.length} Modell{mfr.models.length !== 1 ? 'e' : ''}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-10">
          <button
            onClick={() => navigate('/new-order')}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity"
          >
            Jetzt Reparatur starten
          </button>
        </div>
      </main>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Level 2 – Manufacturer page: /reparatur/:deviceType/:manufacturer
// ─────────────────────────────────────────────────────────────────────────────

function ManufacturerPage({
  dtEntry,
  mfrEntry,
  deviceTypeSlug,
  manufacturerSlug,
}: {
  dtEntry: RepairCatalogDeviceType
  mfrEntry: RepairCatalogManufacturer
  deviceTypeSlug: string
  manufacturerSlug: string
}) {
  const navigate = useNavigate()
  const canonical = `/reparatur/${deviceTypeSlug}/${manufacturerSlug}`
  const title = `${mfrEntry.name} ${dtEntry.name} Reparatur | FixitHub`
  const description = `Professionelle ${mfrEntry.name} ${dtEntry.name}-Reparatur bei FixitHub. ${mfrEntry.models.length} Modelle verfügbar – wähle dein Modell und starte die Reparaturanfrage.`

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${mfrEntry.name} ${dtEntry.name} Modelle – Reparaturangebot`,
    description,
    url: `${BASE_URL}${canonical}`,
    itemListElement: mfrEntry.models.map((model, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: `${mfrEntry.name} ${model.name} Reparatur`,
      url: `${BASE_URL}/reparatur/${deviceTypeSlug}/${manufacturerSlug}/${model.slug}`,
    })),
  }

  return (
    <>
      <SEO title={title} description={description} canonical={canonical} />
      <BreadcrumbJsonLd
        items={[
          { name: 'FixitHub', url: BASE_URL },
          { name: `${dtEntry.name} Reparatur`, url: `${BASE_URL}/reparatur/${deviceTypeSlug}` },
          { name: mfrEntry.name, url: `${BASE_URL}${canonical}` },
        ]}
      />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(itemListJsonLd)}</script>
      </Helmet>

      <main className="container mx-auto px-4 py-10 max-w-5xl">
        {/* Breadcrumb */}
        <nav aria-label="Brotkrumennavigation" className="text-sm text-muted-foreground mb-6">
          <ol className="flex flex-wrap gap-1">
            <li><Link to="/" className="hover:underline">FixitHub</Link></li>
            <li aria-hidden="true">›</li>
            <li><Link to={`/reparatur/${deviceTypeSlug}`} className="hover:underline">{dtEntry.name} Reparatur</Link></li>
            <li aria-hidden="true">›</li>
            <li aria-current="page">{mfrEntry.name}</li>
          </ol>
        </nav>

        <h1 className="text-3xl font-bold mb-3">{mfrEntry.name} {dtEntry.name} Reparatur</h1>
        <p className="text-muted-foreground mb-8 max-w-2xl">
          Wähle dein {mfrEntry.name} Modell, um die verfügbaren Reparaturservices und Preise zu sehen.
        </p>

        <section aria-labelledby="models-heading">
          <h2 id="models-heading" className="text-xl font-semibold mb-4">
            Modelle ({mfrEntry.models.length})
          </h2>
          <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {mfrEntry.models.map((model) => (
              <li key={model.slug}>
                <Link
                  to={`/reparatur/${deviceTypeSlug}/${manufacturerSlug}/${model.slug}`}
                  className="block rounded-lg border p-4 hover:border-primary hover:bg-accent transition-colors"
                >
                  {model.image && (
                    <img
                      src={model.image}
                      alt={`${mfrEntry.name} ${model.name}`}
                      className="w-10 h-10 object-contain mx-auto mb-2"
                      loading="lazy"
                    />
                  )}
                  <span className="block text-center font-medium text-sm">{model.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-10">
          <button
            onClick={() => navigate('/new-order')}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity"
          >
            Modell nicht gefunden? Konfigurieren
          </button>
        </div>
      </main>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Level 3 – Model page: /reparatur/:deviceType/:manufacturer/:model
// ─────────────────────────────────────────────────────────────────────────────

function ModelPage({
  dtEntry,
  mfrEntry,
  modelEntry,
  deviceTypeSlug,
  manufacturerSlug,
  modelSlug,
}: {
  dtEntry: RepairCatalogDeviceType
  mfrEntry: RepairCatalogManufacturer
  modelEntry: RepairCatalogModel
  deviceTypeSlug: string
  manufacturerSlug: string
  modelSlug: string
}) {
  const navigate = useNavigate()
  const canonical = `/reparatur/${deviceTypeSlug}/${manufacturerSlug}/${modelSlug}`
  const fullName = `${mfrEntry.name} ${modelEntry.name}`
  const title = `${fullName} Reparatur – Preise & Services | FixitHub`

  const [services, setServices] = useState<RepairCatalogService[]>([])
  const [addOns, setAddOns] = useState<RepairCatalogAddOn[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    getRepairCatalogServices(deviceTypeSlug, manufacturerSlug, modelSlug)
      .then((data) => {
        if (active) {
          setServices(data.services ?? [])
          setAddOns(data.addOns ?? [])
        }
      })
      .catch(console.error)
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [deviceTypeSlug, manufacturerSlug, modelSlug])

  const description =
    services.length > 0
      ? `${fullName} Reparatur bei FixitHub: ${services.slice(0, 3).map((s) => s.seoName || s.name).join(', ')} und mehr. Jetzt Preise vergleichen und Reparatur starten.`
      : `Professionelle ${fullName} Reparatur bei FixitHub. Schnell, fair und mit Garantie.`

  // JSON-LD: ItemList of repair offers
  const offersJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${fullName} Reparatur – Preisübersicht`,
    description,
    url: `${BASE_URL}${canonical}`,
    itemListElement: services.map((service, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Service',
        name: service.seoName || service.name,
        description: service.description,
        offers: {
          '@type': 'Offer',
          price: service.price,
          priceCurrency: 'EUR',
          availability: 'https://schema.org/InStock',
          seller: {
            '@type': 'LocalBusiness',
            name: 'FixitHub',
            url: BASE_URL,
          },
        },
        provider: { '@type': 'LocalBusiness', name: 'FixitHub', url: BASE_URL },
      },
    })),
  }

  return (
    <>
      <SEO title={title} description={description} canonical={canonical} />
      <BreadcrumbJsonLd
        items={[
          { name: 'FixitHub', url: BASE_URL },
          { name: `${dtEntry.name} Reparatur`, url: `${BASE_URL}/reparatur/${deviceTypeSlug}` },
          { name: mfrEntry.name, url: `${BASE_URL}/reparatur/${deviceTypeSlug}/${manufacturerSlug}` },
          { name: modelEntry.name, url: `${BASE_URL}${canonical}` },
        ]}
      />
      {services.length > 0 && (
        <Helmet>
          <script type="application/ld+json">{JSON.stringify(offersJsonLd)}</script>
        </Helmet>
      )}

      <main className="container mx-auto px-4 py-10 max-w-5xl">
        {/* Breadcrumb */}
        <nav aria-label="Brotkrumennavigation" className="text-sm text-muted-foreground mb-6">
          <ol className="flex flex-wrap gap-1">
            <li><Link to="/" className="hover:underline">FixitHub</Link></li>
            <li aria-hidden="true">›</li>
            <li><Link to={`/reparatur/${deviceTypeSlug}`} className="hover:underline">{dtEntry.name} Reparatur</Link></li>
            <li aria-hidden="true">›</li>
            <li><Link to={`/reparatur/${deviceTypeSlug}/${manufacturerSlug}`} className="hover:underline">{mfrEntry.name}</Link></li>
            <li aria-hidden="true">›</li>
            <li aria-current="page">{modelEntry.name}</li>
          </ol>
        </nav>

        <header className="flex items-start gap-6 mb-8">
          {modelEntry.image && (
            <img
              src={modelEntry.image}
              alt={fullName}
              className="w-20 h-20 object-contain flex-shrink-0"
            />
          )}
          <div>
            <h1 className="text-3xl font-bold mb-2">{fullName} Reparatur</h1>
            <p className="text-muted-foreground max-w-2xl">
              Professionelle {fullName}-Reparatur bei FixitHub — schnell, fair und mit Garantie.
              Alle verfügbaren Reparaturservices und Add-ons auf einem Blick.
            </p>
          </div>
        </header>

        {loading ? (
          <p className="text-muted-foreground">Reparaturservices werden geladen…</p>
        ) : (
          <>
            {/* Repair Services */}
            {services.length > 0 && (
              <section aria-labelledby="services-heading" className="mb-10">
                <h2 id="services-heading" className="text-xl font-semibold mb-4">
                  Reparaturservices ({services.length})
                </h2>
                <ul className="divide-y border rounded-lg overflow-hidden">
                  {services.map((service) => (
                    <li key={service._id} className="flex items-center justify-between px-5 py-4 hover:bg-accent/50">
                      <div>
                        <span className="font-medium">{service.seoName || service.name}</span>
                        {service.description && (
                          <p className="text-sm text-muted-foreground mt-0.5 max-w-lg">{service.description}</p>
                        )}
                        {service.estimatedTime && (
                          <p className="text-xs text-muted-foreground mt-0.5">⏱ {service.estimatedTime}</p>
                        )}
                      </div>
                      <span className="font-semibold text-primary whitespace-nowrap ml-4">
                        {formatPrice(service.price)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Add-On Services */}
            {addOns.length > 0 && (
              <section aria-labelledby="addons-heading" className="mb-10">
                <h2 id="addons-heading" className="text-xl font-semibold mb-4">
                  Zusatzleistungen
                </h2>
                <ul className="divide-y border rounded-lg overflow-hidden">
                  {addOns.map((addon) => (
                    <li key={addon._id} className="flex items-center justify-between px-5 py-4 hover:bg-accent/50">
                      <div>
                        <span className="font-medium">{addon.name}</span>
                        {addon.description && (
                          <p className="text-sm text-muted-foreground mt-0.5 max-w-lg">{addon.description}</p>
                        )}
                      </div>
                      {addon.price > 0 && (
                        <span className="font-semibold text-primary whitespace-nowrap ml-4">
                          {formatPrice(addon.price)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {services.length === 0 && addOns.length === 0 && (
              <p className="text-muted-foreground">
                Für dieses Modell sind aktuell noch keine Reparaturservices hinterlegt.
                Starte eine Reparaturanfrage, wir helfen dir gerne weiter.
              </p>
            )}
          </>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={() => navigate('/new-order')}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity"
          >
            Jetzt Reparatur buchen
          </button>
          <Link
            to={`/reparatur/${deviceTypeSlug}/${manufacturerSlug}`}
            className="inline-flex items-center gap-2 border px-6 py-3 rounded-lg font-semibold hover:bg-accent transition-colors"
          >
            Andere {mfrEntry.name} Modelle
          </Link>
        </div>
      </main>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Root export – resolves the correct level based on URL params
// ─────────────────────────────────────────────────────────────────────────────

export function RepairCatalogPage() {
  const { deviceType: deviceTypeSlug, manufacturer: manufacturerSlug, model: modelSlug } = useParams<{
    deviceType: string
    manufacturer?: string
    model?: string
  }>()

  const [catalog, setCatalog] = useState<RepairCatalogDeviceType[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getRepairCatalog()
      .then(setCatalog)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <main className="container mx-auto px-4 py-20 text-center">
        <p className="text-muted-foreground">Lade Reparaturkatalog…</p>
      </main>
    )
  }

  const dtEntry = catalog.find((d) => d.slug === deviceTypeSlug)
  if (!dtEntry) {
    return (
      <main className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold mb-4">Gerätetyp nicht gefunden</h1>
        <Link to="/new-order" className="text-primary underline">
          Zur Reparaturanfrage
        </Link>
      </main>
    )
  }

  if (!manufacturerSlug) {
    return <DeviceTypePage dtEntry={dtEntry} deviceTypeSlug={deviceTypeSlug!} />
  }

  const mfrEntry = dtEntry.manufacturers.find((m) => m.slug === manufacturerSlug)
  if (!mfrEntry) {
    return (
      <main className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold mb-4">Hersteller nicht gefunden</h1>
        <Link to={`/reparatur/${deviceTypeSlug}`} className="text-primary underline">
          Zurück zu {dtEntry.name}
        </Link>
      </main>
    )
  }

  if (!modelSlug) {
    return (
      <ManufacturerPage
        dtEntry={dtEntry}
        mfrEntry={mfrEntry}
        deviceTypeSlug={deviceTypeSlug!}
        manufacturerSlug={manufacturerSlug}
      />
    )
  }

  const modelEntry = mfrEntry.models.find((m) => m.slug === modelSlug)
  if (!modelEntry) {
    return (
      <main className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold mb-4">Modell nicht gefunden</h1>
        <Link to={`/reparatur/${deviceTypeSlug}/${manufacturerSlug}`} className="text-primary underline">
          Zurück zu {mfrEntry.name}
        </Link>
      </main>
    )
  }

  return (
    <ModelPage
      dtEntry={dtEntry}
      mfrEntry={mfrEntry}
      modelEntry={modelEntry}
      deviceTypeSlug={deviceTypeSlug!}
      manufacturerSlug={manufacturerSlug}
      modelSlug={modelSlug}
    />
  )
}
