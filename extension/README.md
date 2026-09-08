# Ticket Trainer Notepad

A Chrome/Edge browser extension for trainees: a notepad for the ticket
they're currently working, plus a live checklist of required actions synced
from a Google Sheet that admins maintain.

## What it does

- **Ticket field + notepad** — type a ticket ID/name and free-form notes.
  "New ticket" clears both plus all checkboxes so every ticket starts fresh.
- **Checklist** — one row per sheet entry, checkbox to mark it done, with a
  progress bar (`3 / 8 actions done`). Column A of the sheet is shown as the
  *pain point* (what to address), column B as the *action* (what to do).
- **Settings (gear icon)** — paste the sheet's published CSV link once;
  admins can keep editing the sheet and trainees hit **Refresh** to pull the
  latest version. Refreshing preserves checks for rows whose text didn't
  change, and drops checks for anything the admin edited or removed.

All data stays local to the browser — nothing is sent anywhere except the
one read-only fetch of the published CSV.

## Set up the Google Sheet (admin, one-time)

1. Column A = pain point / thing to address on the ticket. Column B = the
   action to take. Row 1 can be a header (e.g. "Pain point", "Action") — the
   extension skips it by default.
2. **File → Share → Publish to web**.
3. Under "Link", pick the specific sheet/tab with the checklist, and set the
   format dropdown to **Comma-separated values (.csv)**.
4. Click **Publish**, copy the resulting URL.
5. Any time the sheet is edited, the published link stays the same — just
   click **Refresh** in the extension.

## Install the extension (unpacked)

1. Open `chrome://extensions` (or `edge://extensions`).
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and select this `extension/` folder.
4. Pin the extension, open its popup, click the gear icon, and paste the
   published CSV link from above.

## Notes

- Ticket notes/checks are kept in `chrome.storage.session` — they survive
  the popup being closed and reopened, but reset when the browser itself is
  fully closed, and "New ticket" always clears them intentionally.
- The checklist template itself (from the sheet) persists in
  `chrome.storage.local` until the next sync.
- To publish this to the Chrome Web Store instead of loading it unpacked,
  it needs to be zipped and submitted through a Chrome Web Store developer
  account — that's a separate, manual step outside this repo.
