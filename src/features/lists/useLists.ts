import { useQuery } from '@tanstack/react-query'
import { getList, listLists } from '@/lib/repositories/lists'

/** Prefix of every list query, so one invalidate refreshes the lists tab and the open list. */
export const listsKey = ['lists'] as const

export function useLists() {
  return useQuery({ queryKey: [...listsKey, 'all'], queryFn: listLists })
}

export function useList(id: string | null) {
  return useQuery({
    queryKey: [...listsKey, 'one', id],
    queryFn: () => getList(id as string),
    enabled: Boolean(id),
  })
}
