# DESIGN.md

> Badges should be simple signals, not maintenance burdens.

## Purpose

This document defines the design philosophy of badge-sync.

It exists to:

- keep the CLI predictable and deterministic
- prevent scope creep beyond badge management
- keep badge generation transparent and debuggable
- provide guardrails for AI-assisted development

## Goals

- provide a small, reliable CLI for managing README badges
- favor automatic detection over manual configuration
- generate badge blocks that are easy to read and edit by hand
- keep the tool useful both locally and in CI/CD pipelines
- be simple, predictable, boring, and safe — like black or prettier for badges
## Anti-Goals

This project does not aim to:

- become a full README formatting tool
- replace markdown linters
- manage documentation beyond badges
- support every possible badge provider
- generate badges that require runtime JavaScript or external services to render
- provide its own badge rendering or hosting service (badge-sync is a badge manager, not a provider)

## CLI Design Principles

- commands stay small and obvious
- output and side effects must be explicit
- `apply` and `check` must work fully offline (no network calls)
- `doctor` and `repair` clearly communicate that they make network requests
- error messages should be short, actionable, and include context (which file, which badge)
- exit codes are meaningful: `0` = success, `1` = failure or issues found

## Conservative by Default

badge-sync operates on the principle that doing less is safer than doing more.

- never remove existing badges unless the user explicitly requests it
- minimize auto-correction — suggest changes rather than silently applying them
- preserve user-added custom badges that are not auto-detected
- when merging auto-detected badges with existing ones, keep unrecognized badges intact
- if a badge exists in the block but is not auto-detected, treat it as a user-added badge and preserve it

The default behavior is additive: badge-sync adds missing badges and updates stale ones, but never deletes badges it did not create.

## Safe Operations

Certain actions are too destructive for automatic execution:

**Never auto-fix (suggestion only):**

- badge deletion — removing a badge the user may have intentionally added
- provider changes — switching a badge from one provider to another
- badge type changes — changing a badge's semantics (e.g., version → downloads)

**Safe to auto-fix:**

- workflow name mismatch — updating a workflow filename in a badge URL
- repository name mismatch — updating owner/repo in badge URLs
- duplicate removal — removing exact duplicates (same type, same URL)
- URL regeneration — refreshing a badge URL from current metadata

When in doubt, report the issue and let the user decide.
## Badge Block Isolation Principle

badge-sync operates exclusively within the badge block markers:

```md
<!-- BADGES:START -->
<!-- BADGES:END -->
```

This is the project's most critical invariant:

- content before the start marker must never be modified
- content after the end marker must never be modified
- if markers are missing, the tool must inform the user — never insert markers automatically without explicit consent
- the badge block is the only writable region

## Determinism Principle

Given the same repository state and configuration, badge-sync must produce identical output:

- same badge set
- same badge ordering
- same markdown rendering
- same file content after `apply`

This enables reliable `check` commands in CI — the output is verifiable and reproducible.

## Detection Over Configuration

badge-sync should detect as much as possible from repository files:

- prefer parsing `package.json` over asking the user for the package name
- prefer scanning `.github/workflows/` over requiring workflow configuration
- prefer reading `LICENSE` over asking for the license type

Configuration exists as an override mechanism, not as the primary input.

## Badge URL Strategy

- use Shields.io as the primary badge provider for ecosystem badges
- use GitHub native badge URLs for workflow status badges
- construct URLs from detected metadata — never hardcode repository-specific values
- encode workflow filenames properly (spaces → `%20`, special characters escaped)

## Configuration Design

- configuration is optional — badge-sync works with zero configuration
- configuration files: `badgesync.config.json`, `badgesync.config.yaml`, `badgesync.config.yml`
- configuration priority: user config > project preset > default ordering
- configuration schema is validated with zod — invalid config produces clear error messages

## Repair Conservatism

The `repair` command follows a strict conservative policy:

- only fix issues that can be verified from repository metadata (workflow names, repo URLs, duplicates)
- never delete badges — even if they appear broken, the user may want to fix them manually
- never change badge providers — if a user chose a non-Shields.io provider, respect that choice
- preserve the user's badge block structure: auto-detected badges are updated in place, custom badges remain untouched
- when `repair` regenerates badge URLs, it merges with existing content rather than replacing it

## Change Discipline

- prefer additive changes over breaking changes
- keep badge generation deterministic
- if badge ordering or formatting changes, update tests and docs in the same change
- if a new ecosystem is added, it must include detection, resolution, and test fixtures
- never silently change behavior — breaking changes require a major version bump
## Compatibility Policy

- minimum supported Node.js version: 20
- ESM only — `"type": "module"` in package.json
- development may use newer Node.js versions
- generated markdown must be valid CommonMark

## UX Philosophy

badge-sync should feel like a code formatter for badges:

- **simple** — zero-config works out of the box, no setup ceremony
- **predictable** — same input always produces the same output
- **boring** — no surprises, no clever behavior, no magic
- **safe** — the worst case is "nothing changed", never "something broke"

The tool should be invisible when working correctly. Users should only notice badge-sync when it catches a real problem.

Core keywords: **simple**, **conservative**, **safe**, **deterministic**.
