# Claude.md - AI Agent Instructions

This file contains instructions for AI agents (Claude, GPT, etc.) working on City Doodle.

---

## Project Overview

**City Doodle** is a lo-fi vector city builder — a lightweight planning sim disguised as a map doodle. Users generate believable terrain, place districts and infrastructure, simulate growth over discrete time steps, and export compelling artifacts (PNGs + GIF timelapses).

### Tech Stack
- **Backend:** FastAPI (Python) with separate worker process for heavy generation
- **Frontend:** React + TypeScript + PixiJS (WebGL) for clean vector rendering
- **Database:** Postgres (Neon)
- **Deployment:** Vercel (web app), Fly.io (API + worker)

### Key Features (V1)
- Server-side terrain generation (3×3 tile neighborhoods, seamless borders)
- Tile locking for concurrent editing
- Seed placement with snap-to-geometry (districts, POIs, transit)
- Organic city growth simulation (1/5/10 year steps)
- VMT-lite metrics (Vehicle Miles Traveled, transit ridership proxy)
- Historic district preservation (no redevelopment during growth)
- Replay timelapse + GIF/PNG export
- Handwritten-style labels with deterministic placement
- Personality sliders (Grid↔Organic, Sprawl↔Compact, etc.)

### Monorepo Structure
```
/apps/web      - React TS frontend
/apps/api      - FastAPI backend
/apps/worker   - Python worker for heavy jobs
/packages/shared - Shared types + geometry schemas
```

### Detailed Specs
See the prompt files in the repo root for full specifications:
- `01_lofi_city_builder_overview_tests (1).md` - Product overview + testable functionality
- `02_ai_coding_assistant_prompt_milestones.md` - V1 milestone plan
- `03_v2_improvements_milestones.md` - V2 roadmap (needs system, 3D view, multiplayer)

### Infrastructure Accounts

The project owner already has accounts set up on all deployment platforms. **Do not create new accounts or projects** - use the existing ones:

| Service | Purpose | Status |
|---------|---------|--------|
| **Neon** | Postgres database | Account exists |
| **Fly.io** | API + Worker hosting | Account exists |
| **Vercel** | Web app hosting | Account exists, auto-deploys on PR |
| **Linear** | Issue tracking | Configured in `.vibe/config.json` |

When working on infrastructure tasks:
- Focus on **configuration** (env vars, secrets, migrations), not account creation
- Vercel preview deployments are automatic for PRs
- Fly.io app names are defined in `apps/api/fly.toml` and `apps/worker/fly.toml`
- Database connection strings need both async (`postgresql+asyncpg://`) and sync (`postgresql://`) formats

---

## README Maintenance

Keep the project **README.md** accurate so humans and agents can onboard quickly.

### When a new app is initialized (from a prompt or setup)

After creating or configuring a new project, update **README.md** with:

- **App name and description** – What the project does and who it's for
- **Tech stack** – Frameworks, runtimes, databases, deployment (align with Project Overview in this file)
- **Setup instructions** – Prerequisites, install steps, env vars, how to run locally
- **Project structure** – Short overview of key directories (e.g. `api/`, `ui/`, `scripts/`)

If the user ran `bin/vibe setup`, remind them to update README as part of the "next steps" (see setup wizard).

### Continuous maintenance

As the project evolves, keep README in sync:

- **New features** – Document user-facing or notable capabilities
- **Setup steps** – Refine when install/run steps change
- **Architecture changes** – Update structure or diagrams when layout or responsibilities change

When you add a new top-level area (e.g. a new app, service, or major script), add a brief note to README and to the Project Overview above.

See `recipes/agents/readme-maintenance.md` for the full guide.

---

## Configuration Reference

The canonical configuration is in `.vibe/config.json`. Key fields (actual values are populated in the config file):

```json
{
  "tracker": { "type": "linear", "config": {} },
  "github": { "auth_method": "gh_cli", "owner": "", "repo": "" },
  "branching": { "pattern": "{PROJ}-{num}", "always_rebase": true },
  "labels": {
    "type": ["Bug", "Feature", "Chore", "Refactor"],
    "risk": ["Low Risk", "Medium Risk", "High Risk"],
    "area": ["Frontend", "Backend", "Infra", "Docs"],
    "special": ["HUMAN ‼️", "Milestone", "Blocked"]
  }
}
```

> **Note:** The empty strings shown above are placeholders. See `.vibe/config.json` for the actual configured values (GitHub owner/repo, Linear team, etc.).

---

## Core Rules

### When to Ask for Clarification

**Always ask when:**
- Requirements are ambiguous or contradictory
- Multiple valid implementations exist with different trade-offs
- Security or data implications are unclear
- The task would take significant time if the wrong approach is chosen
- Destructive operations are involved

**Never ask when:**
- The answer is clearly in the codebase
- Standard patterns apply
- It's a trivial decision with easy reversal
- The question was already answered in context

See `recipes/agents/asking-clarifying-questions.md` for examples.

### When to Create HUMAN Tickets

**HUMAN tickets are for tasks that genuinely require human action** — things the AI agent cannot do. Before creating a HUMAN ticket, ask: "Can I do this programmatically?" If yes, create a regular ticket and do the work.

**DO create HUMAN tickets for:**
- **Obtaining secrets** — Actual credential values (database passwords, API keys) that the human must retrieve from external services
- **External account actions** — Creating accounts, enabling billing, changing plan tiers on third-party services
- **Subjective decisions** — UI/UX choices, branding, copy tone, product direction
- **Legal/compliance review** — Terms of service, privacy policy, licensing decisions
- **External communications** — Emails to users, public announcements, support responses

**DO NOT create HUMAN tickets for:**
- **Writing code or config** — Even if it involves security (auth, access control), the agent can write it
- **Running CLI commands** — `fly secrets set`, `gh secret set`, etc. — create a regular ticket
- **Setting up infrastructure** — Dockerfiles, workflows, terraform — the agent can do this
- **Documentation** — README, comments, ADRs — the agent can write these
- **Architecture decisions** — If requirements are clear, the agent can design and implement

**Example — Fly.io deployment setup:**
- ❌ HUMAN ticket: "Configure Fly.io secrets and environment" (too broad, agent can do most of this)
- ✅ Regular ticket: "Create Fly.io deployment workflow and Dockerfiles" (agent does this)
- ✅ Regular ticket: "Add fly secrets set commands to set DATABASE_URL, JWT_SECRET" (agent writes the commands)
- ✅ HUMAN ticket: "Provide DATABASE_URL connection string from Neon dashboard" (human must retrieve actual value)

**When in doubt:** Create a regular ticket and attempt the work. Only escalate to HUMAN if you hit a genuine blocker requiring human action.

See `recipes/agents/human-required-work.md` for the full guide.

### How to Handle Ambiguity

1. **Check context first** - Re-read the request, examine related code
2. **Make informed assumptions** - If confidence >80%, proceed with a note
3. **Ask with options** - Provide 2-3 specific options, not open-ended questions
4. **Document assumptions** - Note any assumptions in code comments or PR description

### File Editing

**No files in this repo are protected.** You may edit any file freely. Do not treat any path as read-only or off-limits; apply changes wherever they are needed to complete the task.

---

## Ticket Management

### "Do this ticket {ticket}" – What it means

When the user says **"do this ticket PROJ-123"** (or simply **"do PROJ-123"**), that means:

1. **Create a fresh worktree** – Use `bin/vibe do PROJ-123` to create a dedicated worktree. Do all work there, not in the main checkout.
2. **Rebase onto latest main** – Fetch origin and run `git rebase origin/main` to ensure the branch is up to date before starting work.
3. **Do the work** – Implement the ticket requirements.
4. **Open a PR when complete** – Commit, push, and open a PR (title with ticket ref, risk label, etc.). Do not leave the work only local.

So: **"do {ticket}"** = **fresh worktree + rebase + do the work + open a PR.**

### Ticketing System (Linear) Must Be Configured First

Before creating, listing, or fetching tickets, a tracker (e.g. Linear) must be configured in `.vibe/config.json`. If you or the user runs `bin/ticket create`, `bin/ticket list`, or `bin/ticket get` without a tracker configured:

- The CLI **pauses** and prints: "No ticketing system (e.g. Linear) is configured. Set up a tracker before creating or viewing tickets."
- It then prompts: **"Run tracker setup now?"** (default: yes).
- If the user confirms, it runs the tracker wizard (Linear/Shortcut/None), saves config, and the ticket command proceeds.
- If the user declines, it exits with a hint to run `bin/vibe setup` or `bin/vibe setup --wizard tracker` when ready.

When writing tickets or advising the user to create tickets, either ensure the project has already run `bin/vibe setup` (or `bin/vibe setup --wizard tracker`), or expect the interactive prompt and let the user complete it.

### Starting Work on a Ticket

When asked to "do" a ticket, follow the steps in ["Do this ticket"](#do-this-ticket-ticket--what-it-means) above.

```bash
# Use the vibe CLI to create a worktree
bin/vibe do PROJ-123
```

This creates:
- A worktree at `../project-worktrees/PROJ-123/`
- A branch named according to the pattern (e.g., `PROJ-123`)

### Creating Tickets

When creating tickets programmatically:
1. **Check for duplicates first** — Search existing tickets (open and recently closed) for similar work before creating a new ticket. If a ticket already covers the same scope, update that ticket instead of creating a duplicate.
2. Use descriptive titles: "Verb + Object" format
3. **Apply labels** (see [Label checklist](#label-checklist-for-ticket-creation) below)
4. Include acceptance criteria
5. Link related tickets with **correct blocking direction** (see [Blocking relationships](#blocking-relationships) below)

#### Avoiding Duplicate Tickets

Before creating a new ticket, **always search** for existing tickets that might cover the same work:

```bash
bin/ticket list  # Review open tickets for overlap
```

**Signs of a duplicate:**
- Same component/area being modified
- Similar acceptance criteria
- Part of the same milestone or initiative
- Would result in conflicting changes if both were implemented

**If you find a potential duplicate:**
- Update the existing ticket with any new requirements
- Add a comment explaining the additional scope
- Do NOT create a new ticket

**If scopes overlap but aren't identical:**
- Consider if one ticket can be expanded to cover both
- If truly separate, document the boundary clearly in both tickets
- Link them with "related to" (not blocking)

#### Blocking relationships

Direction matters. The **prerequisite** (foundation) ticket **blocks** the dependent ticket — not the other way around.

- **"A blocks B"** = B cannot start until A is done. (A is the prerequisite.)
- **"A is blocked by B"** = A cannot start until B is done. (B is the prerequisite.)

**CORRECT:** "Initialize monorepo" BLOCKS "Set up React app"
(React app depends on monorepo being done first.)

**WRONG:** "Initialize monorepo" BLOCKED BY "Set up React app"
(That would mean monorepo can't start until React is done — backwards.)

When linking: set the **foundation ticket** as blocking the **dependent ticket(s)**. Do not set the foundation as "blocked by" the later tickets.

**When to use blocking relationships:**
- **True dependencies** — Code in ticket B literally cannot be written until ticket A's code exists
- **HUMAN prerequisites** — A HUMAN ticket blocks work that needs the human's output (e.g., "Provide DATABASE_URL" blocks "Deploy to production")
- **Sequential deployments** — Infrastructure must exist before app deployment

**When NOT to use blocking relationships:**
- **Parallel work** — Two tickets that touch different files can be done simultaneously
- **Nice-to-have order** — "It would be cleaner to do A first" isn't a blocker
- **Same milestone** — Being part of the same feature doesn't mean blocking; use the Milestone label instead

**Keep the dependency graph shallow.** Deep chains (A→B→C→D→E) slow down work. Prefer parallel tickets where possible.

See `recipes/tickets/creating-tickets.md` for full guidance.

#### Label checklist for ticket creation

When creating a ticket, assign:

- **Type** (exactly one): Bug, Feature, Chore, Refactor
- **Risk** (exactly one): Low Risk, Medium Risk, High Risk
- **Area** (at least one): Frontend, Backend, Infra, Docs

Optional: **HUMAN ‼️**, **Milestone**, **Blocked** (see [Special Labels](#special-labels)).

#### Priority (Linear): use the Priority field, not labels

**Do not use P0, P1, P2, or P3 as labels.** Linear has a native **Priority** field. Set priority via that field so it works with Linear's priority views and filters.

When creating or updating tickets, set the **Priority** field (not a label) using this mapping:

| If you mean | Set Linear Priority to |
|-------------|-------------------------|
| P0 / critical | **Urgent** |
| P1 / high | **High** |
| P2 / medium | **Medium** |
| P3 / low | **Low** |
| No priority | **No Priority** |

Labels in `.vibe/config.json` are for **type**, **risk**, and **area** only. Do not add P0/P1/P2/P3 to the label config.

### Ticket Status Updates

Update ticket status as work progresses:
- **Todo** → **In Progress**: When starting work
- **In Progress** → **In Review**: When PR is opened
- **In Review** → **Done**: When PR is merged

---

## Worktree Management

**Agent rule:** When the user asks to clean up worktrees, branches, or "tidy up" local state, follow the [Cleaning Up Worktrees](#cleaning-up-worktrees--follow-this-order) steps (remove worktrees first, then delete branches, then run `bin/vibe doctor`). Do not skip steps.

### Creating Worktrees

```bash
bin/vibe do PROJ-123
```

This creates a worktree (path from config, typically `../<repo>-worktrees/PROJ-123`) and a branch for that ticket.

### When to Clean Up Worktrees

**Clean up a worktree when:**
- The PR for that ticket has been **merged** to main (or the branch is no longer needed), or
- The user asks to "clean up branches/worktrees" or "tidy up".

**Do not remove a worktree** while the branch is still in use (open PR, WIP, or user is working there).

### Cleaning Up Worktrees — Follow This Order

Agents and users **must** do these steps in order whenever cleaning up after a merged PR or doing a general cleanup:

1. **Remove the worktree** (from the **main** repo checkout, not from inside the worktree):
   ```bash
   git worktree remove <path-to-worktree>
   ```
   Path is usually relative to the repo root, e.g. `../<repo>-worktrees/PROJ-123`. Use `git worktree list` to see exact paths. If the worktree has uncommitted changes and you're sure they're not needed: `git worktree remove --force <path>`.

2. **Delete the local branch** (only after the worktree is removed):
   ```bash
   git branch -d PROJ-123
   ```
   Use `-D` if the branch was merged via a merge commit and git reports "not fully merged".

3. **Sync local state** so `.vibe/local_state.json` matches reality:
   ```bash
   bin/vibe doctor
   ```

### One-Time Cleanup of Multiple Worktrees/Branches

When the user asks to "clean up local branches and worktrees":

1. From the **main** repo, run `git worktree list` and note every worktree that is **not** the main repo.
2. For each such worktree: `git worktree remove <path>` (or `--force` if needed).
3. Delete obsolete local branches (e.g. merged feature branches): `git branch -d <branch>` or `git branch -D <branch>`.
4. Run `bin/vibe doctor` to fix `.vibe/local_state.json`.

### Active Worktree State

Worktrees are tracked in `.vibe/local_state.json` (gitignored). Stale entries cause confusion; **always run `bin/vibe doctor`** after adding or removing worktrees so that state stays accurate.

---

## PR Opening Checklist

Before opening a PR, ensure:

### Required
- [ ] Branch follows naming convention (`{PROJ}-{num}`)
- [ ] Rebased onto latest main (`git rebase origin/main`)
- [ ] All tests pass locally (if they exist)
- [ ] PR title includes ticket reference
- [ ] Risk label selected (Low/Medium/High Risk)

### Recommended
- [ ] PR description uses template
- [ ] Testing instructions included (for non-trivial changes)
- [ ] Screenshots included (for UI changes)
- [ ] Documentation updated (if behavior changes)

### PR Template Location
`.github/PULL_REQUEST_TEMPLATE.md`

---

## Testing Policy

**All PRs that change behavior must include tests.** This ensures regressions are caught and code quality remains high.

### When Tests Are Required

| PR Type | Tests Required? | Notes |
|---------|----------------|-------|
| **Feature** | Yes | Test new functionality |
| **Bug fix** | Yes | Add regression test that would have caught the bug |
| **Refactor** | Yes, if behavior could change | Existing tests should still pass |
| **Chore** | Usually no | Dependencies, config, CI changes |
| **Docs** | No | Documentation-only changes |
| **Lint/style** | No | No behavior change |

### Test Location

```
tests/                    # Root-level Python tests (lib/vibe, scripts)
apps/api/tests/          # API tests
apps/web/src/**/*.test.ts # Frontend tests (colocated)
```

### Running Tests

```bash
# Python tests (root)
pytest

# API tests
pytest apps/api/tests/

# Frontend tests
npm --prefix apps/web test
```

### What to Test

**Do test:**
- Public API functions and methods
- Edge cases and error handling
- Integration between components
- User-facing behavior

**Don't test:**
- Private implementation details
- Third-party library behavior
- Trivial getters/setters

### Test Naming

Use descriptive names that explain what's being tested:

```python
# Good
def test_create_worktree_returns_path_when_branch_exists():
    ...

def test_parse_ticket_raises_error_for_invalid_format():
    ...

# Bad
def test_worktree():
    ...

def test_1():
    ...
```

---

## Label Documentation

### Type Labels
| Label | Use When |
|-------|----------|
| **Bug** | Fixing broken functionality |
| **Feature** | Adding new functionality |
| **Chore** | Maintenance, dependencies, cleanup |
| **Refactor** | Code improvement, no behavior change |

### Risk Labels
| Label | Criteria |
|-------|----------|
| **Low Risk** | Docs, tests, typos, minor UI tweaks |
| **Medium Risk** | New features (flagged), bug fixes, refactoring |
| **High Risk** | Auth, payments, database, infrastructure |

### Area Labels
| Label | Scope |
|-------|-------|
| **Frontend** | UI, client-side code |
| **Backend** | Server, API, business logic |
| **Infra** | DevOps, CI/CD, infrastructure |
| **Docs** | Documentation only |

### Special Labels
| Label | Purpose |
|-------|---------|
| **HUMAN ‼️** | Requires human decision/action |
| **Milestone** | Part of a larger feature |
| **Blocked** | Waiting on external dependency |

### Milestones

- **Option A (recommended):** Use the **Milestone** label on tickets that are part of a larger feature, and link related tickets (blocks/blocked-by or parent/child). Keeps 1 ticket = 1 PR and works across trackers.
- **Option B:** Use Linear/Shortcut native milestones when the team already plans with them.

See `recipes/tickets/creating-tickets.md` for details.

---

## GitHub Actions Results

### Understanding CI Failures

When a workflow fails, check:

1. **security.yml**
   - Gitleaks: Secret detected in code
   - Dependency review: Vulnerable dependency in PR
   - CodeQL: Security issue in code

2. **pr-policy.yml**
   - Missing ticket reference in PR
   - Missing risk label
   - Branch naming violation

3. **tests.yml** (if tests exist)
   - Test failure (check output for details)
   - No tests detected (may be intentional for new projects)

### Responding to CI Failures

**Secret detected:**
1. Remove the secret from code
2. If intentional, add to `.vibe/secrets.allowlist.json`
3. Rotate the exposed secret

**Missing labels:**
1. Add the required label via GitHub UI or `gh pr edit`

**Test failures** (if the project has tests):
1. Read the failure output
2. Fix the failing test or the code
3. Push the fix

---

## Recipes Reference

When implementing specific features, consult these recipes:

### Workflow
- `recipes/workflows/git-worktrees.md` - Parallel development
- `recipes/workflows/branching-and-rebasing.md` - Git workflow
- `recipes/workflows/pr-risk-assessment.md` - Risk classification
- `recipes/workflows/testing-instructions-writing.md` - Testing docs

### Security
- `recipes/security/secret-management.md` - Handling secrets
- `recipes/security/permissions-hardening.md` - GitHub Actions security

### Architecture
- `recipes/architecture/adr-guide.md` - Decision records
- `recipes/architecture/alternatives-analysis.md` - Documenting options

### Tickets
- `recipes/tickets/creating-tickets.md` - Creating tickets (blocking, labels, milestones)
- `recipes/tickets/linear-setup.md` - Linear configuration
- `recipes/tickets/shortcut.md` - Shortcut (stub)

---

## Command Reference

```bash
# Setup and health
bin/vibe setup              # Initial configuration
bin/vibe doctor             # Health check
bin/doctor                  # Alias for doctor

# Ticket operations
bin/ticket list             # List tickets
bin/ticket get PROJ-123     # Get ticket details
bin/ticket create "Title"   # Create ticket
bin/ticket update PROJ-123 --status "In Progress"  # Update ticket
bin/ticket close PROJ-123   # Close ticket (Done)
bin/ticket close PROJ-123 --cancel  # Close ticket (Canceled)
bin/ticket comment PROJ-123 "message"  # Add comment

# Working on tickets ("do this ticket" = fresh worktree + rebase + open PR when done)
bin/vibe do PROJ-123        # Create worktree for ticket

# Secrets
bin/secrets list            # List secrets
bin/secrets sync            # Sync to provider
```

---

## Common Patterns

### Starting a New Feature

```bash
# 1. Get ticket details
bin/ticket get PROJ-123

# 2. Create worktree
bin/vibe do PROJ-123

# 3. Navigate to worktree
cd ../project-worktrees/PROJ-123

# 4. Implement feature...

# 5. Commit and push
git add .
git commit -m "PROJ-123: Add feature description"
git push -u origin PROJ-123

# 6. Create PR
gh pr create --title "PROJ-123: Add feature" --body "..."
```

### Fixing a Bug

```bash
# 1. Create worktree
bin/vibe do PROJ-456

# 2. Fix the bug
cd ../project-worktrees/PROJ-456
# ... make changes ...

# 3. Add tests that would have caught it
# 4. Commit with bug ticket reference
git commit -m "PROJ-456: Fix null pointer in auth flow"
```

### Handling CI Failures

```bash
# 1. Check what failed
gh pr checks

# 2. If tests failed (and the project has tests), run locally
pytest  # or npm test, etc.

# 3. If secret scanning failed
# Review .vibe/secrets.allowlist.json

# 4. Fix and push
git push
```

---

## Anti-Patterns to Avoid

1. **Don't merge main into feature branches** - Always rebase
2. **Don't force push to main** - Only to feature branches
3. **Don't skip CI** - Wait for checks to pass
4. **Don't commit secrets** - Even for "testing"
5. **Don't skip risk labels** - Every PR needs one
6. **Don't create PRs without ticket references** - Link to tickets
7. **Don't work in the main checkout** - Use worktrees for ticket work
8. **Don't leave merged worktrees around** - After a PR is merged, remove the worktree, delete the local branch, and run `bin/vibe doctor`
9. **Don't use `cd path && command`** - Use absolute paths instead (see below)

---

## Efficient Command Execution

**Prefer absolute paths over `cd && command` patterns.** This is faster and avoids working directory issues.

### Bad (inefficient)
```bash
cd /path/to/worktree && git push -u origin branch-name
cd /path/to/worktree && gh pr create --title "..." --body "..."
```

### Good (efficient)
```bash
git -C /path/to/worktree push -u origin branch-name
gh pr create --repo owner/repo --head branch-name --title "..." --body "..."
```

### Common commands with absolute paths

| Command | Absolute path version |
|---------|----------------------|
| `cd dir && git ...` | `git -C /absolute/path ...` |
| `cd dir && npm ...` | `npm --prefix /absolute/path ...` |
| `cd dir && pytest` | `pytest /absolute/path/tests` |
| `cd dir && gh pr create` | `gh pr create --repo owner/repo --head branch` |

### When working in worktrees

Instead of:
```bash
cd ../city-doodle-worktrees/CITY-123 && git push -u origin CITY-123
cd ../city-doodle-worktrees/CITY-123 && gh pr create ...
```

Use:
```bash
git -C ../city-doodle-worktrees/CITY-123 push -u origin CITY-123
gh pr create --repo kdenny/city-doodle --head CITY-123 --title "..." --body "..."
```

This eliminates sequential commands and shell resets between operations.

---

## When Things Go Wrong

### Rebase Conflicts
```bash
git rebase --abort  # Start over
# Or resolve and continue:
git add <resolved-files>
git rebase --continue
```

### Accidentally Committed a Secret
1. Remove from code immediately
2. Push the fix
3. Rotate the secret at its source
4. Consider adding to allowlist if it's actually public

### Worktree in Bad State
```bash
# From the main repo: force remove the worktree
git worktree remove --force <path-from-git-worktree-list>
# Delete the branch if needed
git branch -D PROJ-123
# Recreate if you still need to work on that ticket
bin/vibe do PROJ-123
```
See [Cleaning Up Worktrees](#cleaning-up-worktrees--follow-this-order) for the full cleanup procedure.
