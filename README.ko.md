# badge-sync

<!-- BADGES:START -->
[![npm version](https://img.shields.io/npm/v/badge-sync)](https://www.npmjs.com/package/badge-sync)
<!-- BADGES:END -->

다른 언어: [English](README.md) | [日本語](README.ja.md) | [简体中文](README.zh-CN.md)

README 배지를 깔끔하고 정확하며 일관되게 유지하세요.

> **Status**: 초기 단계입니다. 핵심 기능은 작동하지만 실제 환경의 특수한 경우들에 대해서는 수정이 필요할 수 있습니다.

## Problem

README 배지는 오픈소스 프로젝트에서 널리 사용됩니다.

하지만 실제로 많은 저장소들이 다음과 같은 문제를 겪고 있습니다:

- 저장소나 워크플로우 이름을 바꾼 후 끊어진 배지 링크
- 오래된 서비스를 가리키는 낡은 CI 배지
- 다른 프로젝트에서 복사해와서 잘못된 저장소를 참조하는 배지
- 저장소마다 제각각인 배지 순서

배지를 관리하는 일은 생각보다 번거롭고 실수가 잦은 작업입니다.

## Solution

badge-sync는 README 배지 관리를 돕는 작은 CLI 도구입니다.

이 도구는 다음 작업들을 자동으로 수행합니다:

- 저장소에 적합한 배지 감지
- 배지 링크 유효성 검사
- 끊어진 배지 참조 수정
- 일관된 배지 순서 유지

```bash
npx badge-sync apply
```

## Demo

**Before** — 오래되거나 끊어진 배지가 있는 일반적인 README:

```md
<!-- BADGES:START -->
[![Build Status](https://travis-ci.org/old-org/old-name.svg?branch=master)](https://travis-ci.org/old-org/old-name)
[![npm](https://img.shields.io/npm/v/old-name.svg)](https://npmjs.com/package/old-name)
[![Coverage](https://coveralls.io/repos/github/old-org/old-name/badge.svg)](https://coveralls.io/github/old-org/old-name)
<!-- BADGES:END -->
```

```bash
$ badge-sync doctor

  ✗ Badge "Build Status" — URL returns 404
  ✗ Badge "npm" — package name mismatch (old-name ≠ my-tool)
  ✗ Badge "Coverage" — repository moved (old-org/old-name → my-org/my-tool)

3 issues found. Run badge-sync repair to fix.
```

**After** — `badge-sync apply` 실행 후:

```md
<!-- BADGES:START -->
[![npm version](https://img.shields.io/npm/v/my-tool)](https://www.npmjs.com/package/my-tool)
[![node version](https://img.shields.io/node/v/my-tool)](https://nodejs.org)
[![ci workflow](https://github.com/my-org/my-tool/actions/workflows/ci.yml/badge.svg)](https://github.com/my-org/my-tool/actions/workflows/ci.yml)
[![license](https://img.shields.io/github/license/my-org/my-tool)](https://github.com/my-org/my-tool/blob/main/LICENSE)
<!-- BADGES:END -->
```

정확한 이름, 정확한 URL, 정확한 순서. 수작업이 전혀 필요 없습니다.

## Philosophy

> 배지는 간단한 신호여야 하며, 관리의 짐이 되어서는 안 됩니다.

badge-sync는 보수적인 설계를 지향합니다:

- **Zero-config** — 설정 없이 `badge-sync apply`만으로 작동합니다.
- **Deterministic** — 동일한 저장소 상태에서는 항상 동일한 배지를 생성합니다.
- **Conservative** — 사용자가 직접 추가한 배지는 삭제하지 않고, 오래된 것만 업데이트합니다.
- **Offline-first** — `apply`와 `check`는 네트워크 연결 없이도 작동합니다.
- **Safe** — 오직 `<!-- BADGES:START -->` / `<!-- BADGES:END -->` 마커 안의 내용만 수정합니다.

## Installation

```bash
npm install -g badge-sync
```

또는 직접 실행:

```bash
npx badge-sync apply
```

## Usage

```bash
badge-sync init          # 마커를 설정하고 배지를 감지합니다.
badge-sync apply         # 배지를 생성하고 적용합니다.
badge-sync check         # 배지가 저장소 상태와 일치하는지 확인합니다 (CI용).
badge-sync doctor        # 끊어지거나 일관되지 않은 배지를 찾습니다.
badge-sync repair        # 배지 문제를 자동으로 수정합니다.
```

## Supported Ecosystems

| Ecosystem              | Metadata Source                        | Badges Generated                  |
| ---------------------- | -------------------------------------- | --------------------------------- |
| JavaScript / TypeScript | `package.json`                        | npm version, Node version         |
| Python                 | `pyproject.toml` / `requirements.txt`  | PyPI version, Python version      |
| Rust                   | `Cargo.toml`                           | crates.io version                 |

자동으로 감지되는 추가 배지:

- **CI** — GitHub Actions 워크플로우 상태
- **License** — `LICENSE` 파일에서 추출
- **Stars** — GitHub 원격 저장소 정보에서 추출

## Configuration

badge-sync는 설정 없이도 잘 작동합니다. 모든 배지는 저장소 파일에서 자동으로 감지됩니다.

배지 순서를 변경하거나 특정 배지를 제외하려면 설정 파일을 만드세요:

```yaml
# badgesync.config.yaml
badges:
  order:
    - distribution
    - runtime
    - build
    - quality
    - metadata
    - social
  exclude:
    - stars
```

설정 우선순위: 사용자 설정 > 프로젝트 프리셋 > 기본 순서.

지원되는 설정 파일: `badgesync.config.json`, `badgesync.config.yaml`, `badgesync.config.yml`

## CI Integration

### Using npx

```yaml
- name: Check badges
  run: npx badge-sync check
```

### Using GitHub Action

```yaml
- uses: yeongseon/badge-sync@main
  with:
    command: check
```

옵션 사용 예시:

```yaml
- uses: yeongseon/badge-sync@main
  with:
    command: apply
    readme: docs/README.md
    dry-run: true
```

`badge-sync check`는 배지 상태가 일치하지 않으면 종료 코드 `1`을 반환하여 파이프라인을 실패시킵니다.

## Roadmap

- [x] 핵심 배지 감지 및 생성
- [x] `apply`, `check`, `doctor`, `repair` 명령어
- [ ] 추가 생태계 지원 (Go, Java)
- [x] 커버리지 배지 감지
- [x] GitHub Action 배포
- [x] 대화형 CLI 설정
- [x] 모노레포 지원

## Documentation

- [Product Requirements](PRD.md)
- [Architecture](ARCH.md)
- [Design Principles](DESIGN.md)
- [CLI Specification](docs/CLI.md)
- [Agent Instructions](AGENTS.md)

## License

MIT
