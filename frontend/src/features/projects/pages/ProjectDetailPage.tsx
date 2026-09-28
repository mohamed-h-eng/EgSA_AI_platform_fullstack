import { ChevronRight, Pencil, Trash2 } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { notify } from '@features/notifications'
import { ApiError } from '@shared/api/http'
import { formatDateTime } from '@shared/lib/format'
import { useSlot } from '@shared/lib/slots'
import { PageHeader } from '@shared/layout/PageHeader'
import { Button } from '@shared/ui/button'
import { Card, CardContent } from '@shared/ui/card'
import { ConfirmDialog } from '@shared/ui/confirm-dialog'
import { Skeleton } from '@shared/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/ui/tabs'

import { useDeleteProject, useProject } from '../api/projects.queries'
import { MembersPanel } from '../components/MembersPanel'
import { ProjectFormDialog } from '../components/ProjectFormDialog'
import { ProjectStatusBadge } from '../components/ProjectStatusBadge'
import { type ProjectDetail, ROLE_META } from '../model/types'

export function ProjectDetailPage() {
  const { projectId = '' } = useParams()
  const { data: project, isPending, isError, error } = useProject(projectId)

  if (isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    )
  }
  if (isError) {
    const notFound = error instanceof ApiError && error.status === 404
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-bold">
          {notFound ? 'Project not found' : 'Could not load project'}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {notFound ? "It doesn't exist or you're not a member of it." : error.message}
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/projects">Back to projects</Link>
        </Button>
      </div>
    )
  }
  return <ProjectView project={project} />
}

function ProjectView({ project }: { project: ProjectDetail }) {
  // Tabs contributed by other features (e.g. Documents) through the slots mechanism.
  const extraTabs = useSlot('projectTabs')
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const remove = useDeleteProject(project.id)
  const navigate = useNavigate()

  const confirmDelete = async () => {
    try {
      await remove.mutateAsync()
      notify.success('Project deleted', project.code)
      navigate('/projects', { replace: true })
    } catch (error) {
      setDeleting(false)
      notify.apiError(error)
    }
  }

  return (
    <>
      <PageHeader
        breadcrumb={
          <nav aria-label="Breadcrumb" className="flex items-center gap-1">
            <Link to="/projects" className="hover:text-primary hover:underline">
              Projects
            </Link>
            <ChevronRight className="size-3.5" aria-hidden />
            <span className="font-medium text-navy" aria-current="page">
              {project.code}
            </span>
          </nav>
        }
        title={project.name}
        subtitle={[project.code, project.subsystem].filter(Boolean).join(' · ')}
        actions={
          <>
            <ProjectStatusBadge status={project.status} />
            {project.abilities.can_edit && (
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil aria-hidden />
                Edit
              </Button>
            )}
            {project.abilities.can_delete && (
              <Button
                variant="outline"
                className="text-danger hover:text-danger"
                onClick={() => setDeleting(true)}
              >
                <Trash2 aria-hidden />
                Delete
              </Button>
            )}
          </>
        }
      />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {extraTabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id}>
              {tab.label}
            </TabsTrigger>
          ))}
          <TabsTrigger value="members">Members ({project.member_count})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <Card>
              <CardContent>
                <h2 className="text-lg font-semibold">About</h2>
                {project.description ? (
                  <p dir="auto" className="mt-3 text-sm leading-relaxed whitespace-pre-line">
                    {project.description}
                  </p>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">No description yet.</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <dl className="grid grid-cols-[110px_1fr] gap-x-4 gap-y-3 text-sm">
                  <Fact label="Status">
                    <ProjectStatusBadge status={project.status} />
                  </Fact>
                  <Fact label="Your role">
                    {project.my_role ? ROLE_META[project.my_role].label : 'Administrator'}
                  </Fact>
                  <Fact label="Members">{project.member_count}</Fact>
                  <Fact label="Documents">{project.document_count}</Fact>
                  <Fact label="Created by">
                    <span dir="auto">{project.created_by?.full_name ?? '—'}</span>
                  </Fact>
                  <Fact label="Created">{formatDateTime(project.created_at)}</Fact>
                  <Fact label="Updated">{formatDateTime(project.updated_at)}</Fact>
                </dl>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {extraTabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="mt-6">
            {tab.render({
              projectId: project.id,
              projectCode: project.code,
              canContribute: project.my_role !== 'viewer',
            })}
          </TabsContent>
        ))}

        <TabsContent value="members" className="mt-6">
          <MembersPanel project={project} />
        </TabsContent>
      </Tabs>

      {project.abilities.can_edit && (
        <ProjectFormDialog open={editing} onOpenChange={setEditing} project={project} />
      )}
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${project.code}?`}
        description="The project and its documents will be hidden from everyone. The data is kept for audit and can be recovered by a database administrator."
        confirmLabel="Delete project"
        destructive
        pending={remove.isPending}
        onConfirm={() => void confirmDelete()}
      />
    </>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-navy">{children}</dd>
    </>
  )
}
