import { useQuery } from '@tanstack/react-query'
import { listDishes } from '@/lib/repositories/dishes'

export const dishesKey = ['dishes'] as const

export function useDishes() {
  return useQuery({ queryKey: dishesKey, queryFn: listDishes })
}
