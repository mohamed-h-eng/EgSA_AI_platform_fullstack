import { ChevronDown, KeyRound, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router'

import { initials } from '@shared/lib/initials'
import { Avatar, AvatarFallback } from '@shared/ui/avatar'
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

export function UserMenu() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  if (!user) return null

  const signOut = async () => {
    await logout().catch(() => undefined)
    navigate('/login', { replace: true })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-primary-light/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
        <Avatar className="size-8">
          <AvatarFallback className="bg-primary-light text-xs font-semibold text-primary">
            {initials(user.full_name)}
          </AvatarFallback>
        </Avatar>
        <span className="hidden text-left leading-tight sm:block">
          <span dir="auto" className="block text-sm font-medium text-navy">
            {user.full_name}
          </span>
          <span className="block text-xs text-muted-foreground">{roleLabel(user)}</span>
        </span>
        <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p dir="auto" className="text-sm font-medium text-navy">
            {user.full_name}
          </p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate('/change-password')}>
          <KeyRound aria-hidden />
          Change password
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void signOut()}>
          <LogOut aria-hidden />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
