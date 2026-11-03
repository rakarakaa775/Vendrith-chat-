# Friend Presence Implementation — 2026-11-03

## Delivery model: six workstreams, 30 role responsibilities

The requested six-agent / 30-role model is used as a coordinated responsibility framework. These are role lanes executed and reviewed in one tool-assisted workflow; this report does not claim 30 autonomous agent processes.

1. **Roadmap Director** — product scope, roadmap sequencing, dependency mapping, acceptance criteria, change control.
2. **Technical & Security Auditor** — identity review, RLS review, RPC privilege review, privacy review, abuse/rate-limit review.
3. **Implementation Engineer** — schema design, SQL function implementation, client heartbeat lifecycle, presence UI, accessibility/responsive review.
4. **QA & Test Engineer** — unit regression, SQL authorization tests, expiry tests, privacy tests, browser regression.
5. **Integration & Release Engineer** — migration synchronization, frontend integration, type/build validation, deployment readiness, rollback planning.
6. **Independent Verification** — independent code review, direct-table isolation check, friend-boundary check, privacy preference check, acceptance evidence review.

## Scope and boundaries

- Vendrith Chat repository only.
- Supabase Non-Production project npvlokuszipgwrdipeoi only.
- No World of Vendrith Production schema, data, Auth settings, or deployment changes.
- No new paid infrastructure or external Realtime channel dependency.
- Presence is advisory and never authoritative game state.

## Implementation

Migration: 20261103035600_chat_friend_presence_v1 (applied to Non-Production).

- Added chat_presence heartbeat storage with one row per user.
- Added show_online_status and show_last_seen profile preferences; both default to private/off.
- Added authenticated RPCs: chat_presence_heartbeat, chat_set_presence_privacy, chat_list_friend_presence.
- Heartbeat writes are throttled to at most one database update per 15 seconds.
- Browser clients heartbeat and refresh presence every 30 seconds only while visible.
- Status is online only while a heartbeat is no older than 90 seconds.
- Presence results are limited to accepted friends and suppressed if either direction has a block.
- Last-seen timestamp is returned only when the friend has explicitly enabled it and is offline.
- Turning online visibility off deletes the caller's heartbeat and suppresses online and last-seen data.
- Community UI exposes both privacy controls; the chat conversation list and thread header show friend presence when authorized.
- Direct access to chat_presence is revoked from anon and authenticated; RLS is enabled without direct table policies. The RPCs are the only client path.

## Verification evidence

- TypeScript typecheck: PASS.
- Unit tests: 24 passed, 0 failed.
- Playwright: 5 passed, 1 skipped (the authenticated redirect test remains skipped without explicit E2E auth configuration).
- Production build: PASS (existing non-fatal webpack cache serialization warnings only).
- Database privilege probe: RLS enabled; anon and authenticated have no direct SELECT/INSERT privileges on chat_presence; anon cannot execute any of the three public presence RPCs; authenticated can execute them.
- RPC security probe: public wrappers are SECURITY INVOKER and have an empty search_path.
- Transactional friend positive-control: one accepted friend saw the opted-in player's online status.
- Transactional privacy/negative checks: stale heartbeat returned offline; last-seen was disclosed only when enabled; disabling last-seen hid the timestamp; blocking removed the presence result.
- All transactional presence test changes were rolled back. Follow-up query confirmed zero persisted presence rows and both test profiles retained private/off defaults.
- Supabase Security Advisor reports an INFO finding for chat_presence having RLS enabled with no policies. This is intentional: direct table grants are revoked and the table is accessed only through authorization-checked SECURITY DEFINER functions. The project also has pre-existing advisor findings across unrelated World-of-Vendrith tables; this migration did not attempt to modify those systems.

## Remaining acceptance

- [ ] Owner browser test with two Non-Production accounts: enable presence on A, confirm B sees A online as an accepted friend.
- [ ] Hide online status on A and confirm B sees no online or last-seen data.
- [ ] Enable last-seen on A, close/background A for more than 90 seconds, and confirm B sees offline plus last-seen.
- [ ] Block test between accounts and confirm presence disappears.
- [ ] Verify chat history and message delivery remain unchanged.
- [ ] Automated authenticated two-account social E2E remains open.

Do not mark Phase 6 complete until these browser checks and the other Phase 6 exit criteria (groups and moderation) are satisfied.
