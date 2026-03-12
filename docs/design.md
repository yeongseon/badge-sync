# Design Philosophy

> Badges should be simple signals, not maintenance burdens.

This document defines the design philosophy that guides badge-sync's development. It explains why the tool behaves the way it does and provides guardrails for future development decisions.

## Goals

- Provide a small, reliable CLI for managing README badges
- Favor automatic detection over manual configuration
- Generate badge blocks that are easy to read and edit by hand
- Keep the tool useful both locally and in CI/CD pipelines
- Be simple, predictable, boring, and safe -- like black or prettier, but for badges

## Anti-Goals

This project does not aim to:

- Become a full README formatting tool
- Replace markdown linters
- Manage documentation beyond badges
- Support every possible badge provider
- Generate badges that require runtime JavaScript or external services to render
- Provide its own badge rendering or hosting service (badge-sync is a badge manager, not a provider)

## Core Principles

### Conservative by Default

badge-sync operates on the principle that doing less is safer than doing more.

- Never remove existing badges unless the user explicitly requests it
- Minimize auto-correction -- suggest changes rather than silently applying them
- Preserve user-added custom badges that are not auto-detected
- When merging auto-detected badges with existing ones, keep unrecognized badges intact
- If a badge exists in the block but is not auto-detected, treat it as a user-added badge and preserve it

The default behavior is additive: badge-sync adds missing badges and updates stale ones, but never deletes badges it did not create.

### Badge Block Isolation

badge-sync operates exclusively within the badge block markers:

```md
<!-- BADGES:START -->
<!-- BADGES:END -->
```

This is the project's most critical invariant:

- Content before the start marker must never be modified
- Content after the end marker must never be modified
- If markers are missing, the tool must inform the user -- never insert markers automatically without explicit consent
- The badge block is the only writable region

### Determinism

Given the same repository state and configuration, badge-sync must produce identical output:

- Same badge set
- Same badge ordering
- Same markdown rendering
- Same file content after `apply`

This enables reliable `check` commands in CI -- the output is verifiable and reproducible.

### Detection Over Configuration

badge-sync should detect as much as possible from repository files:

- Prefer parsing `package.json` over asking the user for the package name
- Prefer scanning `.github/workflows/` over requiring workflow configuration
- Prefer reading `LICENSE` over asking for the license type

Configuration exists as an override mechanism, not as the primary input.

## CLI Design Principles

- Commands stay small and obvious
- Output and side effects must be explicit
- `apply` and `check` must work fully offline (no network calls)
- `doctor` and `repair` clearly communicate that they make network requests
- Error messages should be short, actionable, and include context (which file, which badge)
- Exit codes are meaningful: `0` = success, `1` = failure or issues found

## Safe Operations

Certain actions are too destructive for automatic execution:

**Never auto-fix (suggestion only):**

- Badge deletion -- removing a badge the user may have intentionally added
- Provider changes -- switching a badge from one provider to another
- Badge type changes -- changing a badge's semantics (e.g., version to downloads)

**Safe to auto-fix:**

- Workflow name mismatch -- updating a workflow filename in a badge URL
- Repository name mismatch -- updating owner/repo in badge URLs
- Duplicate removal -- removing exact duplicates (same type, same URL)
- URL regeneration -- refreshing a badge URL from current metadata

When in doubt, report the issue and let the user decide.

## Badge URL Strategy

- Use Shields.io as the primary badge provider for ecosystem badges
- Use GitHub native badge URLs for workflow status badges
- Construct URLs from detected metadata -- never hardcode repository-specific values
- Encode workflow filenames properly (spaces become `%20`, special characters escaped)

## Repair Conservatism

The `repair` command follows a strict conservative policy:

- Only fix issues that can be verified from repository metadata (workflow names, repo URLs, duplicates)
- Never delete badges -- even if they appear broken, the user may want to fix them manually
- Never change badge providers -- if a user chose a non-Shields.io provider, respect that choice
- Preserve the user's badge block structure: auto-detected badges are updated in place, custom badges remain untouched
- When `repair` regenerates badge URLs, it merges with existing content rather than replacing it

## Change Discipline

- Prefer additive changes over breaking changes
- Keep badge generation deterministic
- If badge ordering or formatting changes, update tests and docs in the same change
- If a new ecosystem is added, it must include detection, resolution, and test fixtures
- Never silently change behavior -- breaking changes require a major version bump

## Compatibility Policy

- Minimum supported Node.js version: 20
- ESM only -- `"type": "module"` in package.json
- Development may use newer Node.js versions
- Generated markdown must be valid CommonMark

## UX Philosophy

badge-sync should feel like a code formatter for badges:

- **Simple** -- zero-config works out of the box, no setup ceremony
- **Predictable** -- same input always produces the same output
- **Boring** -- no surprises, no clever behavior, no magic
- **Safe** -- the worst case is "nothing changed", never "something broke"

The tool should be invisible when working correctly. Users should only notice badge-sync when it catches a real problem.

Core keywords: **simple**, **conservative**, **safe**, **deterministic**.
