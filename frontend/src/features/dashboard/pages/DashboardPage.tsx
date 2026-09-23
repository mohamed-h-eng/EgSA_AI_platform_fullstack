import { useAuth } from '@features/auth'
import { PageHeader } from '@shared/layout/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui/card'
import { Separator } from '@shared/ui/separator'

import { useHealth } from '../api/system.queries'
import { type ServiceState, StatusRow } from '../components/StatusRow'

/** Phase 01 stub: proves Frontend ↔ Backend ↔ Database. Replaced by the real dashboard in phase 09. */
export function DashboardPage() {
  const { user } = useAuth()
  const { data, isPending, isError } = useHealth()

  const backend: ServiceState = isPending ? 'checking' : isError ? 'error' : 'ok'
  const database: ServiceState = isPending ? 'checking' : data?.database === 'ok' ? 'ok' : 'error'

  return (
    <>
      <PageHeader
        title={user ? `Welcome, ${user.full_name}` : 'Dashboard'}
        subtitle="EgSA AI Engineering Platform — system status"
      />
      <Card className="max-w-md shadow-card">
        <CardHeader>
          <CardTitle>Platform connectivity</CardTitle>
          <CardDescription>Live check of the backend API and database.</CardDescription>
        </CardHeader>
        <CardContent>
          <StatusRow name="Backend API" state={backend} />
          <Separator />
          <StatusRow name="Database" state={database} />
        </CardContent>
      </Card>
    </>
  )
}
