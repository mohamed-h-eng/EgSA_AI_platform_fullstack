# POC Demo Acceptance Script (plan §46)

Run on a clean `docker compose up` with seed data: projects NEXSAT-1, EgyptSat-2, and SAR.

## A. Admin story
1. [ ] Log in as Admin. The dashboard shows the hero and the admin stats.
2. [ ] Users & Access → **Create user** "Mohamed Hany", Data Scientist, with a generated temporary password (shown once, then copied).
3. [ ] **Assign role** Engineer.
4. [ ] **Give project access**: add them to NEXSAT-1 as Engineer. The "Project access granted" toast appears.
5. [ ] Admin Settings → the AI default model is set to a free OpenRouter model.
6. [ ] Log out.

## B. Engineer story
7. [ ] Log in as Mohamed with the temporary password. They're **forced to set a new password**, then land on a dashboard showing only the counts they can see.
8. [ ] Projects → **only NEXSAT-1** is visible. Opening the SAR URL directly shows not found.
9. [ ] Documents → upload `EPS-SRS-001.pdf` (Requirements, NEXSAT-1). It appears in the list and the "Document uploaded" toast appears.
10. [ ] View and download work. Filter by category and search by "EPS" work.
11. [ ] Uploading `.exe` or an oversize file is rejected with a clear message.
12. [ ] AI Chat → the data warning banner is visible → **New chat** linked to NEXSAT-1 → ask "What are typical battery undervoltage requirements?" → a **streamed** answer labeled "AI Response" appears. Ask a follow-up in Arabic, and the Arabic answer renders right-to-left.
13. [ ] Reload the page. The **conversation is saved** and appears under "Today". Rename it.
14. [ ] Log out.

## C. Viewer story
15. [ ] Log in as a Viewer on NEXSAT-1. They can read and download documents, with no Upload or Delete buttons. A direct API upload returns 403.

## D. Admin verification
16. [ ] Log in as Admin. The audit log (table or DB query) shows login, user creation, role change, member add, document upload/download, and AI request.
17. [ ] The admin dashboard shows AI usage per user, including Mohamed's requests. Disable Mohamed, and his next request or login fails.

## E. Failure handling
18. [ ] Set an invalid OpenRouter key or model. Chat shows a friendly error with Retry and history stays intact.

**Pass criterion:** all 18 steps succeed twice in a row.
