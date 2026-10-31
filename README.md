# Vendrith Chat

Vendrith Chat is the standalone communication service for the World of Vendrith ecosystem. It is developed in its own repository so chat features can evolve without coupling their implementation to the game engine.

## Project status

**Phase:** Foundation and architecture  
**Repository:** `rakarakaa775/Vendrith-chat-`  
**Default branch:** `main`

This repository is currently documentation-first. No application framework, database provider, deployment target, or production integration has been selected yet.

## Product direction

Vendrith Chat is intended to support:

- Private one-to-one conversations
- Friends, blocks, and player presence
- Group conversations and membership permissions
- Message history and delivery state
- Media attachments and notifications
- Integration with World of Vendrith player identity without creating duplicate player accounts

The detailed boundaries, security requirements, staged roadmap, and architecture decisions are documented in [docs/](docs/).

## Non-goals for the foundation phase

- Do not modify the World of Vendrith repository.
- Do not connect to or mutate a production database.
- Do not create a second player identity system.
- Do not add paid infrastructure before a cost and necessity review.
- Do not claim a feature is complete without reproducible evidence.

## Development workflow

Work proceeds through six sequential roles:

1. Roadmap — define scope, dependencies, and acceptance criteria.
2. Auditor — inspect current evidence and identify risks.
3. Implementer — make only approved changes.
4. QA Tester — run focused tests and record results.
5. Integrator — check compatibility and integration boundaries.
6. Verifikator — independently verify evidence and completion claims.

See [docs/WORKFLOW.md](docs/WORKFLOW.md).

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Roadmap](docs/ROADMAP.md)
- [Security model](docs/SECURITY.md)
- [Workflow and evidence rules](docs/WORKFLOW.md)
- [Architecture decisions](docs/decisions/0001-foundation-decisions.md)

## Status vocabulary

- **Planned:** described but not implemented.
- **In progress:** implementation has started.
- **Verified:** acceptance criteria passed with recorded evidence.
- **Blocked:** progress depends on an unresolved external decision or prerequisite.

A document or design is not evidence that a working application feature exists.
