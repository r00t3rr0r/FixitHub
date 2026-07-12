import { useState, useEffect, useRef, useCallback } from 'react'
import { SEO } from '@/components/SEO'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MapPin, Search, Map, List, Home, ChevronRight, Shield, Clock, MapPinned } from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { McRepairNav } from '@/components/home/McRepairNav'
import { Footer } from '@/components/Footer'
import { LOCATIONS, type LocationData } from '@/data/annahmestellenData'

const ZOOM_LABEL_THRESHOLD = 9

function getLabel(name: string) {
  return name.replace(/^(EP:|SP:|SP\s|EP\s)/, '').trim().substring(0, 2).toUpperCase()
}

function createPinIcon(label: string, isActive: boolean, isHQ = false, zoomed = false) {
  if (isHQ) return createHQPinIcon(isActive, zoomed)

  const color = isActive ? '#1a2a5e' : '#e53e3e'
  const shadowColor = isActive ? 'rgba(26,42,94,0.4)' : 'rgba(229,62,62,0.35)'

  if (!zoomed) {
    // Zoomed out: simple small dot
    const size = isActive ? 18 : 14
    return L.divIcon({
      className: 'as-leaflet-pin',
      html: `<div class="as-pin-dot ${isActive ? 'active' : ''}" style="width:${size}px;height:${size}px;background:${color};box-shadow:0 2px 6px ${shadowColor}"></div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2]
    })
  }

  // Zoomed in: pin with 2-letter label
  const size = isActive ? 42 : 36
  return L.divIcon({
    className: 'as-leaflet-pin',
    html: `
      <div class="as-pin-wrapper ${isActive ? 'active' : ''}" style="--pin-color:${color};--pin-shadow:${shadowColor}">
        <svg width="${size}" height="${Math.round(size * 1.5)}" viewBox="0 0 36 54" fill="none">
          <path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 36 18 36s18-22.5 18-36C36 8.06 27.94 0 18 0z" fill="${color}"/>
          <circle cx="18" cy="16" r="11" fill="#fff"/>
          <text x="18" y="20.5" text-anchor="middle" font-family="Inter,sans-serif" font-size="11" font-weight="800" fill="${color}">${label}</text>
        </svg>
      </div>
    `,
    iconSize: [size, Math.round(size * 1.5)],
    iconAnchor: [size / 2, Math.round(size * 1.5)],
    popupAnchor: [0, -Math.round(size * 1.35)]
  })
}

function createHQPinIcon(isActive: boolean, zoomed = false) {
  if (!zoomed) {
    // Zoomed out: golden dot, bigger than others
    const size = isActive ? 22 : 18
    return L.divIcon({
      className: 'as-leaflet-pin as-leaflet-pin-hq',
      html: `<div class="as-pin-dot as-pin-dot-hq ${isActive ? 'active' : ''}" style="width:${size}px;height:${size}px"></div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2]
    })
  }

  const size = isActive ? 54 : 48
  return L.divIcon({
    className: 'as-leaflet-pin as-leaflet-pin-hq',
    html: `
      <div class="as-pin-wrapper as-pin-hq ${isActive ? 'active' : ''}">
        <svg width="${size}" height="${Math.round(size * 1.4)}" viewBox="0 0 48 67" fill="none">
          <defs>
            <linearGradient id="hqGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#f59e0b"/>
              <stop offset="100%" stop-color="#d97706"/>
            </linearGradient>
            <filter id="hqShadow"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="rgba(245,158,11,0.5)"/></filter>
          </defs>
          <path d="M24 0C10.75 0 0 10.75 0 24c0 18 24 43 24 43s24-25 24-43C48 10.75 37.25 0 24 0z" fill="url(#hqGrad)" filter="url(#hqShadow)"/>
          <circle cx="24" cy="21" r="14" fill="#fff"/>
          <text x="24" y="19" text-anchor="middle" font-family="Inter,sans-serif" font-size="8" font-weight="700" fill="#d97706">★</text>
          <text x="24" y="28" text-anchor="middle" font-family="Inter,sans-serif" font-size="8" font-weight="800" fill="#1a2a5e">HQ</text>
        </svg>
      </div>
    `,
    iconSize: [size, Math.round(size * 1.4)],
    iconAnchor: [size / 2, Math.round(size * 1.4)],
    popupAnchor: [0, -Math.round(size * 1.25)]
  })
}

function buildPopupHTML(loc: LocationData) {
  const hqBadge = loc.isHQ ? '<span class="as-popup-hq-badge">★ Hauptzentrale</span>' : ''
  return `
    <div class="as-leaflet-popup${loc.isHQ ? ' as-popup-hq' : ''}">
      <div class="as-leaflet-popup-header">
        <span class="as-leaflet-popup-marker${loc.isHQ ? ' as-marker-hq' : ''}">${loc.isHQ ? '★' : loc.id}</span>
        <div class="as-leaflet-popup-title">
          <div class="as-leaflet-popup-name">${loc.name}</div>
          ${hqBadge}
        </div>
      </div>
      <div class="as-leaflet-popup-body">
        <div class="as-leaflet-popup-row">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1a2a5e" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          <span>${loc.address}</span>
        </div>
        <div class="as-leaflet-popup-row">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1a2a5e" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.11 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          <a href="tel:${loc.phone}">${loc.phone}</a>
        </div>
        <div class="as-leaflet-popup-row">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1a2a5e" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          <a href="mailto:${loc.email}">${loc.email}</a>
        </div>
      </div>
    </div>
  `
}

export function Annahmestellen() {
  const { t } = useTranslation()
  const [activeView, setActiveView] = useState<'map' | 'list'>('map')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeLocationId, setActiveLocationId] = useState<string | null>(null)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<Record<string, L.Marker>>({})
  const markersLayerRef = useRef<L.LayerGroup | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)

  const filtered = searchQuery.trim()
    ? LOCATIONS.filter(loc => {
        const q = searchQuery.toLowerCase()
        return loc.name.toLowerCase().includes(q) ||
          loc.address.toLowerCase().includes(q) ||
          loc.email.toLowerCase().includes(q) ||
          loc.phone.includes(q)
      })
    : LOCATIONS

  // Initialize Leaflet map (vanilla)
  useEffect(() => {
    if (activeView !== 'map' || !mapContainerRef.current || mapRef.current) return

    const map = L.map(mapContainerRef.current, {
      center: [51.1657, 10.4515],
      zoom: 6,
      minZoom: 5,
      maxZoom: 18,
      zoomControl: false,
      attributionControl: true,
    })

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map)

    L.control.zoom({ position: 'bottomright' }).addTo(map)

    const markersLayer = L.layerGroup().addTo(map)
    markersLayerRef.current = markersLayer
    mapRef.current = map

    setTimeout(() => map.invalidateSize(), 200)

    return () => {
      map.remove()
      mapRef.current = null
      markersLayerRef.current = null
      markersRef.current = {}
    }
  }, [activeView])

  // Render markers when filtered data changes
  useEffect(() => {
    const map = mapRef.current
    const markersLayer = markersLayerRef.current
    if (!map || !markersLayer) return

    markersLayer.clearLayers()
    markersRef.current = {}
    const bounds: L.LatLngTuple[] = []
    const zoomed = map.getZoom() >= ZOOM_LABEL_THRESHOLD

    filtered.forEach(loc => {
      const label = getLabel(loc.name)
      const marker = L.marker([loc.lat, loc.lng], {
        icon: createPinIcon(label, false, loc.isHQ, zoomed),
        riseOnHover: true,
        zIndexOffset: loc.isHQ ? 1000 : 0,
      })

      marker.bindPopup(buildPopupHTML(loc), {
        maxWidth: 280,
        minWidth: 220,
        className: 'as-leaflet-popup-container',
        closeButton: true,
        autoPan: true,
      })

      marker.on('click', () => {
        const z = map.getZoom() >= ZOOM_LABEL_THRESHOLD
        Object.entries(markersRef.current).forEach(([id, m]) => {
          const otherLoc = filtered.find(l => l.id === id)
          if (id !== loc.id) m.setIcon(createPinIcon(getLabel(otherLoc?.name ?? ''), false, otherLoc?.isHQ, z))
        })
        marker.setIcon(createPinIcon(label, true, loc.isHQ, z))
        setActiveLocationId(loc.id)
        if (sidebarRef.current) {
          const el = sidebarRef.current.querySelector(`[data-loc-id="${loc.id}"]`)
          el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }
      })

      if (!('ontouchstart' in window)) {
        marker.on('mouseover', () => {
          if (markersRef.current[loc.id] !== marker) return
          marker.setIcon(createPinIcon(label, true, loc.isHQ, map.getZoom() >= ZOOM_LABEL_THRESHOLD))
        })
        marker.on('mouseout', () => {
          if (loc.id === activeLocationId) return
          marker.setIcon(createPinIcon(label, false, loc.isHQ, map.getZoom() >= ZOOM_LABEL_THRESHOLD))
        })
      }

      markersLayer.addLayer(marker)
      markersRef.current[loc.id] = marker
      bounds.push([loc.lat, loc.lng])
    })

    if (bounds.length > 0) {
      setTimeout(() => {
        map.invalidateSize()
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 7 })
      }, 100)
    }
  }, [filtered, activeView])

  // Update marker icons on zoom change
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const onZoom = () => {
      const z = map.getZoom() >= ZOOM_LABEL_THRESHOLD
      Object.entries(markersRef.current).forEach(([id, m]) => {
        const loc = LOCATIONS.find(l => l.id === id)
        const isActive = id === activeLocationId
        m.setIcon(createPinIcon(getLabel(loc?.name ?? ''), isActive, loc?.isHQ, z))
      })
    }
    map.on('zoomend', onZoom)
    return () => { map.off('zoomend', onZoom) }
  }, [activeView, activeLocationId])

  // Close popup resets active
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const handler = () => {
      const z = map.getZoom() >= ZOOM_LABEL_THRESHOLD
      Object.entries(markersRef.current).forEach(([id, m]) => {
        const loc = LOCATIONS.find(l => l.id === id)
        m.setIcon(createPinIcon(getLabel(loc?.name ?? ''), false, loc?.isHQ, z))
      })
      setActiveLocationId(null)
    }
    map.on('popupclose', handler)
    return () => { map.off('popupclose', handler) }
  }, [activeView])

  const handleLocationClick = useCallback((loc: LocationData) => {
    const map = mapRef.current
    const marker = markersRef.current[loc.id]
    if (!map || !marker) return

    // Reset all markers
    Object.entries(markersRef.current).forEach(([id, m]) => {
      const otherLoc = LOCATIONS.find(l => l.id === id)
      m.setIcon(createPinIcon(getLabel(otherLoc?.name ?? ''), false, otherLoc?.isHQ, map.getZoom() >= ZOOM_LABEL_THRESHOLD))
    })
    setActiveLocationId(loc.id)
    marker.setIcon(createPinIcon(getLabel(loc.name), true, loc.isHQ, true))
    map.flyTo([loc.lat, loc.lng], 12, { duration: 0.8 })
    setTimeout(() => marker.openPopup(), 850)
  }, [])

  return (
    <>
      <SEO
        title="Annahmestellen finden – McRepair.de in Ihrer Nähe"
        description="McRepair.de Annahmestellen in ganz Deutschland – über 350 Standorte. Finden Sie den nächsten Standort auf der Karte und bringen Sie Ihr Gerät direkt vorbei."
        canonical="/annahmestellen"
      />
      <McRepairNav />
      <section className="as-breadcrumb">
        <div className="container">
          <Link to="/">
            <Home width={14} height={14} />
          </Link>
          <ChevronRight width={8} height={8} className="as-breadcrumb-sep" />
          <span>{t('annahmestellen.breadcrumb', 'McRepair Annahmestellen')}</span>
        </div>
      </section>

      {/* Page Header */}
      <section className="as-header">
        <div className="container">
          <h1>{t('annahmestellen.title', 'Suche Annahmestellen in Deiner Umgebung')}</h1>
          <p className="as-header-subtitle">
            {t('annahmestellen.subtitle', '108 Partner-Fachgeschäfte in ganz Deutschland – finde den nächsten Standort für deine Reparatur.')}
          </p>
        </div>
      </section>

      {/* Search Bar */}
      <section className="as-search">
        <div className="container">
          <div className="as-search-row">
            <div className="as-search-input-wrap">
              <MapPin width={18} height={18} />
              <input
                type="text"
                placeholder={t('annahmestellen.searchPlaceholder', 'Adresse, PLZ oder Stadt eingeben...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button className="as-search-btn" onClick={() => {}}>
              <Search width={16} height={16} />
              {t('annahmestellen.search', 'SUCHEN')}
            </button>
          </div>
        </div>
      </section>

      {/* View Tabs */}
      <section className="as-tabs-section">
        <div className="container">
          <div className="as-tabs">
            <button
              className={`as-tab ${activeView === 'map' ? 'active' : ''}`}
              onClick={() => setActiveView('map')}
            >
              <Map width={15} height={15} />
              {t('annahmestellen.mapView', 'KARTENANSICHT')}
            </button>
            <button
              className={`as-tab ${activeView === 'list' ? 'active' : ''}`}
              onClick={() => setActiveView('list')}
            >
              <List width={15} height={15} />
              {t('annahmestellen.listView', 'LISTENANSICHT')}
            </button>
          </div>
        </div>
      </section>

      {/* Map View */}
      {activeView === 'map' && (
        <section className="as-view active">
          <div className="container">
            <div className="as-map-layout">
              <div className="as-map-container">
                <div ref={mapContainerRef} className="as-leaflet-map" />
              </div>

              {/* Sidebar */}
              <div className="as-map-sidebar">
                <div className="as-sidebar-header">
                  <span className="as-sidebar-count">
                    <strong>{filtered.length}</strong> {t('annahmestellen.found', 'Annahmestellen gefunden')}
                  </span>
                </div>
                <div className="as-location-list" ref={sidebarRef}>
                  {filtered.map((loc) => (
                    <div
                      key={loc.id}
                      data-loc-id={loc.id}
                      className={`as-location-item ${activeLocationId === loc.id ? 'active' : ''}${loc.isHQ ? ' as-location-hq' : ''}`}
                      onClick={() => handleLocationClick(loc)}
                    >
                      <div className={`as-location-marker${loc.isHQ ? ' as-marker-hq' : ''}`}>{loc.isHQ ? '★' : loc.id}</div>
                      <div className="as-location-info">
                        <div className="as-location-name">
                          {loc.name}
                          {loc.isHQ && <span className="as-hq-badge">Hauptzentrale</span>}
                        </div>
                        <div className="as-location-address">{loc.address}</div>
                        <div className="as-location-contact">
                          Tel.: {loc.phone}<br />
                          E-Mail: <a href={`mailto:${loc.email}`}>{loc.email}</a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* List View */}
      {activeView === 'list' && (
        <section className="as-view active">
          <div className="container">
            <div className="as-list-grid">
              {filtered.map((loc) => (
                <div key={loc.id} className={`as-list-card${loc.isHQ ? ' as-list-card-hq' : ''}`}>
                  <div className="as-card-logo">
                    <div className="as-card-logo-placeholder">
                      <div className="as-card-logo-icon">{loc.isHQ ? '★' : loc.logo}</div>
                      <span>{loc.name.length > 22 ? loc.name.substring(0, 22) + '…' : loc.name}</span>
                    </div>
                    <span className={`as-card-partner-badge${loc.isHQ ? ' as-badge-hq' : ''}`}>{loc.isHQ ? '★ Hauptzentrale' : 'Partner'}</span>
                  </div>
                  <div className="as-card-body">
                    <div className="as-card-name">{loc.name}</div>
                    {loc.url && <div className="as-card-url">{loc.url}</div>}
                    <div className="as-card-address">{loc.address}</div>
                    <div className="as-card-contact-row">
                      Tel.: {loc.phone}<br />
                      E-Mail: <a href={`mailto:${loc.email}`}>{loc.email}</a>
                    </div>
                    <div className="as-card-hours">
                      <h5>{t('annahmestellen.openingHours', 'Öffnungszeiten')}</h5>
                      <div className="as-card-hours-table">
                        {Object.entries(loc.hours).map(([day, time]) => (
                          <div key={day} className="as-card-hours-row">
                            <span className="as-card-hours-day">{day}:</span>
                            <span className={time === 'geschlossen' ? 'as-card-hours-closed' : ''}>{time}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Info Section */}
      <section className="as-info">
        <div className="container">
          <div className="as-info-grid">
            <div className="as-info-card">
              <div className="as-info-icon">
                <MapPinned width={28} height={28} />
              </div>
              <h3>{t('annahmestellen.infoLocations', '108 Standorte')}</h3>
              <p>{t('annahmestellen.infoLocationsDesc', 'Deutschlandweit 108 autorisierte Annahmestellen für Ihren Komfort.')}</p>
            </div>
            <div className="as-info-card">
              <div className="as-info-icon">
                <Clock width={28} height={28} />
              </div>
              <h3>{t('annahmestellen.infoFast', 'Schnelle Abwicklung')}</h3>
              <p>{t('annahmestellen.infoFastDesc', 'Gerät abgeben, wir kümmern uns um den Rest. Meist innerhalb von 24 Stunden erledigt.')}</p>
            </div>
            <div className="as-info-card">
              <div className="as-info-icon">
                <Shield width={28} height={28} />
              </div>
              <h3>{t('annahmestellen.infoWarranty', '1 Jahr Garantie')}</h3>
              <p>{t('annahmestellen.infoWarrantyDesc', 'Auf jede Reparatur erhalten Sie ein volles Jahr Qualitätsgarantie.')}</p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  )
}
