# AI Agent Instructions
# Format: Claude Code
# Generated: 2026-02-04
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

---

## Available Commands

| Command | Description |
|---------|-------------|
| `bin/vibe doctor` | Check project health and configuration. |
| `bin/vibe setup` | Run the setup wizard to configure your project. |
| `bin/vibe do <ticket-id>` | Start working on a ticket (creates worktree and branch). |
| `bin/ticket list` | List tickets from the tracker. |
| `bin/ticket get <ticket-id>` | Get details for a specific ticket. |
| `bin/ticket create "<title>"` | Create a new ticket. |
| `bin/ticket link <blocker-id> <blocked-id>` | Create or remove blocking relationships between tickets. |
| `bin/ticket relations <ticket-id>` | Show blocking relationships for a ticket. |
| `bin/vibe pr` | Create a pull request for the current branch. |
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

Create a new ticket.

**Usage:** `bin/ticket create "<title>"`

#### ticket link

Create or remove blocking relationships between tickets.

**Usage:** `bin/ticket link <blocker-id> <blocked-id>`

#### ticket relations

Show blocking relationships for a ticket.

**Usage:** `bin/ticket relations <ticket-id>`

#### pr

Create a pull request for the current branch.

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
Commit with a descriptive message.

```bash
git add <files>
git commit -m "PROJ-123: Brief description of changes"
```

**Step 6: Create Pull Request**
Open a PR when work is complete.

```bash
git push -u origin PROJ-123
bin/vibe pr
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
Open the pull request.

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

---

## Important Files

- ``CLAUDE.md` - AI agent instructions (this generated file)`
- ``.vibe/config.json` - Project configuration`
- ``README.md` - Project documentation`
- ``.env.example` - Environment variable template`
