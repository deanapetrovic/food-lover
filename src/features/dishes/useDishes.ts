import { useQuery } from '@tanstack/react-query'
import type { DishStatus } from '@/lib/database.types'
import { getDish, listDishes } from '@/lib/repositories/dishes'

/** Prefix of every dish list key, so one invalidate refreshes tried + want-to-try lists. */
export const dishesKey = ['dishes'] as const

export function useDishes(status?: DishStatus) {
  return useQuery({
    queryKey: [...dishesKey, status ?? 'all'],
    queryFn: () => listDishes({ status }),
  })
}

export function useDish(id: string | null) {
  return useQuery({
    queryKey: ['dish', id],
    queryFn: () => getDish(id as string),
    enabled: Boolean(id),
    staleTime: 0,
  })
}
