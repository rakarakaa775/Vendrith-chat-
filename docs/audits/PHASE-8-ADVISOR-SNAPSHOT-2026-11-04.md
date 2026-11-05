# Phase 8 — Supabase Advisor Snapshot

**Observed:** 2026-11-04 07:03 UTC  
**Project:** Vendrith Non-Production E2E `npvlokuszipgwrdipeoi`  
**Scope:** Chat-specific findings only. The shared project also contains World of Vendrith tables; findings for those tables are not attributed to Chat.

## Security advisor

The project advisor returned 85 total `rls_enabled_no_policy` INFO findings across the shared database. Seven are Chat-related:

- `chat_private.rate_limit_events`
- `public.chat_account_deletion_jobs`
- `public.chat_group_invitations`
- `public.chat_group_moderation_events`
- `public.chat_group_reports`
- `public.chat_notification_preferences`
- `public.chat_presence`

A separate read-only privilege query confirmed that neither `anon` nor `authenticated` has direct SELECT or write table privileges on these seven tables. Their no-policy state is therefore consistent with a private/RPC-only design, not evidence of public table access. Re-check grants if the access model changes.

The advisor also returned one Chat-specific WARN:

- `public.chat_list_my_sessions()` is a `SECURITY DEFINER` function executable by `authenticated`.

The current function body derives the actor from `auth.uid()`, filters `auth.sessions` to that user, excludes expired sessions, and returns no token fields. The privilege query confirmed `anon_execute=false`, `authenticated_execute=true`, and `public_execute=false`. This is a constrained implementation, but the public-schema SECURITY DEFINER placement still triggers the advisor. Preferred hardening is to move the privileged implementation into the non-exposed `chat_private` schema and keep only a narrowly granted SECURITY INVOKER wrapper in `public`, after reconstructing and reviewing its migration source. No database change was made during this snapshot.

## Performance advisor

The advisor returned 20 Chat-related `unused_index` INFO findings, including indexes for group lists, unread messages/notifications, attachments, pins, invitations, moderation, memberships, and reactions.

These indexes may be unused because the Non-Production dataset and traffic are small. Do not drop them solely from this snapshot. Review query plans and representative usage after the deferred performance verification phase.

## Decision

- No broad grants, RLS disabling, or destructive index changes are justified by this snapshot.
- The session-list SECURITY DEFINER warning remains a Phase 8 hardening item.
- The migration-source reconciliation remains a prerequisite for safe, reproducible schema changes.
- This advisor snapshot is not a substitute for cross-user authorization tests or a release security review.


## Follow-up remediation — 2026-11-04

The public `public.chat_list_my_sessions()` function was replaced with a `SECURITY INVOKER` wrapper. Its privileged `auth.sessions` query now lives in `chat_private.chat_list_my_sessions()` with the same `auth.uid()` ownership filter and expired-session exclusion. The forward migration `20261104101500_chat_private_session_list_rpc_hardening_v1` was applied only to Non-Production. A post-change catalog query confirmed the public wrapper has `prosecdef=false`, anonymous execution is false, and authenticated execution is true. The private helper remains `SECURITY DEFINER`, actor-scoped, and executable only by authenticated callers; the schema is not exposed through the public REST API.
