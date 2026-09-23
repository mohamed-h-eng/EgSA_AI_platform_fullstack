import type { ReactNode } from 'react'

interface HeaderProps {
  /** Right-hand slot (user menu, added in phase 02). */
  actions?: ReactNode
}

export function Header({ actions }: HeaderProps) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b bg-surface px-8">
      <p className="text-base font-semibold text-navy">EgSA AI Engineering Platform</p>
      <div className="flex items-center gap-3">{actions}</div>
    </header>
  )
}
