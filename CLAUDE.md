# AI Agent Instructions
# Format: Claude Code
# Generated: 2026-02-23
# Source: agent_instructions/
#
# DO NOT EDIT DIRECTLY - regenerate with: bin/vibe generate-agent-instructions


# CLAUDE.md - AI Agent Instructions

## Project Overview

**Project:** (your project name)
**Description:** (what this project does)

**Tech Stack:**
- Backend: (e.g., FastAPI, Django, Express)
- Frontend: (e.g., React, Next.js, Vue)
- Database: (e.g., PostgreSQL, Supabase, Neon)
- Deployment: (e.g., Vercel, Fly.io, AWS)

---

## Core Rules

- Read files before modifying them - understand existing code before making changes
- Use existing patterns - match the codebase's style, naming conventions, and architecture
- Prefer editing over creating - modify existing files rather than creating new ones
- Keep changes minimal - only change what's necessary to complete the task
- No security vulnerabilities - avoid XSS, SQL injection, command injection, etc.
- Handle errors gracefully - don't leave code in broken states
- Test your changes - verify code works before marking task complete
- Document non-obvious code - add comments only where the logic isn't self-evident
- Every PR must reference a ticket - PR titles must include the ticket ID (e.g. "PROJ-123: Add feature")
- Every ticket must have labels - at minimum one type label (Bug/Feature/Chore/Refactor) and one area label (Frontend/Backend/Infra/Docs)
- Set parent/child relationships for related tickets - use --parent when creating sub-tasks
- Use blocking links for dependencies - the prerequisite ticket blocks the dependent ticket

---

## Available Labels

These labels are configured in `.vibe/config.json`. Apply them when creating tickets.

**Type (exactly one required):** Bug, Feature, Chore, Refactor

**Area (at least one required):** Frontend, Backend, Infra, Docs, Tests

**Special (as needed):** HUMAN ‼️, Blocked

---

## Ticket Discipline

Follow these rules for every ticket and PR:

### Labels Are Required

Every ticket **must** have labels when created:

- **Type** (exactly one): Bug, Feature, Chore, or Refactor
- **Area** (at least one): Frontend, Backend, Infra, or Docs
- **Risk** (exactly one): Low Risk, Medium Risk, or High Risk

```bash
bin/ticket create "Fix login bug" --description "Login returns 500 on special chars." --label Bug --label Frontend --label "Low Risk"
```

### Parent/Child Relationships

When creating sub-tasks, set the parent ticket:

```bash
bin/ticket create "Add signup form" --description "React signup component." --label Feature --label Frontend --parent PROJ-100
```

### Blocking Relationships

When one ticket must be completed before another can start, link them with a blocking relationship. The prerequisite ticket blocks the dependent ticket:

```bash
bin/ticket link PROJ-101 --blocks PROJ-102
```

### Every PR Needs a Ticket

Every pull request **must** reference a ticket. Include the ticket ID in the PR title:

```bash
bin/vibe pr --title "PROJ-123: Add user authentication"
```

---

## Available Commands

| Command | Description |
|---------|-------------|
| `bin/vibe doctor` | Check project health and configuration. |
| `bin/vibe setup` | Run the setup wizard to configure your project. |
| `bin/vibe do <ticket-id>` | Start working on a ticket (creates worktree and branch). |
| `bin/ticket list` | List tickets from the tracker. |
| `bin/ticket get <ticket-id>` | Get details for a specific ticket. |
| `bin/ticket create "<title>" --description "<description>" --label "<type>" --label "<area>"` | Create a new ticket. **A description is REQUIRED** — never create a ticket without one. **Labels are REQUIRED** — always include at least one type label and one area label. Use --parent to set a parent ticket for sub-tasks. |
| `bin/ticket link <blocker-id> --blocks <dependent-id>` | Link two tickets with a blocking relationship. The prerequisite ticket blocks the dependent ticket. |
| `bin/vibe pr` | Create a pull request for the current branch. PR titles must include the ticket reference. |
| `bin/vibe figma analyze` | Analyze frontend codebase for design system context. |
| `bin/vibe generate-agent-instructions` | Generate assistant-specific instruction files. |

### Command Details

#### doctor

Check project health and configuration.

**Usage:** `bin/vibe doctor`

#### setup

Run the setup wizard to configure your project.

**Usage:** `bin/vibe setup`

#### do

Start working on a ticket (creates worktree and branch).

**Usage:** `bin/vibe do <ticket-id>`

#### ticket list

List tickets from the tracker.

**Usage:** `bin/ticket list`

#### ticket get

Get details for a specific ticket.

**Usage:** `bin/ticket get <ticket-id>`

#### ticket create

Create a new ticket. **A description is REQUIRED** — never create a ticket without one. **Labels are REQUIRED** — always include at least one type label and one area label. Use --parent to set a parent ticket for sub-tasks.

**Usage:** `bin/ticket create "<title>" --description "<description>" --label "<type>" --label "<area>"`

#### ticket link

Link two tickets with a blocking relationship. The prerequisite ticket blocks the dependent ticket.

**Usage:** `bin/ticket link <blocker-id> --blocks <dependent-id>`

#### pr

Create a pull request for the current branch. PR titles must include the ticket reference.

**Usage:** `bin/vibe pr`

#### figma analyze

Analyze frontend codebase for design system context.

**Usage:** `bin/vibe figma analyze`

#### generate-agent-instructions

Generate assistant-specific instruction files.

**Usage:** `bin/vibe generate-agent-instructions`

---

## Workflows

### Starting Work on a Ticket

**Step 1: Create Worktree**
Create a dedicated workspace for the ticket.

```bash
bin/vibe do PROJ-123
```

**Step 2: Read the Ticket**
Understand what needs to be done.

```bash
bin/ticket get PROJ-123
```

**Step 3: Implement the Work**
Make changes in the worktree directory.

**Step 4: Test Your Changes**
Verify the implementation works.

**Step 5: Commit Changes**
Commit with a descriptive message that includes the ticket ID.

```bash
git add <files>
git commit -m "PROJ-123: Brief description of changes"
```

**Step 6: Create Pull Request**
Open a PR when work is complete. The PR title must include the ticket reference.

```bash
git push -u origin PROJ-123
bin/vibe pr --title "PROJ-123: Add feature description"
```

### Creating Related Tickets

**Step 1: Create Parent Ticket**
Create the parent ticket with labels.

```bash
bin/ticket create "Epic: User auth system" --description "Full authentication system with OAuth2." --label Feature --label Backend
```

**Step 2: Create Child Tickets**
Create child tickets with --parent and labels.

```bash
bin/ticket create "Add login endpoint" --description "POST /auth/login with JWT." --label Feature --label Backend --parent PROJ-100
bin/ticket create "Add signup form" --description "React signup form component." --label Feature --label Frontend --parent PROJ-100
```

**Step 3: Set Blocking Relationships**
Link tickets that have dependencies.

```bash
bin/ticket link PROJ-101 --blocks PROJ-102
```

### Creating a Pull Request

**Step 1: Verify Changes**
Check what will be included in the PR.

```bash
git status
git diff origin/main
```

**Step 2: Push Changes**
Push your branch to the remote.

```bash
git push -u origin BRANCH-NAME
```

**Step 3: Create PR**
Open the pull request with the ticket ID in the title.

```bash
bin/vibe pr
```

**Step 4: Verify CI**
Wait for CI checks to pass.

### Handling CI Failures

**Step 1: Read the Failure**
Check the actual error message.

```bash
gh pr checks <pr-number>
gh run view <run-id> --log-failed
```

**Step 2: Fix the Issue**
Address the specific failure.

**Step 3: Push the Fix**
Push the fix and re-run CI.

```bash
git add <files>
git commit -m "Fix CI failure: <description>"
git push
```

### Cleaning Up After Merge

**Step 1: Remove Worktree**
Clean up the worktree from the main repo.

```bash
git worktree remove <worktree-path>
```

**Step 2: Delete Local Branch**
Remove the local branch.

```bash
git branch -d PROJ-123
```

**Step 3: Sync State**
Update local state.

```bash
bin/vibe doctor
```

---

## Anti-Patterns to Avoid

- **Don't:** Guessing file contents without reading them first
- **Don't:** Creating new abstractions for one-time operations
- **Don't:** Adding features, refactoring, or "improvements" beyond what was asked
- **Don't:** Over-engineering with unnecessary complexity
- **Don't:** Leaving console.log or debug statements in production code
- **Don't:** Ignoring existing error handling patterns
- **Don't:** Making assumptions about requirements without asking
- **Don't:** Committing secrets, API keys, or credentials
- **Don't:** Creating tickets without labels - every ticket needs type and area labels
- **Don't:** Opening PRs without a ticket reference in the title
- **Don't:** Creating related tickets without parent/child or blocking relationships

---

## Important Files

- ``CLAUDE.md` - AI agent instructions (this generated file)`
- ``.vibe/config.json` - Project configuration`
- ``README.md` - Project documentation`
- ``.env.example` - Environment variable template`
