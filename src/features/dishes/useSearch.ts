import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { listMyCities, searchDishes, type SearchParams } from '@/lib/repositories/search'
import { dishesKey } from './useDishes'

// Both keys sit under ['dishes'], so saving, converting or deleting a dish refreshes them.
export function useSearchDishes(params: SearchParams) {
  return useQuery({
    queryKey: [...dishesKey, 'search', params],
    queryFn: () => searchDishes(params),
    placeholderData: keepPreviousData, // no flicker while the next keystroke's results load
  })
}

export function useCities() {
  return useQuery({ queryKey: [...dishesKey, 'cities'], queryFn: listMyCities })
}
