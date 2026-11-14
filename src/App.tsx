import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { LoginPage } from '@/features/auth/LoginPage'
import { AppShell } from '@/components/AppShell'
import { Placeholder } from '@/routes/Placeholder'
import { DishesPage } from '@/features/dishes/DishesPage'
import { LogDishPage } from '@/features/log/LogDishPage'

const queryClient = new QueryClient()

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<DishesPage />} />
          <Route path="want" element={<Placeholder title="Want to try" milestone="Milestone 3" />} />
          <Route path="map" element={<Placeholder title="Map" milestone="Milestone 6" />} />
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
