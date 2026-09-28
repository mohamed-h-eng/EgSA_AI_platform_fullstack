import type { Project } from '@features/projects'

/** Mirrors backend `schemas/admin.py::DashboardSummary` (only the fields the dashboard shows). */
interface Person {
  id: string
  full_name: string
  email: string
}

export interface DashboardDocument {
  id: string
  code: string
  title: string
  file_type: 'pdf' | 'docx' | 'txt'
  project: { id: string; code: string; name: string }
  uploaded_by: Person | null
  updated_at: string
}

export interface DashboardConversation {
  id: string
  title: string
  project: { id: string; code: string; name: string } | null
  message_count: number
  last_message_at: string | null
  created_at: string
}

export interface AIUserUsage {
  user: Person | null
  requests: number
  failed: number
  tokens: number
}

export interface AdminStats {
  active_users: number
  total_users: number
  total_projects: number
  total_documents: number
  ai_requests_7d: number
  failed_ai_requests_7d: number
  tokens_7d: number
  ai_usage_7d: AIUserUsage[]
}

export interface DashboardSummary {
  counts: { projects: number; documents: number; conversations: number; ai_requests: number }
  recent_conversations: DashboardConversation[]
  recent_documents: DashboardDocument[]
  my_projects: Project[]
  admin: AdminStats | null
}
