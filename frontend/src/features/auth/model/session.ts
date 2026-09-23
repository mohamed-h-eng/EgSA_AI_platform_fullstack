/**
 * The access token lives ONLY in memory (ADR-03). The long-lived refresh token is an
 * httpOnly cookie the browser sends to /api/v1/auth/* — JavaScript never sees it.
 */
let accessToken: string | null = null

export const session = {
  getAccessToken: () => accessToken,
  setAccessToken: (token: string | null) => {
    accessToken = token
  },
}
