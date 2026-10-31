# ADR 0004: Vendrith Chat Web Stack and Reference Scope

- Status: Accepted for the initial implementation
- Date: 2026-10-31
- Decision owners: Vendrith project owner

## Context

Vendrith Chat is being developed in a separate repository, but the long-term goal is to integrate it into the World of Vendrith website. The existing World of Vendrith application is a web application built with Next.js. The visual reference supplied for Vendrith Chat is a Flutter WhatsApp-inspired application using Firebase.

The reference is useful for interaction patterns and screen composition, but its framework and backend are not a fit to copy wholesale: Vendrith's identity authority is Supabase, and the final product is intended to be one unified website.

## Decision

Build Vendrith Chat as a responsive web application using:

- Next.js App Router
- TypeScript
- React
- Tailwind CSS for styling, subject to a minimal setup review
- The existing canonical Supabase project for Auth and chat-domain persistence, with all implementation and testing initially isolated from production
- Supabase Realtime only after authorization boundaries and recovery behavior are tested

Keep the Chat repository independently deployable during development. Design its routes and components so they can later be composed into the main Vendrith website without replacing player identity.

## Reference features to adopt selectively

### Include in the initial product design

1. Familiar sign-in and account-entry patterns, but use the canonical Vendrith Supabase identity rather than Firebase Auth or a second account store.
2. A conversation list with clear identity, last-message preview, timestamp, and unread state.
3. A focused one-to-one conversation view with readable message bubbles and a composer.
4. Responsive layouts suitable for mobile first and desktop.

### Defer until the direct-message foundation is stable

- Google sign-in UI, unless the canonical Supabase Auth provider is already configured and explicitly approved.
- Password recovery UI beyond the canonical provider's supported flow.
- Local biometric/app lock; browser biometrics and device lock behavior need a separate security design.
- Push notifications and background delivery.
- Image/video attachments, camera integration, gallery saving, link previews, and media upload.
- Localization and language switching.
- Update-available, no-internet, and coming-soon screens unless a real product requirement appears.

### Explicitly do not copy

- Firebase Auth, Firestore, Firebase Storage, or Firebase Cloud Messaging as the backend.
- Firebase-specific data models or security assumptions.
- The source app's account directory or any duplicate user database.
- Unneeded Flutter-only dependencies or platform code.

## Initial MVP scope

The first implementation milestone is a working, responsive shell with:
- App layout and navigation
- Sign-in state boundary wired to a safe local/non-production configuration only after auth implementation is approved
- Conversation-list and conversation-detail UI using clearly marked mock data
- Empty, loading, and error states
- Basic accessibility and mobile layout behavior

Mock UI must be visibly documented as mock data and must not imply messages are persisted or delivered.

The next milestone adds canonical Supabase authentication and then a minimal authorized direct-message flow. No production database writes are included in this decision.

## Security and integration constraints

- The canonical player principal is the server/provider-verified Supabase Auth `user.id`.
- Never accept a client-supplied player ID as authentication.
- Every conversation/message read and write must enforce membership.
- Chat data remains logically separate from World/game data even if it shares the same Supabase project.
- Never expose service-role or secret keys to the browser.
- Local and CI tests must fail closed if isolated non-production configuration is missing.
- This decision does not authorize production schema changes, provider changes, paid plan upgrades, or changes to the World of Vendrith repository.

## Consequences

- The stack aligns with the eventual unified website and existing Vendrith web ecosystem.
- The Flutter reference contributes useful UI/UX patterns without introducing a second client platform or Firebase dependency.
- The Chat application can be developed and deployed separately until the final integration.
- Native mobile features such as biometric locking and push notifications remain deferred and may require a later mobile strategy.
