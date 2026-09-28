import {
  FileText,
  FolderKanban,
  MessageSquarePlus,
  MessageSquareText,
  Sparkles,
  Upload,
} from 'lucide-react'
import { Link } from 'react-router'

import { Can, useAuth } from '@features/auth'
import { Button } from '@shared/ui/button'
import { FormError } from '@shared/ui/form-message'

import { useDashboardSummary } from '../api/dashboard.queries'
import { AdminOverview } from '../components/AdminOverview'
import { HeroBanner } from '../components/HeroBanner'
import {
  MyProjectsPanel,
  RecentConversationsPanel,
  RecentDocumentsPanel,
} from '../components/Panels'
import { StatCard } from '../components/StatCard'

/** Home (plan §7, design.md §23): hero, personal stats, recent work, admin overview. */
export function DashboardPage() {
  const { user } = useAuth()
  const { data, isPending, isError, error } = useDashboardSummary()
  const counts = data?.counts

  return (
    <div className="flex flex-col gap-8">
      <HeroBanner
        name={user?.full_name ?? ''}
        actions={
          <>
            <Can permission="chat:use">
              <Button asChild className="bg-white text-navy hover:bg-white/90">
                <Link to="/chat">
                  <MessageSquarePlus aria-hidden />
                  New chat
                </Link>
              </Button>
            </Can>
            <Can permission="documents:upload">
              <Button
                asChild
                variant="outline"
                className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                <Link to="/documents">
                  <Upload aria-hidden />
                  Upload document
                </Link>
              </Button>
            </Can>
          </>
        }
      />

      {isError && <FormError message={error.message} />}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="My projects" value={counts?.projects} icon={FolderKanban} to="/projects" />
        <StatCard label="Documents" value={counts?.documents} icon={FileText} to="/documents" />
        <StatCard
          label="Conversations"
          value={counts?.conversations}
          icon={MessageSquareText}
          to="/chat"
        />
        <StatCard label="AI requests" value={counts?.ai_requests} icon={Sparkles} tone="ai" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-3">
        <Can permission="chat:use">
          <RecentConversationsPanel items={data?.recent_conversations} loading={isPending} />
        </Can>
        <Can permission="documents:read">
          <RecentDocumentsPanel items={data?.recent_documents} loading={isPending} />
        </Can>
        <Can permission="projects:read">
          <MyProjectsPanel items={data?.my_projects} loading={isPending} />
        </Can>
      </div>

      {data?.admin && <AdminOverview stats={data.admin} />}
    </div>
  )
}
