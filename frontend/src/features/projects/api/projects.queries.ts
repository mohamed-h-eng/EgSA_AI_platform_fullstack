import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { ProjectValues } from '../model/schemas'
import type { ProjectFilters, ProjectRole } from '../model/types'
import * as api from './projects.api'

export const projectsKeys = {
  all: ['projects'] as const,
  lists: () => [...projectsKeys.all, 'list'] as const,
  list: (filters: ProjectFilters) => [...projectsKeys.lists(), filters] as const,
  detail: (id: string) => [...projectsKeys.all, 'detail', id] as const,
  members: (id: string) => [...projectsKeys.all, 'members', id] as const,
  userMemberships: (userId: string) => [...projectsKeys.all, 'user', userId] as const,
  userSearch: (q: string) => ['project-member-candidates', q] as const,
}

export function useProjects(filters: ProjectFilters) {
  return useQuery({
    queryKey: projectsKeys.list(filters),
    queryFn: () => api.listProjects(filters),
    placeholderData: keepPreviousData,
  })
}

/** All projects visible to the current user (for pickers). */
export function useVisibleProjects() {
  return useQuery({
    queryKey: projectsKeys.list({ q: '', status: '', page: 1 }),
    queryFn: () => api.listProjects({ q: '', status: '', page: 1 }, 100),
    select: (page) => page.items,
  })
}

export function useProject(id: string) {
  return useQuery({ queryKey: projectsKeys.detail(id), queryFn: () => api.getProject(id) })
}

export function useMembers(projectId: string) {
  return useQuery({
    queryKey: projectsKeys.members(projectId),
    queryFn: () => api.listMembers(projectId),
  })
}

export function useUserMemberships(userId: string) {
  return useQuery({
    queryKey: projectsKeys.userMemberships(userId),
    queryFn: () => api.listUserMemberships(userId),
  })
}

export function useUserSearch(q: string, enabled: boolean) {
  return useQuery({
    queryKey: projectsKeys.userSearch(q),
    queryFn: () => api.searchUsers(q),
    enabled,
    placeholderData: keepPreviousData,
  })
}

export function useCreateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: api.createProject,
    onSuccess: (project) => {
      queryClient.setQueryData(projectsKeys.detail(project.id), project)
      void queryClient.invalidateQueries({ queryKey: projectsKeys.lists() })
    },
  })
}

export function useUpdateProject(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: ProjectValues) => api.updateProject(id, values),
    onSuccess: (project) => {
      queryClient.setQueryData(projectsKeys.detail(id), project)
      void queryClient.invalidateQueries({ queryKey: projectsKeys.lists() })
    },
  })
}

export function useDeleteProject(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.deleteProject(id),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: projectsKeys.detail(id) })
      void queryClient.invalidateQueries({ queryKey: projectsKeys.all })
    },
  })
}

/** Membership changes affect the member list, counts, the detail and user drawers. */
function useInvalidateMembership(projectId: string) {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: projectsKeys.members(projectId) })
    void queryClient.invalidateQueries({ queryKey: projectsKeys.detail(projectId) })
    void queryClient.invalidateQueries({ queryKey: projectsKeys.lists() })
    void queryClient.invalidateQueries({ queryKey: [...projectsKeys.all, 'user'] })
  }
}

export function useAddMember(projectId: string) {
  const invalidate = useInvalidateMembership(projectId)
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: ProjectRole }) =>
      api.addMember(projectId, userId, role),
    onSuccess: invalidate,
  })
}

export function useUpdateMember(projectId: string) {
  const invalidate = useInvalidateMembership(projectId)
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: ProjectRole }) =>
      api.updateMember(projectId, userId, role),
    onSuccess: invalidate,
  })
}

export function useRemoveMember(projectId: string) {
  const invalidate = useInvalidateMembership(projectId)
  return useMutation({
    mutationFn: (userId: string) => api.removeMember(projectId, userId),
    onSuccess: invalidate,
  })
}
