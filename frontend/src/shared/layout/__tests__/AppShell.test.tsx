import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FolderKanban, LayoutDashboard, Users } from 'lucide-react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'

import type { NavItem } from '@shared/types/feature'

import { AppShell } from '../AppShell'

const NAV: NavItem[] = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard, order: 0 },
  { label: 'Projects', path: '/projects', icon: FolderKanban, order: 30 },
  { label: 'Users & Access', path: '/admin/users', icon: Users, order: 90, section: 'admin' },
]

function renderShell(navItems = NAV, path = '/') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppShell
        navItems={navItems}
        searchTargets={[{ label: 'Documents', path: '/documents' }]}
        primaryAction={(compact) => <button type="button">{compact ? '+' : 'New chat'}</button>}
        sections={() => <p>recent chats here</p>}
        footer={(compact) => <p>{compact ? 'avatar' : 'account menu'}</p>}
      >
        <p>page</p>
      </AppShell>
    </MemoryRouter>,
  )
  return screen.getByRole('complementary', { name: 'Sidebar' })
}

describe('AppShell sidebar (workflow 11)', () => {
  beforeEach(() => localStorage.clear())

  it('shows brand, primary action, nav, Administration, recents and account menu', () => {
    const sidebar = within(renderShell())
    expect(sidebar.getByText('EgSA AI Platform')).toBeInTheDocument()
    expect(sidebar.getByRole('button', { name: 'New chat' })).toBeInTheDocument()
    // No visible search entry (Ctrl+K still works).
    expect(sidebar.queryByRole('button', { name: /search/i })).not.toBeInTheDocument()
    expect(sidebar.getByRole('link', { name: 'Projects' })).toBeInTheDocument()
    expect(sidebar.getByText('Administration')).toBeInTheDocument()
    expect(sidebar.getByText('recent chats here')).toBeInTheDocument()
    expect(sidebar.getByText('account menu')).toBeInTheDocument()
    // No tagline and no top header any more (D18).
    expect(screen.queryByText(/PEOPLE \| KNOWLEDGE \| IMPACT/)).not.toBeInTheDocument()
    expect(screen.queryByRole('banner')).not.toBeInTheDocument()
  })

  it('hides the Administration group when there are no admin items', () => {
    const sidebar = within(renderShell(NAV.filter((n) => n.section !== 'admin')))
    expect(sidebar.queryByText('Administration')).not.toBeInTheDocument()
  })

  it('collapses to an icon rail, hides recents, and remembers the choice', async () => {
    const sidebar = within(renderShell())
    await userEvent.click(sidebar.getByRole('button', { name: 'Collapse sidebar' }))

    expect(sidebar.queryByText('recent chats here')).not.toBeInTheDocument()
    expect(sidebar.getByText('avatar')).toBeInTheDocument()
    expect(sidebar.getByRole('link', { name: 'Projects' })).toHaveAttribute('title', 'Projects')
    expect(localStorage.getItem('egsa.sidebar.collapsed')).toBe('1')
  })

  it('starts collapsed when the stored preference says so', () => {
    localStorage.setItem('egsa.sidebar.collapsed', '1')
    const sidebar = within(renderShell())
    expect(sidebar.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument()
  })

  it('mobile menu opens the full sidebar, recents included, in a drawer', async () => {
    renderShell()
    await userEvent.click(screen.getByRole('button', { name: 'Open navigation' }))
    const drawer = within(await screen.findByRole('dialog'))
    expect(drawer.getByText('recent chats here')).toBeInTheDocument()
    expect(drawer.getByRole('link', { name: 'Projects' })).toBeInTheDocument()
  })

  it('Ctrl+K opens the search dialog', async () => {
    renderShell()
    await userEvent.keyboard('{Control>}k{/Control}')
    expect(await screen.findByRole('searchbox', { name: 'Search text' })).toBeInTheDocument()
  })

  it('Administration is collapsed by default and remembers when it is opened', async () => {
    const sidebar = within(renderShell())
    const toggle = sidebar.getByRole('button', { name: 'Administration' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(sidebar.queryByRole('link', { name: 'Users & Access' })).not.toBeInTheDocument()

    await userEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(sidebar.getByRole('link', { name: 'Users & Access' })).toBeInTheDocument()
    expect(localStorage.getItem('egsa.sidebar.admin.open')).toBe('1')
  })

  it('Administration opens itself while an admin page is shown', () => {
    const sidebar = within(renderShell(NAV, '/admin/users'))
    expect(sidebar.getByRole('link', { name: 'Users & Access' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('the icon rail always shows the admin icons', async () => {
    localStorage.setItem('egsa.sidebar.collapsed', '1')
    const sidebar = within(renderShell())
    expect(sidebar.getByRole('link', { name: 'Users & Access' })).toBeInTheDocument()
  })
})
