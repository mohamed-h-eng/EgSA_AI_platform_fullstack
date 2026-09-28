import { Link } from 'react-router'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/ui/table'

import type { AdminStats } from '../model/types'

/** Admin-only block: platform totals and AI usage per user over 7 days (D11: tracked, no limits). */
export function AdminOverview({ stats }: { stats: AdminStats }) {
  const figures = [
    { label: 'Active users', value: `${stats.active_users} / ${stats.total_users}` },
    { label: 'Projects', value: stats.total_projects },
    { label: 'Documents', value: stats.total_documents },
    { label: 'AI requests (7 days)', value: stats.ai_requests_7d },
    {
      label: 'Failed AI requests (7 days)',
      value: stats.failed_ai_requests_7d,
      warn: stats.failed_ai_requests_7d > 0,
    },
    { label: 'Tokens (7 days)', value: stats.tokens_7d.toLocaleString() },
  ]

  return (
    <section aria-labelledby="admin-overview" className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="admin-overview" className="text-lg font-semibold">
          Administration
        </h2>
        <Link to="/admin/audit" className="text-sm font-medium text-primary hover:underline">
          View audit log
        </Link>
      </div>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {figures.map((f) => (
          <div key={f.label} className="rounded-lg border bg-surface p-4">
            <dt className="text-xs text-muted-foreground">{f.label}</dt>
            <dd
              className={
                f.warn
                  ? 'mt-1 text-xl font-bold text-danger tabular-nums'
                  : 'mt-1 text-xl font-bold text-navy tabular-nums'
              }
            >
              {f.value}
            </dd>
          </div>
        ))}
      </dl>

      <Card className="gap-0 overflow-hidden py-0 shadow-card">
        <CardHeader className="border-b py-4">
          <CardTitle className="text-base">AI usage per user</CardTitle>
          <CardDescription>Last 7 days. Usage is tracked for visibility only.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {stats.ai_usage_7d.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              No AI requests in the last 7 days.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-surface-muted hover:bg-surface-muted">
                  <TableHead className="pl-6">User</TableHead>
                  <TableHead className="text-right">Requests</TableHead>
                  <TableHead className="text-right">Failed</TableHead>
                  <TableHead className="pr-6 text-right">Tokens</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.ai_usage_7d.map((row, i) => (
                  <TableRow key={row.user?.id ?? `deleted-${i}`}>
                    <TableCell className="pl-6">
                      {row.user ? (
                        <>
                          <span dir="auto" className="block font-medium text-navy">
                            {row.user.full_name}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {row.user.email}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">Deleted user</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.requests}</TableCell>
                    <TableCell
                      className={
                        row.failed
                          ? 'text-right text-danger tabular-nums'
                          : 'text-right tabular-nums'
                      }
                    >
                      {row.failed}
                    </TableCell>
                    <TableCell className="pr-6 text-right tabular-nums">
                      {row.tokens.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
