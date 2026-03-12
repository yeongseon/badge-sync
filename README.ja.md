# badge-sync

<!-- BADGES:START -->
[![npm version](https://img.shields.io/npm/v/badge-sync)](https://www.npmjs.com/package/badge-sync)
<!-- BADGES:END -->

他の言語: [English](README.md) | [한국어](README.ko.md) | [简体中文](README.zh-CN.md)

READMEのバッジをクリーンに、正確に、そして一貫性を保ちます。

> **Status**: 初期段階です。主要な機能は動作しますが、実際の環境における特殊なケースでは修正が必要になる場合があります。

## Problem

READMEのバッジは、オープンソースプロジェクトで広く利用されています。

しかし、実際には多くのリポジトリで以下のような問題が発生しています：

- リポジトリ名やワークフロー名を変更した後にリンク切れになったバッジ
- 古いサービスを指したままの古いCIバッジ
- 他のプロジェクトからコピーしたことで、誤ったリポジトリを参照しているバッジ
- リポジトリごとにバラバラなバッジの並び順

バッジのメンテナンスは、意外にも手作業が多く、ミスが発生しやすい作業です。

## Solution

badge-syncは、READMEのバッジのメンテナンスを支援する小さなCLIツールです。

このツールは、以下の作業を自動的に行います：

- リポジトリに関連するバッジの自動検出
- バッジのリンク切れチェック
- 壊れたバッジ参照の修正
- バッジの並び順の一貫性を維持

```bash
npx badge-sync apply
```

## Demo

**Before** — 古いバッジやリンク切れのある一般的なREADME：

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

**After** — `badge-sync apply` 実行後：

```md
<!-- BADGES:START -->
[![npm version](https://img.shields.io/npm/v/my-tool)](https://www.npmjs.com/package/my-tool)
[![node version](https://img.shields.io/node/v/my-tool)](https://nodejs.org)
[![ci workflow](https://github.com/my-org/my-tool/actions/workflows/ci.yml/badge.svg)](https://github.com/my-org/my-tool/actions/workflows/ci.yml)
[![license](https://img.shields.io/github/license/my-org/my-tool)](https://github.com/my-org/my-tool/blob/main/LICENSE)
<!-- BADGES:END -->
```

正しい名称、正しいURL、正しい並び順。手作業は一切不要です。

## Philosophy

> バッジはシンプルなシグナルであるべきであり、メンテナンスの負担になってはいけません。

badge-syncは、保守的な設計を指針としています：

- **Zero-config** — 設定なしで `badge-sync apply` を実行するだけで動作します。
- **Deterministic** — 同じリポジトリの状態であれば、常に同じバッジを生成します。
- **Conservative** — ユーザーが追加したバッジを削除することはせず、古くなったもののみを更新します。
- **Offline-first** — `apply` と `check` は、ネットワーク接続なしで動作します。
- **Safe** — `<!-- BADGES:START -->` / `<!-- BADGES:END -->` マーカーの内側のコンテンツのみを変更します。

## Installation

```bash
npm install -g badge-sync
```

または直接実行：

```bash
npx badge-sync apply
```

## Usage

```bash
badge-sync init          # マーカーを設置し、バッジを検出します。
badge-sync apply         # バッジを生成し適用します。
badge-sync check         # バッジがリポジトリの状態と一致するか検証します (CI用)。
badge-sync doctor        # 壊れたバッジや一貫性のないバッジを検出します。
badge-sync repair        # バッジの問題を自動的に修復します。
```

## Supported Ecosystems

| Ecosystem              | Metadata Source                        | Badges Generated                  |
| ---------------------- | -------------------------------------- | --------------------------------- |
| JavaScript / TypeScript | `package.json`                        | npm version, Node version         |
| Python                 | `pyproject.toml` / `requirements.txt`  | PyPI version, Python version      |
| Rust                   | `Cargo.toml`                           | crates.io version                 |

自動的に検出される追加バッジ：

- **CI** — GitHub Actions のワークフロー実行ステータス
- **License** — `LICENSE` ファイルから抽出
- **Stars** — GitHub のリモートリポジトリ情報から抽出

## Configuration

badge-syncは、設定なしでも十分に動作します。すべてのバッジはリポジトリのファイルから自動的に検出されます。

バッジの並び順をカスタマイズしたり、特定のバッジを除外したりする場合は、設定ファイルを作成してください：

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

設定の優先順位：ユーザー設定 > プロジェクトプリセット > デフォルトの順序。

対応している設定ファイル： `badgesync.config.json`, `badgesync.config.yaml`, `badgesync.config.yml`

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

オプション使用例：

```yaml
- uses: yeongseon/badge-sync@main
  with:
    command: apply
    readme: docs/README.md
    dry-run: true
```

`badge-sync check` は、バッジの状態が一致しない場合に終了コード `1` を返し、パイプラインを失敗させます。

## Roadmap

- [x] 主要なバッジの検出と生成
- [x] `apply`, `check`, `doctor`, `repair` コマンド
- [ ] 追加のエコシステム (Go, Java)
- [x] カバレッジバッジの検出
- [x] GitHub Action での配布
- [x] 対話型の CLI セットアップ
- [x] モノリポジトリ対応

## Documentation

- [Product Requirements](PRD.md)
- [Architecture](ARCH.md)
- [Design Principles](DESIGN.md)
- [CLI Specification](docs/CLI.md)
- [Agent Instructions](AGENTS.md)

## License

MIT
