# Manual Testing Guideline

Use this checklist to verify the new account-only batch publication-check flow.

1. Start the app and sign in with a valid account.
2. Open `/publication-check`.
3. Confirm you see the batch verification section for signed-in users.
4. Upload a PDF in the batch area.
5. Confirm the app starts a background job and redirects you to the results page.
6. Refresh the page or leave and return to `/publication-check`.
7. Confirm the job still appears in recent jobs and its status is preserved.
8. Open the job from the recent jobs list.
9. Confirm the results page loads from the saved job record, not just from browser state.
10. Wait until the job finishes and confirm the publications render correctly.
11. Sign out and confirm the batch section no longer lets you start a saved job without signing in.
12. Try a non-PDF file and confirm it is rejected.

Optional checks:

- Confirm the public upload flow still works for immediate verification.
- Confirm a batch job remains visible after a full browser refresh.
