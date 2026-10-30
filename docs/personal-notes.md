# Personal topic-based notes

User request: a Notes entry in the main menu, topics inside it and records within each topic.

## Behaviour and ownership

`personal-notes.js` owns the topic list, create/rename form, note list/editor and save lifecycle. Existing native buttons, explicit labels, cards and application tokens remain canonical. Mobile stacks the panels with normal page scrolling; no new framework or AI calls.

Notes are personal and scoped to the signed-in user's current company, matching mentor-history privacy. There is no manager exception or sharing. Tables `personal_note_topics` and `personal_notes` expose SELECT only to authenticated users under owner/current-profile-company RLS. Browser writes use two auth-checked SECURITY DEFINER RPCs with fixed search_path. Those RPCs are intentionally executable by authenticated users, never anon/PUBLIC. They derive owner/company from Auth and profiles, validate parent ownership and cannot delete or transfer records. A composite FK also enforces matching note/topic owner/company.

Topics can be created/renamed. Notes can be created, opened, edited and explicitly saved. Untitled text notes derive their title from the first line. Saves carry a UUID request ID and expected revision. Unknown-commit retries reuse the exact request; stale versions and changed retry content return a conflict instead of overwriting. A note conflict keeps the local draft and offers Save copy. No delete controls are added.

Unsaved drafts remain only in memory while navigating within the app. Leaving the page warns through beforeunload; explicit sign-out uses the existing native-dialog pattern to confirm discarding drafts. Account/company changes invalidate private caches and stale responses. Saved notes survive reload; unsaved drafts are not promised after closing the page. Text is escaped and no note content is written to localStorage.

## Validation

`python scripts/build-personal-notes-test.py` generates a rollback-only SQL fixture in an isolated schema. It creates no real accounts and changes no existing user data. Verified: topic/note creation/update, derived title, cached retries, revision conflict, changed request content, denied direct writes, private reads, foreign-parent rejection and old-company rejection.

Browser workflow uses synthetic REST/RPC fixtures to exercise main-menu navigation, topic validation/rename, saved content after reload, duplicate-save guard, unknown-commit retry IDs, draft retention, unsaved-signout Escape, conflict copy, topic separation, escaped text, read failure recovery, account change and 320/390/1440px layouts. Existing AI, training, auth and payment/access paths are unchanged.

## Release and rollback

The schema is additive; existing tables and functions are not modified. Frontend backup is the original six release files plus the new personal-notes.js path (seven total), preserved before writes; upload checks remote and public HTTPS hashes, and publishes index.html last.

Rollback restores that release's frontend backup and retains saved note tables/data. Do not drop notes or topics after users start writing. The new RPC grants can be revoked separately if needed. Older six-path archives are not accepted by the expanded seven-path manifest check.
