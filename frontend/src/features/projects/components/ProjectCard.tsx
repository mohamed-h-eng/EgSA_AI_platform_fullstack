import { ArrowRight, FileText, Satellite, Users } from 'lucide-react'
import { Link } from 'react-router'

import { type Project, ROLE_META } from '../model/types'
import { ProjectStatusBadge } from './ProjectStatusBadge'

/**
 * Project card (design.md §27).
 * TODO(brand): replace the gradient band with per-project satellite imagery once assets exist
 * (Project.image_key is reserved for it).
 */
export function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      to={`/projects/${project.id}`}
      className="group flex flex-col overflow-hidden rounded-lg border bg-card transition-all duration-200 hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <div className="relative flex h-24 items-end bg-gradient-to-br from-navy to-navy-deep px-5 pb-3">
        <Satellite
          className="absolute top-4 right-5 size-8 text-white/25 transition-transform duration-200 group-hover:-translate-y-0.5"
          aria-hidden
        />
        <span className="font-mono text-sm font-semibold tracking-wider text-white">
          {project.code}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <h3 dir="auto" className="line-clamp-2 font-semibold">
            {project.name}
          </h3>
          {project.subsystem && (
            <p dir="auto" className="mt-1 text-sm text-muted-foreground">
              {project.subsystem}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ProjectStatusBadge status={project.status} />
          {project.my_role && (
            <span className="text-xs text-muted-foreground">
              You: {ROLE_META[project.my_role].label}
            </span>
          )}
        </div>
        <div className="mt-auto flex items-center justify-between border-t pt-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <FileText className="size-4" aria-hidden />
              {project.document_count} {project.document_count === 1 ? 'doc' : 'docs'}
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="size-4" aria-hidden />
              {project.member_count} {project.member_count === 1 ? 'member' : 'members'}
            </span>
          </span>
          <ArrowRight
            className="size-4 text-primary transition-transform duration-200 group-hover:translate-x-0.5"
            aria-hidden
          />
        </div>
      </div>
    </Link>
  )
}
