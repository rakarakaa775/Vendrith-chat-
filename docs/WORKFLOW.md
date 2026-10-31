# Vendrith Chat — Delivery Workflow

This project uses six sequential responsibilities. The role names describe work stages; they do not imply six autonomous agents or parallel execution.

## Role sequence

### 1. Roadmap
- Translate the request into a bounded task.
- Identify dependencies, risks, scope, and acceptance criteria.
- Confirm that the task belongs in this repository.

### 2. Auditor
- Inspect the actual branch, files, configuration, and current status.
- Identify existing conventions and user changes.
- Record evidence before recommending edits.
- Flag unknowns instead of guessing.

### 3. Implementer
- Change only approved files and scope.
- Preserve existing work.
- Avoid production data and secrets.
- Report exact paths and commit identifiers.

### 4. QA Tester
- Run relevant tests, lint, type checks, and build checks.
- Include negative/security tests where applicable.
- Record commands, outcomes, and unresolved failures.

### 5. Integrator
- Check compatibility with the architecture and external identity contract.
- Verify that no unauthorized changes were made to World of Vendrith.
- Check documentation and environment boundaries.

### 6. Verifikator
- Independently compare results with acceptance criteria.
- Inspect the final diff and commit state.
- Reject unsupported completion claims.
- Produce a concise evidence-based report.

## Mandatory task record

Every implementation task should record:

- Task ID and objective
- Repository and branch
- Starting commit and working-tree status
- In-scope and out-of-scope paths
- Acceptance criteria
- Changes made
- Tests and exact outcomes
- Commit SHA or explicit reason no commit was made
- Remaining risks and blockers
- Verifier decision

## Safety gates

- No stage skipping.
- No branch changes without explicit approval.
- No destructive cleanup or overwrite of user work.
- No production database writes during development tasks.
- No secrets in source control.
- No dependency or paid-service addition without explaining the reason and alternatives.
- Stop and report if repository state differs from the approved starting point.
- Never claim tests passed unless their results were observed.

## Completion states

- **Verified:** all acceptance criteria passed with evidence.
- **Partially verified:** some criteria passed; remaining items are listed.
- **Blocked:** an external prerequisite prevents safe progress.
- **Rejected:** evidence contradicts the proposed completion claim.
