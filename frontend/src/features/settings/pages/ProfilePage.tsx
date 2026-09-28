import { KeyRound } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link } from 'react-router'

import { roleLabel, useAuth } from '@features/auth'
import { notify } from '@features/notifications'
import { PageHeader } from '@shared/layout/PageHeader'
import { Button } from '@shared/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui/card'
import { FormField } from '@shared/ui/form-field'
import { Input } from '@shared/ui/input'

/** Personal settings (plan §30): name and job title are self-service; email and role are not. */
export function ProfilePage() {
  const { user, updateProfile } = useAuth()
  const [fullName, setFullName] = useState(user?.full_name ?? '')
  const [jobTitle, setJobTitle] = useState(user?.job_title ?? '')
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)
  if (!user) return null

  const dirty = fullName.trim() !== user.full_name || (jobTitle.trim() || null) !== user.job_title

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!fullName.trim()) {
      setError('Name is required.')
      return
    }
    setError(undefined)
    setSaving(true)
    try {
      const saved = await updateProfile({
        full_name: fullName.trim(),
        job_title: jobTitle.trim() || null,
      })
      setFullName(saved.full_name)
      setJobTitle(saved.job_title ?? '')
      notify.success('Profile updated')
    } catch (err) {
      notify.apiError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader title="Settings" subtitle="Your profile and account security." />
      <div className="grid max-w-3xl gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>How your name appears across the platform.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void save(e)} className="flex flex-col gap-5" noValidate>
              <FormField id="profile-name" label="Full name" error={error}>
                <Input
                  id="profile-name"
                  dir="auto"
                  value={fullName}
                  maxLength={200}
                  onChange={(e) => setFullName(e.target.value)}
                  aria-invalid={!!error}
                  aria-describedby={error ? 'profile-name-error' : undefined}
                />
              </FormField>
              <FormField id="profile-title" label="Job title">
                <Input
                  id="profile-title"
                  dir="auto"
                  value={jobTitle}
                  maxLength={200}
                  placeholder="e.g. Power Systems Engineer"
                  onChange={(e) => setJobTitle(e.target.value)}
                />
              </FormField>
              <FormField
                id="profile-email"
                label="Email"
                hint="Contact an administrator to change your email or role."
              >
                <Input
                  id="profile-email"
                  value={user.email}
                  readOnly
                  disabled
                  aria-describedby="profile-email-hint"
                />
              </FormField>
              <p className="text-sm text-muted-foreground">
                Role: <span className="font-medium text-navy">{roleLabel(user)}</span>
              </p>
              <div>
                <Button type="submit" disabled={saving || !dirty}>
                  Save profile
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Password</CardTitle>
            <CardDescription>
              Changing your password signs you out on your other devices.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link to="/change-password">
                <KeyRound aria-hidden />
                Change password
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
