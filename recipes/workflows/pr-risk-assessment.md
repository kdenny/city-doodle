# PR Review Guidelines

## When to Use This Recipe

Use this recipe when you need to:
- Determine appropriate review requirements for PRs
- Guide testing and rollback planning

## Review Guidelines

### Minimal Changes
Changes unlikely to cause issues in production.

**Characteristics:**
- Documentation updates
- Test-only changes
- Typo fixes
- Minor UI tweaks (non-critical paths)
- Dependency patch updates
- Code comments

**Review Requirements:**
- One reviewer
- Standard CI passing
- Can merge without manual testing

### Moderate Changes
Changes that could cause issues but are contained.

**Characteristics:**
- New features (behind feature flags)
- Bug fixes in non-critical paths
- Refactoring of isolated modules
- Minor dependency updates
- API changes (non-breaking)
- Configuration changes

**Review Requirements:**
- One or two reviewers
- CI passing with good test coverage
- Manual testing in staging recommended
- Rollback plan identified

### Significant Changes
Changes that could significantly impact production.

**Characteristics:**
- Database migrations
- Authentication/authorization changes
- Payment processing changes
- Core business logic changes
- Infrastructure changes
- Breaking API changes
- Major dependency updates
- Performance-critical paths

**Review Requirements:**
- Two or more reviewers
- Security review (if auth/payment)
- Comprehensive test coverage
- Mandatory staging testing
- Detailed rollback plan
- Consider phased rollout

## Review Assessment Checklist

Ask these questions to determine review scope:

### Impact Questions
- [ ] Does this touch authentication/authorization?
- [ ] Does this modify payment/billing logic?
- [ ] Does this change database schema?
- [ ] Is this on a critical user path?
- [ ] Could this cause data loss?

### Scope Questions
- [ ] How many files changed?
- [ ] How many users affected?
- [ ] What's the blast radius if it fails?
- [ ] Is this easily reversible?

### Confidence Questions
- [ ] Is there good test coverage?
- [ ] Has this been tested in staging?
- [ ] Do we understand all the edge cases?
- [ ] Are dependencies well understood?

## Extension Points

- Add automated review scope scoring based on files changed
- Require additional approvers for significant changes
- Block merges for significant changes without staging test
