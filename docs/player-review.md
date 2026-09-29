# Player review — 2026-09-29

The previous implementation compiled and deployed, but that was being treated as proof of a finished product. It wasn't. This pass was checked in a real browser against populated, empty, failed, mobile and active-listening states.

## Findings corrected

- The shared CSS made the search label a vertical stack. Scope the app's controls while retaining DeltaV's fonts and teal identity.
- A grid was only a row with its metadata removed. Both views now preserve tags, current track and listeners, and remain usable on mobile.
- The page had no visual hierarchy or useful account/history area. Give rooms a consistent record-sleeve fallback, show host banners where provided, place invite entry alongside discovery, and use actual browser history for recently opened rooms. Never seed pretend rooms into the product.
- A failed Ward request prevented public browsing. Load account state independently, discard expired credentials, and return to the current room after sign-in.
- The room screen did not poll despite earlier claims. Refresh session, channel and queue data, stop audio on disconnected sessions, and report connection errors distinctly.
- Queue counts read a different API's response shape. Render the existing session queue's actual items and current index; show approval/payment requests separately. Preserve typed requests when the server rejects them.
- Private invites redirected to the legacy static website. `/sessions/:code` now uses the React listening view. It plays the published audio package in-page, synchronizes with host time, handles host pause, tracks progress, supports local mute/volume, and uses real Web Audio measurements for the spectrum. Playback controls affect the listener, not the host's queue.
- The dialog lacked reliable focus restoration. Use a native modal dialog and restore focus to the opening control.
- Metadata contained duplicate titles/descriptions and pointed at a nonexistent default OG image. Serve a real social-card bitmap and favicon, inject metadata once, and mark private session pages `noindex`.

## Still outside the finished feature set

These are existing integration gaps, not completed features disguised by the visual pass:

- Host-approved admission needs a backend waiting-room/membership contract and end-to-end access enforcement. The new view explicitly explains that this mode is unavailable; this is not a security audit of legacy routes.
- Persistent rooms created on the web are not yet paired to a desktop host through Ward. The existing live-channel protocol is consumed when a host is already publishing.
- Ward requester ownership and pending-track edit/promotion need server-side authorization and desktop compatibility.
- Paid queue checkout is not implemented in this client. Paid submissions are disabled with a clear explanation rather than creating an unpaid request and showing success.
- This pass uses the session queue protocol. Standalone streamer-queue room IDs still need their complete binding to public room records.
- A web profile editor for room banner/icon/SEO fields is still needed. Existing profile fields and the directory artwork contract are consumed.
- The frontend has not been tested against a user-controlled live desktop session during this pass. Automated playback checks use a real WAV inside a ZIP served by intercepted API requests; production room data is never modified by tests.

## Verification

`npm run build` and `npm run test:browser`. Browser tests cover composed filters, grid/list persistence, four viewport widths, expired Ward access, empty/error states, keyboard modal dismissal, session-code navigation, package playback, host pause, queue refresh and rejected requests. Review captures are generated in ignored `test-results/`; they are fixtures, not fabricated production activity.
