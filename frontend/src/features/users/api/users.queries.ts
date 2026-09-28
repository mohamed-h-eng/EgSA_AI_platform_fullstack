import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { EditUserValues } from '../model/schemas'
import type { ManagedUser, UserFilters } from '../model/types'
import * as api from './users.api'

export const usersKeys = {
  all: ['users'] as const,
  lists: () => [...usersKeys.all, 'list'] as const,
  list: (filters: UserFilters) => [...usersKeys.lists(), filters] as const,
  detail: (id: string) => [...usersKeys.all, 'detail', id] as const,
  roles: () => ['roles'] as const,
}

export function useUsers(filters: UserFilters, enabled = true) {
  return useQuery({
    queryKey: usersKeys.list(filters),
    queryFn: () => api.listUsers(filters),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useUser(id: string | null) {
  return useQuery({
    queryKey: usersKeys.detail(id ?? ''),
    queryFn: () => api.getUser(id!),
    enabled: !!id,
  })
}

export function useRoles() {
  return useQuery({ queryKey: usersKeys.roles(), queryFn: api.listRoles, staleTime: 5 * 60_000 })
}

/** After any change: refresh lists and seed the detail cache with the server's copy. */
function useApplyUser() {
  const queryClient = useQueryClient()
  return (user: ManagedUser) => {
    queryClient.setQueryData(usersKeys.detail(user.id), user)
    void queryClient.invalidateQueries({ queryKey: usersKeys.lists() })
  }
}

export function useCreateUser() {
  const apply = useApplyUser()
  return useMutation({ mutationFn: api.createUser, onSuccess: (res) => apply(res.user) })
}

export function useUpdateUser(id: string) {
  const apply = useApplyUser()
  return useMutation({
    mutationFn: (values: EditUserValues) => api.updateUser(id, values),
    onSuccess: apply,
  })
}

export function useSetUserActive(id: string) {
  const apply = useApplyUser()
  return useMutation({
    mutationFn: (active: boolean) => api.setUserActive(id, active),
    onSuccess: apply,
  })
}

export function useAssignRole(id: string) {
  const apply = useApplyUser()
  return useMutation({ mutationFn: (role: string) => api.assignRole(id, role), onSuccess: apply })
}

export function useResetPassword(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.resetPassword(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: usersKeys.detail(id) })
      void queryClient.invalidateQueries({ queryKey: usersKeys.lists() })
    },
  })
}
