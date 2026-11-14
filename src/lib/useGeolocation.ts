import { useEffect, useState } from 'react'
import type { Coords } from '@/lib/places'

export interface GeoState {
  status: 'pending' | 'ready' | 'denied' | 'unavailable'
  coords: Coords | null
}

/** Requests the position once on mount. Needs HTTPS (or localhost) on a phone. */
export function useGeolocation(): GeoState {
  const [state, setState] = useState<GeoState>({ status: 'pending', coords: null })

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setState({ status: 'unavailable', coords: null })
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setState({
          status: 'ready',
          coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
        }),
      (err) =>
        setState({ status: err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable', coords: null }),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    )
  }, [])

  return state
}
