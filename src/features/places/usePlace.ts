import { useQuery } from '@tanstack/react-query'
import { dishesKey } from '@/features/dishes/useDishes'
import { getPlace, listDishesAtPlace } from '@/lib/repositories/places'

export function usePlace(id: string | null) {
  return useQuery({
    queryKey: ['place', id],
    queryFn: () => getPlace(id as string),
    enabled: Boolean(id),
  })
}

// Under ['dishes'] so logging, converting or deleting a dish refreshes the place page too.
export function useDishesAtPlace(id: string | null) {
  return useQuery({
    queryKey: [...dishesKey, 'at-place', id],
    queryFn: () => listDishesAtPlace(id as string),
    enabled: Boolean(id),
  })
}
