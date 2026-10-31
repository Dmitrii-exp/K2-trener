# Touched workflow contract

| Capability | Owner | Contract |
| --- | --- | --- |
| Select/Listbox | Native select in company-branches.js | OS popup and keyboard behavior; explicit label associations |
| Form | company-branches.js | Keep values on error, disable duplicate save, inline error, return to list after success |
| Toast | index.html toast() | Existing shared transient acknowledgement; errors remain inline |
| CRUD | Branch RPC functions | Server authorization; no optimistic role changes |
| Async page | index.html setPageHTML | Loading status, retry on failure, ignore obsolete responses |
| Permissions | app_private.branch_can_read | Current active membership and branch assignment; own history preserved |

Navigation remains in application state, as in the existing shell. No URL-based routing is introduced. Existing tables are read-oriented with horizontal scrolling; this release does not redesign the application shell.

TOP switches to complete per-employee metric cards at 700px and below; desktop retains the table. Team assignment uses the native dialog owned by company-branches.js: explicit Save, busy guard, inline errors with retained selections, Escape and focus restoration, and inline creation for the first branch.

Analytics employee selection: native select (same platform-owned behavior as branch forms), visible label «Сотрудник». Only the selected employee’s metrics, skills and chart render. Switching is immediate without extra network calls; navigation reloads authorization and validates the remembered selection against the current roster. No employee IDs are persisted to browser storage.

Cold-call role selection: buttons «Менеджер» / «Закупщик», with aria-pressed and visible focus. Mode changes retain each role’s draft; starting creates the correct existing persisted scenario. Role cannot change within an active call. Supplier mode uses existing save/finish/error recovery. Buyer reports show five procurement criteria and evidence-based strengths/weaknesses, plus initial/agreed conditions and unresolved risks. The evaluator selects its rubric from persisted scenario_id, never a client-supplied mode.

Removed navigation entries: progress and scenarios. Canonical destinations are history for saved results and training for scenario selection. Legacy state aliases normalize before shell/page rendering. Background voice evaluation refreshes history only while the user remains there; later navigation is preserved.

Mentor history: mentor-chat.js owns list/open/new/send/retry. New chat starts an empty context; completed and failed messages persist in the owner’s company-scoped dialogue. History is keyset-paginated. A pending answer stays attached to its originating ID even after navigation; user/account changes clear in-memory caches and ignore obsolete responses. Errors remain separate from assistant messages. Server-owned history, row locks and request IDs prevent forged context, concurrent duplicate generation and duplicate saved replies.

Notes owner: personal-notes.js. Create/rename topics; create/open/edit/save entries inside a topic. Each record has its own draft and busy/error state. User/company changes invalidate caches. Explicit saves retain content on failure and reuse request IDs after uncertain commits. Revision conflicts preserve the local draft and offer Save copy instead of overwriting. Native dialog protects unsaved sign-out; beforeunload protects page exit. All content is escaped; forms own validation with labels and inline errors.

Mentor attachments: up to three 5 MiB JPG/PNG/WebP/PDF/TXT files. Selection validates format/size; drafts allow removal. Sending creates the private dialogue before upload and keeps stable file/request IDs for retry. Sent files restore as authenticated download buttons in history. Files and content never become public; user/company changes invalidate file drafts and late results.
