import { ChevronsUpDown, Info, KeyRound, LogOut, UserCog } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import { initials } from '@shared/lib/initials'
import { cn } from '@shared/lib/utils'
import { Avatar, AvatarFallback } from '@shared/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@shared/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@shared/ui/dropdown-menu'

import { useAuth } from '../hooks/useAuth'
import { roleLabel } from '../model/types'

interface UserMenuProps {
  /** Icon-only trigger for the collapsed sidebar rail. */
  compact?: boolean
  onNavigate?: () => void
}

/** Account menu anchored to the sidebar footer (workflow 11); opens upward. */
export function UserMenu({ compact = false, onNavigate }: UserMenuProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [aboutOpen, setAboutOpen] = useState(false)
  if (!user) return null

  const go = (path: string) => {
    onNavigate?.()
    navigate(path)
  }

  const signOut = async () => {
    await logout().catch(() => undefined)
    navigate('/login', { replace: true })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Account menu for ${user.full_name}`}
          className={cn(
            'flex w-full items-center gap-3 rounded-md p-1.5 text-left transition-colors hover:bg-primary-light/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none data-[state=open]:bg-primary-light/60',
            compact && 'justify-center',
          )}
        >
          <Avatar className="size-8 shrink-0">
            <AvatarFallback className="bg-primary-light text-xs font-semibold text-primary">
              {initials(user.full_name)}
            </AvatarFallback>
          </Avatar>
          {!compact && (
            <>
              <span className="min-w-0 flex-1 leading-tight">
                <span dir="auto" className="block truncate text-sm font-medium text-navy">
                  {user.full_name}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {roleLabel(user)}
                </span>
              </span>
              <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="top"
          align="start"
          sideOffset={6}
          collisionPadding={8}
          // Same width as the account button, so the menu sits inside the sidebar; the icon
          // rail's button is narrow, so it gets a sensible minimum instead.
          className={compact ? 'w-56' : 'w-(--radix-dropdown-menu-trigger-width) min-w-0'}
        >
          <DropdownMenuLabel className="font-normal">
            <p dir="auto" className="text-sm font-medium text-navy">
              {user.full_name}
            </p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            <p className="text-xs text-muted-foreground">{roleLabel(user)}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => go('/settings')}>
            <UserCog aria-hidden />
            Profile &amp; settings
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => go('/change-password')}>
            <KeyRound aria-hidden />
            Change password
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setAboutOpen(true)}>
            <Info aria-hidden />
            About
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void signOut()}>
            <LogOut aria-hidden />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
    </>
  )
}

function AboutDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>EgSA AI Engineering Platform</DialogTitle>
          <DialogDescription>Egyptian Space Agency · Proof of concept</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 text-sm">
          <p>
            Projects, engineering documents and an AI assistant for EgSA teams, with access based on
            your role and project membership.
          </p>
          <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-navy">
            AI chat messages are sent to an external AI provider. Do not enter classified or
            sensitive project data.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
