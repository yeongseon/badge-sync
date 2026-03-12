# Security

This document covers security considerations for using and contributing to badge-sync.

## Reporting Vulnerabilities

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public GitHub issue
2. Email the maintainer directly or use GitHub's private vulnerability reporting feature (Security tab > "Report a vulnerability")
3. Include a description of the vulnerability, steps to reproduce, and potential impact
4. Allow reasonable time for a fix before public disclosure

## Threat Model

badge-sync is a CLI tool that reads project metadata files and writes badge markdown to README files. Its security surface is limited but includes the following considerations.

### File System Access

**What badge-sync reads:**

- `package.json`, `pyproject.toml`, `Cargo.toml` -- project metadata
- `.github/workflows/*.yml` -- CI workflow filenames
- `LICENSE`, `LICENSE.*` -- license detection
- `README.md` (or specified README file) -- badge block content
- `badgesync.config.{json,yaml,yml}` -- user configuration
- `.git/config` -- git remote URL extraction

**What badge-sync writes:**

- `README.md` (or specified README file) -- badge block content only, between `<!-- BADGES:START -->` and `<!-- BADGES:END -->` markers

badge-sync never writes to any file other than the specified README. The badge block isolation principle ensures content outside the markers is never modified.

### Network Access

- `apply`, `check`, `init`, `list` -- **no network calls**. These commands work fully offline.
- `doctor`, `repair` -- **make HTTP HEAD requests** to validate badge image and link URLs. These commands clearly communicate their network behavior in CLI output.

Network requests go to:

- `img.shields.io` -- badge image URL validation
- `github.com` -- GitHub Actions badge and repository URL validation
- `www.npmjs.com` -- npm badge link validation
- `pypi.org` -- PyPI badge link validation
- `crates.io` -- crates.io badge link validation

No data is sent to these services beyond the HTTP HEAD request. badge-sync does not transmit repository content, metadata, or user information.

### Supply Chain

badge-sync has a minimal dependency footprint:

| Dependency | Purpose | Risk Level |
| ---------- | ------- | ---------- |
| `commander` | CLI parsing | Low -- widely used, well-maintained |
| `fast-glob` | File matching | Low -- widely used, well-maintained |
| `yaml` | YAML parsing | Low -- widely used, well-maintained |
| `zod` | Schema validation | Low -- widely used, well-maintained |

All dependencies are pinned with caret ranges in `package.json` and locked in `package-lock.json`.

### GitHub Action Security

When used as a GitHub Action (`yeongseon/badge-sync@v1`):

- The action runs in the workflow's runner environment
- It uses `GITHUB_TOKEN` for PR creation (no additional secrets needed)
- The action only reads files and modifies the README badge block
- The `GITHUB_TOKEN` has scoped permissions (`contents: write`, `pull-requests: write`)

**Recommendations for action users:**

- Pin the action to a specific version tag (e.g., `@v1`) rather than a branch
- Review the action source code before using it in private repositories
- Use the minimum required permissions in your workflow

### Configuration Validation

All configuration files are validated using zod schemas before being used. This prevents:

- Type confusion attacks (passing a string where an array is expected)
- Prototype pollution via malformed JSON/YAML
- Arbitrary code execution via configuration (configuration is data-only, never evaluated as code)

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 0.4.x | Yes |
| 0.3.x | Yes |
| 0.2.x | No |
| 0.1.x | No |

Security fixes are backported to the latest minor version only. Users should upgrade to the latest version.

## Best Practices

### For badge-sync users:

- Keep badge-sync updated to the latest version
- Review generated badge URLs before committing (use `--dry-run`)
- In CI, use `badge-sync check` rather than `badge-sync apply` to avoid unexpected README modifications
- When using the GitHub Action, verify the action version matches a known release

### For badge-sync contributors:

- Never add dependencies without justification and security review
- Never evaluate user configuration as code
- Never access files outside the project directory
- Never make network requests in `apply`, `check`, `init`, or `list` commands
- Always validate and sanitize input from metadata files before constructing URLs
- URL-encode special characters in badge URLs to prevent injection

## Node.js Version Policy

badge-sync requires Node.js >= 20. This ensures:

- Active LTS support with security patches
- Modern ECMAScript features without transpilation
- ESM module support without compatibility layers

Older Node.js versions are not supported and may contain known vulnerabilities.

## License

badge-sync is licensed under the MIT License. See the [LICENSE](https://github.com/yeongseon/badge-sync/blob/main/LICENSE) file for details.
