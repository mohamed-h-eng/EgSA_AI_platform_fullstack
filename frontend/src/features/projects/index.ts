// Public API of the projects feature. Other code may import ONLY from this file.
export { useVisibleProjects } from './api/projects.queries'
export { ProjectSelect } from './components/ProjectSelect'
export { ProjectStatusBadge } from './components/ProjectStatusBadge'
export { UserProjectsSection } from './components/UserProjectsSection'
export { projectsFeature } from './manifest'
export type { Project, ProjectRole, ProjectStatus } from './model/types'
