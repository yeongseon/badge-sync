# GitHub Action

badge-sync ships as a GitHub Action you can use in any workflow. This document covers the action inputs, the badge-sync bot workflow, and common customization scenarios.

## Action Inputs

| Input | Default | Description |
| ----- | ------- | ----------- |
| `command` | `check` | Command to run: `apply`, `check`, `init`, `doctor`, `repair` |
| `readme` | `README.md` | Path to README file |
| `dry-run` | `false` | Preview changes without writing |

### Basic Usage

```yaml
- uses: yeongseon/badge-sync@v1
  with:
    command: check
```

### With Options

```yaml
- uses: yeongseon/badge-sync@v1
  with:
    command: apply
    readme: docs/README.md
    dry-run: true
```

## Badge Check (CI Gate)

Add a badge check step to your CI workflow to fail the build when badges are out of sync:

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      # ... your build steps ...
      - uses: yeongseon/badge-sync@v1
        with:
          command: check
```

`badge-sync check` exits with code 1 when badges don't match your repo metadata, which fails the workflow.

## Badge Bot (Automated PR)

The bot workflow runs badge-sync automatically and opens a pull request when badges need updating. Copy the workflow file below into your repository.

### Full Workflow

```yaml
# .github/workflows/badge-sync.yml
name: badge-sync bot

on:
  schedule:
    - cron: '0 9 * * 1' # weekly Monday 09:00 UTC
  push:
    branches: [main]
    paths:
      - 'package.json'
      - 'pyproject.toml'
      - 'Cargo.toml'
      - '.github/workflows/*.yml'
      - 'LICENSE'
      - 'badgesync.config.*'
  workflow_dispatch:

permissions:
  contents: write
  pull-requests: write

jobs:
  badge-sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: yeongseon/badge-sync@v1
        with:
          command: apply

      - name: Check for changes
        id: diff
        run: |
          if git diff --quiet; then
            echo "changed=false" >> "$GITHUB_OUTPUT"
          else
            echo "changed=true" >> "$GITHUB_OUTPUT"
          fi

      - name: Create Pull Request
        if: steps.diff.outputs.changed == 'true'
        uses: peter-evans/create-pull-request@v7
        with:
          commit-message: 'chore: sync README badges'
          title: 'chore: sync README badges'
          body: |
            Automated badge sync by [badge-sync](https://github.com/yeongseon/badge-sync).
            This PR updates the badge block to match current project metadata.
          branch: badge-sync/update
          delete-branch: true
          labels: badges, automated
```

### How It Works

1. **Triggers** — The workflow runs on:
   - **Schedule**: Weekly on Monday at 09:00 UTC (catches stale badges)
   - **Push to main**: When metadata files change (`package.json`, `pyproject.toml`, `Cargo.toml`, workflow files, `LICENSE`, or badge-sync config)
   - **Manual**: Via the "Run workflow" button in GitHub Actions
2. **Apply** — Runs `badge-sync apply` to regenerate badges from current metadata
3. **Diff check** — If no changes, the workflow exits early
4. **Pull request** — Opens (or updates) a PR on the `badge-sync/update` branch with the label `badges`

### Customizing Triggers

#### Change schedule frequency

```yaml
# Daily at midnight UTC
schedule:
  - cron: '0 0 * * *'

# Every 6 hours
schedule:
  - cron: '0 */6 * * *'

# Monthly (1st of each month)
schedule:
  - cron: '0 9 1 * *'
```

#### Add more metadata paths

```yaml
paths:
  - 'package.json'
  - 'pyproject.toml'
  - 'Cargo.toml'
  - 'setup.py'              # legacy Python
  - 'requirements.txt'      # Python deps
  - '.github/workflows/*.yml'
  - 'LICENSE'
  - 'badgesync.config.*'
```

#### Restrict to specific branches

```yaml
push:
  branches: [main, develop]
  paths:
    - 'package.json'
    # ...
```

#### Disable schedule (push-only)

Remove the `schedule` block entirely — the bot will only run when metadata files change on push.

### Customizing the Pull Request

The [peter-evans/create-pull-request](https://github.com/peter-evans/create-pull-request) action is highly configurable:

```yaml
- uses: peter-evans/create-pull-request@v7
  with:
    commit-message: 'chore(badges): update README badges'
    title: 'chore(badges): update README badges'
    body: 'Custom PR body here.'
    branch: my-custom-branch
    base: develop          # target branch (default: repo default branch)
    reviewers: my-username
    assignees: my-username
    labels: badges, bot
    draft: true            # create as draft PR
```

## Permissions

The bot workflow requires these permissions:

| Permission | Why |
| ---------- | --- |
| `contents: write` | To commit badge changes |
| `pull-requests: write` | To create/update the PR |

The default `GITHUB_TOKEN` provides these permissions. No additional tokens needed.

### Fork Limitations

`GITHUB_TOKEN` in forked repositories has reduced permissions. The bot workflow:

- **Works** in the original repository
- **Does not work** in forks (cannot create PRs against the upstream repo)

This is expected GitHub behavior. Fork contributors should run `badge-sync apply` locally.

## FAQ

### Will the bot create duplicate PRs?

No. The `peter-evans/create-pull-request` action uses a fixed branch name (`badge-sync/update`). If badges change again before the PR is merged, the existing PR is updated in place.

### What if I merge the PR but badges drift again?

The bot runs on schedule (weekly by default) and on metadata file changes. It will detect the drift and open a new PR.

### Can I use this with monorepos?

Yes. Set the `readme` input to target a specific package's README:

```yaml
- uses: yeongseon/badge-sync@v1
  with:
    command: apply
    readme: packages/my-lib/README.md
```

For multiple packages, add multiple steps or use a matrix strategy.

### Can I auto-merge the bot PR?

Yes. Add the [peter-evans/enable-pull-request-automerge](https://github.com/peter-evans/enable-pull-request-automerge) action after the create-pull-request step, or configure branch protection rules to auto-merge PRs from the `badge-sync/update` branch.

### How do I disable the bot temporarily?

Either:
- Disable the workflow in GitHub Actions UI (Settings → Actions → Workflows → badge-sync bot → Disable)
- Delete the workflow file
