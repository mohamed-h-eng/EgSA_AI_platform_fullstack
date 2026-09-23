import { isRouteErrorResponse, Link, useRouteError } from 'react-router'

import { Button } from '@shared/ui/button'

export function RouteError() {
  const error = useRouteError()
  const notFound = isRouteErrorResponse(error) && error.status === 404

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-bold">{notFound ? 'Page not found' : 'Something went wrong'}</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {notFound
          ? 'The page you are looking for does not exist or you do not have access to it.'
          : 'An unexpected error occurred. Try again, or contact the platform administrator.'}
      </p>
      <Button asChild>
        <Link to="/">Back to dashboard</Link>
      </Button>
    </div>
  )
}
