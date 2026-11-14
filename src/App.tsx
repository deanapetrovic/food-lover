import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { LoginPage } from '@/features/auth/LoginPage'
import { AppShell } from '@/components/AppShell'
import { Placeholder } from '@/routes/Placeholder'
import { DishesPage } from '@/features/dishes/DishesPage'
import { LogDishPage } from '@/features/log/LogDishPage'
import { PlacePage } from '@/features/places/PlacePage'
import { WantPage } from '@/features/want/WantPage'
import { AddWantPage, ShareRedirect } from '@/features/want/AddWantPage'

// The map (Leaflet) is the heaviest dependency, so it loads only when the Map tab is opened.
const MapPage = lazy(() => import('@/features/map/MapPage').then((m) => ({ default: m.MapPage })))

const queryClient = new QueryClient()

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<DishesPage />} />
          <Route path="want" element={<WantPage />} />
          <Route path="want/add" element={<AddWantPage />} />
          <Route path="share" element={<ShareRedirect />} />
          <Route path="place/:id" element={<PlacePage />} />
          <Route path="map" element={<Suspense fallback={<p className="p-4 text-muted">Loading map…</p>}><MapPage /></Suspense>} />
          <Route path="lists" element={<Placeholder title="Lists" milestone="Milestone 7" />} />
          <Route path="log" element={<LogDishPage />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter><AppRoutes /></BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
