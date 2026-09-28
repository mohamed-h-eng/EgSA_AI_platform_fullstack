import { FolderKanban, Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'

import { Can } from '@features/auth'
import { useDebounce } from '@shared/hooks/useDebounce'
import { PageHeader } from '@shared/layout/PageHeader'
import { Button } from '@shared/ui/button'
import { FormError } from '@shared/ui/form-message'
import { Input } from '@shared/ui/input'
import { PaginationBar } from '@shared/ui/pagination-bar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/select'
import { Skeleton } from '@shared/ui/skeleton'

import { PROJECTS_PAGE_SIZE } from '../api/projects.api'
import { useProjects } from '../api/projects.queries'
import { ProjectCard } from '../components/ProjectCard'
import { ProjectFormDialog } from '../components/ProjectFormDialog'
import { PROJECT_STATUSES, type ProjectStatus, STATUS_META } from '../model/types'

const ALL = 'all'

export function ProjectsPage() {
  // ?q= comes from the header search; a new search restarts the list with that text.
  const [params] = useSearchParams()
  const q = params.get('q') ?? ''
  return <ProjectsList key={q} initialSearch={q} />
}

function ProjectsList({ initialSearch }: { initialSearch: string }) {
  const [search, setSearch] = useState(initialSearch)
  const [status, setStatus] = useState<ProjectStatus | typeof ALL>(ALL)
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)
  const q = useDebounce(search)

  const { data, isPending, isError, error, isPlaceholderData } = useProjects({
    q,
    status: status === ALL ? '' : status,
    page,
  })
  const filtered = !!q || status !== ALL

  return (
    <>
      <PageHeader
        title="Projects"
        subtitle="Space projects you are a member of, with their teams and status."
        actions={
          <Can permission="projects:create">
            <Button onClick={() => setCreating(true)}>
              <Plus aria-hidden />
              New project
            </Button>
          </Can>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative max-w-md min-w-60 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            dir="auto"
            placeholder="Search by code, name or subsystem…"
            aria-label="Search projects"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="bg-surface pl-9"
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as ProjectStatus | typeof ALL)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-48 bg-surface" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {PROJECT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_META[s].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isError ? (
        <FormError message={error.message} />
      ) : isPending ? (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-60 rounded-lg" />
          ))}
        </div>
      ) : data.total === 0 ? (
        <EmptyState filtered={filtered} />
      ) : (
        <>
          <div
            className={`grid gap-6 sm:grid-cols-2 xl:grid-cols-3 ${isPlaceholderData ? 'opacity-60' : ''}`}
          >
            {data.items.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
          {data.total > PROJECTS_PAGE_SIZE && (
            <div className="mt-6 overflow-hidden rounded-lg border bg-card">
              <PaginationBar
                page={data.page}
                pageSize={PROJECTS_PAGE_SIZE}
                total={data.total}
                onPageChange={setPage}
                noun="projects"
              />
            </div>
          )}
        </>
      )}

      <ProjectFormDialog open={creating} onOpenChange={setCreating} />
    </>
  )
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed bg-card px-6 py-16 text-center">
      <FolderKanban className="size-10 text-muted-foreground/60" aria-hidden />
      <p className="font-medium text-navy">
        {filtered ? 'No projects match your filters' : 'No projects yet'}
      </p>
      <p className="max-w-sm text-sm text-muted-foreground">
        {filtered
          ? 'Try a different search or clear the filters.'
          : "You're not a member of any project yet. Ask a project lead or an administrator for access."}
      </p>
    </div>
  )
}
