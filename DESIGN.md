# DESIGN.md

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

## Anti-Goals

This project does not aim to:

- become a full README formatting tool
- replace markdown linters
- manage documentation beyond badges
- support every possible badge provider
- generate badges that require runtime JavaScript or external services to render

## CLI Design Principles

- commands stay small and obvious
- output and side effects must be explicit
- `apply` and `check` must work fully offline (no network calls)
- `doctor` and `repair` clearly communicate that they make network requests
- error messages should be short, actionable, and include context (which file, which badge)
- exit codes are meaningful: `0` = success, `1` = failure or issues found

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
