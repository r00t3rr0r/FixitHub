import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MapPin, Phone, Mail, Search, Map, List, Home, ChevronRight, Shield, Clock, MapPinned } from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { McRepairNav } from '@/components/home/McRepairNav'
import { LOCATIONS, type LocationData } from '@/data/annahmestellenData'

function createPinIcon(letter: string, isActive: boolean) {
  const color = isActive ? '#1a2a5e' : '#e53e3e'
  const shadowColor = isActive ? 'rgba(26,42,94,0.4)' : 'rgba(229,62,62,0.35)'
  const size = isActive ? 42 : 36
  return L.divIcon({
    className: 'as-leaflet-pin',
    html: `
      <div class="as-pin-wrapper ${isActive ? 'active' : ''}" style="--pin-color:${color};--pin-shadow:${shadowColor}">
        <svg width="${size}" height="${Math.round(size * 1.5)}" viewBox="0 0 36 54" fill="none">
          <path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 36 18 36s18-22.5 18-36C36 8.06 27.94 0 18 0z" fill="${color}"/>
          <circle cx="18" cy="16" r="11" fill="#fff"/>
          <text x="18" y="20.5" text-anchor="middle" font-family="Inter,sans-serif" font-size="13" font-weight="800" fill="${color}">${letter}</text>
        </svg>
      </div>
    `,
    iconSize: [size, Math.round(size * 1.5)],
    iconAnchor: [size / 2, Math.round(size * 1.5)],
    popupAnchor: [0, -Math.round(size * 1.35)]
  })
}

function buildPopupHTML(loc: LocationData) {
  return `
    <div class="as-leaflet-popup">
      <div class="as-leaflet-popup-header">
        <span class="as-leaflet-popup-marker">${loc.id}</span>
        <div class="as-leaflet-popup-title">
          <div class="as-leaflet-popup-name">${loc.name}</div>
          <div class="as-leaflet-popup-dist">${loc.distance} entfernt</div>
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

    filtered.forEach(loc => {
      const marker = L.marker([loc.lat, loc.lng], {
        icon: createPinIcon(loc.id, false),
        riseOnHover: true,
      })

      marker.bindPopup(buildPopupHTML(loc), {
        maxWidth: 280,
        minWidth: 220,
        className: 'as-leaflet-popup-container',
        closeButton: true,
        autoPan: true,
      })

      marker.on('click', () => {
        // Reset previous active
        Object.entries(markersRef.current).forEach(([id, m]) => {
          if (id !== loc.id) m.setIcon(createPinIcon(id, false))
        })
        marker.setIcon(createPinIcon(loc.id, true))
        setActiveLocationId(loc.id)
        // Scroll sidebar
        if (sidebarRef.current) {
          const el = sidebarRef.current.querySelector(`[data-loc-id="${loc.id}"]`)
          el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }
      })

      if (!('ontouchstart' in window)) {
        marker.on('mouseover', function () {
          if (markersRef.current[loc.id] !== marker) return
          this.setIcon(createPinIcon(loc.id, true))
        })
        marker.on('mouseout', function () {
          if (loc.id === activeLocationId) return
          this.setIcon(createPinIcon(loc.id, false))
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

  // Close popup resets active
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const handler = () => {
      Object.entries(markersRef.current).forEach(([id, m]) => {
        m.setIcon(createPinIcon(id, false))
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
      m.setIcon(createPinIcon(id, false))
    })
    setActiveLocationId(loc.id)
    marker.setIcon(createPinIcon(loc.id, true))
    map.flyTo([loc.lat, loc.lng], 12, { duration: 0.8 })
    setTimeout(() => marker.openPopup(), 850)
  }, [])

  return (
    <>
      <McRepairNav />

      {/* Breadcrumb */}
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
                      className={`as-location-item ${activeLocationId === loc.id ? 'active' : ''}`}
                      onClick={() => handleLocationClick(loc)}
                    >
                      <div className="as-location-marker">{loc.id}</div>
                      <div className="as-location-info">
                        <div className="as-location-name">
                          {loc.name}
                          <span className="as-location-distance">({loc.distance})</span>
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
                <div key={loc.id} className="as-list-card">
                  <div className="as-card-logo">
                    <div className="as-card-logo-placeholder">
                      <div className="as-card-logo-icon">{loc.logo}</div>
                      <span>{loc.name.length > 22 ? loc.name.substring(0, 22) + '…' : loc.name}</span>
                    </div>
                    <span className="as-card-partner-badge">Partner</span>
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
    </>
  )
}
