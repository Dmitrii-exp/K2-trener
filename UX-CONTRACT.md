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
