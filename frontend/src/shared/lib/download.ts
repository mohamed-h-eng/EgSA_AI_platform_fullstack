/** Save a blob as a file via a temporary <a download>. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/**
 * Open a blob in a new tab (e.g. the browser's PDF viewer). The tab is opened synchronously
 * (before any await) by the caller via `openPendingTab`, so pop-up blockers allow it.
 */
export function openPendingTab(): Window | null {
  const tab = window.open('', '_blank')
  if (tab) tab.document.title = 'Loading document…'
  return tab
}

export function showBlobInTab(tab: Window | null, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  if (tab) tab.location.href = url
  else window.open(url, '_blank', 'noopener')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
