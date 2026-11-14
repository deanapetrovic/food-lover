import { useEffect, useRef } from 'react'
import L from './leafletGlobal'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'

export interface MapMarker {
  id: string
  lat: number
  lng: number
  /** tried = filled pin, want = outlined pin */
  kind: 'tried' | 'want'
  /** Text inside the pin (e.g. the best rating). */
  badge: string | null
  label: string
}

export interface MapViewProps {
  markers: MapMarker[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  /** When set, the map flies to this point and shows a "you are here" dot. */
  userLocation?: { lat: number; lng: number } | null
  className?: string
}

// Swap the tile provider here (OSM's free tiles are for light use; see their tile usage policy).
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

function pinIcon(m: MapMarker, selected: boolean) {
  const size = selected ? 38 : 32
  const filled = m.kind === 'tried'
  const style = [
    `width:${size}px`, `height:${size}px`, 'border-radius:9999px', 'display:grid', 'place-items:center',
    'font:700 14px/1 system-ui,-apple-system,sans-serif', 'box-shadow:0 2px 6px rgba(0,0,0,.35)',
    filled ? 'background:var(--accent);color:var(--accent-text);border:2px solid var(--surface)'
           : 'background:var(--surface);color:var(--accent);border:3px solid var(--accent)',
  ].join(';')
  return L.divIcon({
    className: '',
    html: `<div style="${style}">${m.badge ? esc(m.badge) : ''}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

function clusterIcon(cluster: L.MarkerCluster) {
  const n = cluster.getChildCount()
  const style = [
    // Neutral rounded square, so a cluster ("4 places here") is never mistaken for a rated pin.
    'width:42px', 'height:42px', 'border-radius:12px', 'display:grid', 'place-items:center',
    'background:var(--text)', 'color:var(--bg)', 'border:3px solid var(--surface)',
    'font:700 15px/1 system-ui,-apple-system,sans-serif', 'box-shadow:0 2px 8px rgba(0,0,0,.4)',
  ].join(';')
  return L.divIcon({ className: '', html: `<div style="${style}">${n}</div>`, iconSize: [42, 42] })
}

export function MapView({ markers, selectedId, onSelect, userLocation, className }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null)
  const userRef = useRef<L.CircleMarker | null>(null)
  const fittedFor = useRef('')
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  // Create the map once.
  useEffect(() => {
    const el = containerRef.current
    if (!el || mapRef.current) return
    const map = L.map(el, { zoomControl: false, attributionControl: true }).setView([20, 0], 2)
    L.control.zoom({ position: 'topright' }).addTo(map)
    L.tileLayer(TILE_URL, { maxZoom: 19, attribution: TILE_ATTRIBUTION }).addTo(map)
    const cluster = L.markerClusterGroup({
      showCoverageOnHover: false, maxClusterRadius: 45, iconCreateFunction: clusterIcon,
    })
    map.addLayer(cluster)
    map.on('click', () => onSelectRef.current(null))
    mapRef.current = map
    clusterRef.current = cluster

    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(el)
    return () => {
      ro.disconnect()
      map.remove()
      mapRef.current = null
      clusterRef.current = null
      userRef.current = null
      fittedFor.current = ''
    }
  }, [])

  // Draw the pins; zoom to fit only when the set of pins changes (not on every selection).
  useEffect(() => {
    const map = mapRef.current
    const cluster = clusterRef.current
    if (!map || !cluster) return
    cluster.clearLayers()
    const leaflets = markers.map((m) => {
      const marker = L.marker([m.lat, m.lng], {
        icon: pinIcon(m, m.id === selectedId), title: m.label, alt: m.label, keyboard: true,
      })
      marker.on('click', (e) => { L.DomEvent.stopPropagation(e); onSelectRef.current(m.id) })
      return marker
    })
    cluster.addLayers(leaflets)

    const key = markers.map((m) => m.id).sort().join('|')
    if (markers.length > 0 && key !== fittedFor.current) {
      fittedFor.current = key
      const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number]))
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 16 })
    }
  }, [markers, selectedId])

  // "You are here".
  useEffect(() => {
    const map = mapRef.current
    if (!map || !userLocation) return
    const at: [number, number] = [userLocation.lat, userLocation.lng]
    if (userRef.current) userRef.current.setLatLng(at)
    else {
      userRef.current = L.circleMarker(at, {
        radius: 8, color: '#ffffff', weight: 3, fillColor: '#007aff', fillOpacity: 1, interactive: false,
      }).addTo(map)
    }
    map.flyTo(at, Math.max(map.getZoom(), 15))
  }, [userLocation])

  return <div ref={containerRef} className={className} role="region" aria-label="Map of your places" />
}
