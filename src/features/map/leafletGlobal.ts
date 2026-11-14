// leaflet.markercluster is a UMD plugin that expects a global `L`. Under ES modules there
// isn't one, so we set it here. Import this module BEFORE 'leaflet.markercluster'.
import L from 'leaflet'

;(globalThis as unknown as { L: typeof L }).L = L

export default L
