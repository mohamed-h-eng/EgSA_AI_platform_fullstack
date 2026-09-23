import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  breadcrumb?: ReactNode
  actions?: ReactNode
}

/** Standard page header (design.md §31): breadcrumb → title → subtitle → divider. */
export function PageHeader({ title, subtitle, breadcrumb, actions }: PageHeaderProps) {
  return (
    <div className="mb-8 border-b pb-6">
      {breadcrumb && <div className="mb-2 text-sm text-muted-foreground">{breadcrumb}</div>}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-2 text-base text-muted-foreground">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    </div>
  )
}
