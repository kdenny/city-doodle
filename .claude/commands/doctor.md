---
description: Run health checks on the project configuration and dependencies
---

# /doctor - Check project health

Run health checks on the project configuration and dependencies.

## Usage

```
/doctor
/doctor --verbose
```

## What it does

Checks for:
- Valid `.vibe/config.json`
- Python version (3.11+)
- Git installation and configuration
- GitHub CLI (`gh`) authentication
- Tracker configuration (Linear/Shortcut)
- Secrets allowlist validity
- Stale worktrees
- Missing dependencies

## Instructions

When the user invokes `/doctor`:

1. Run `bin/vibe doctor`
2. Report results clearly:
   - PASS items in green/checkmark
   - WARN items in yellow/warning
   - FAIL items in red/error
3. For any FAIL items, suggest remediation steps

## Example Output

```
Project Health Check
====================

[PASS] Python version: 3.11.4
[PASS] Git installed: 2.42.0
[PASS] GitHub CLI authenticated: kdenny
[PASS] Tracker configured: Linear
[WARN] 2 stale worktrees found (run cleanup)
[PASS] Secrets allowlist valid

Overall: HEALTHY (1 warning)
```

## Common Issues

| Issue | Fix |
|-------|-----|
| Python < 3.11 | Install Python 3.11+ via pyenv or brew |
| gh not authenticated | Run `gh auth login` |
| No tracker configured | Run `bin/vibe setup --wizard tracker` |
| Stale worktrees | Run `/cleanup` or `git worktree prune` |
