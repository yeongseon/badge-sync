# badge-sync

<!-- BADGES:START -->
[![npm version](https://img.shields.io/npm/v/badge-sync)](https://www.npmjs.com/package/badge-sync)
<!-- BADGES:END -->

其他语言: [English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md)

让您的 README 徽章保持整洁、有效且一致。

> **Status**: 处于早期阶段。核心流程可以正常运行，但在处理现实中的边缘情况时可能需要修复。

## Problem

README 徽章在开源项目中被广泛使用。

但在实践中，许多代码仓经常会出现以下问题：

- 重命名代码仓或工作流后，徽章链接失效
- CI 徽章指向已经过时的服务
- 从其他项目中复制而来的错误代码仓引用
- 各个代码仓之间的徽章排序不一致

维护这些徽章往往需要繁琐的手动操作，且极易出错。

## Solution

badge-sync 是一个轻量级的 CLI 工具，旨在帮助您维护 README 徽章。

它可以自动完成以下任务：

- 检测与您的代码仓相关的徽章
- 验证徽章链接的有效性
- 修复失效的徽章引用
- 保持徽章排序的一致性

```bash
npx badge-sync apply
```

## Demo

**Before** —— 带有过时且失效徽章的典型 README：

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

**After** —— 执行 `badge-sync apply` 后：

```md
<!-- BADGES:START -->
[![npm version](https://img.shields.io/npm/v/my-tool)](https://www.npmjs.com/package/my-tool)
[![node version](https://img.shields.io/node/v/my-tool)](https://nodejs.org)
[![ci workflow](https://github.com/my-org/my-tool/actions/workflows/ci.yml/badge.svg)](https://github.com/my-org/my-tool/actions/workflows/ci.yml)
[![license](https://img.shields.io/github/license/my-org/my-tool)](https://github.com/my-org/my-tool/blob/main/LICENSE)
<!-- BADGES:END -->
```

正确的名称，正确的 URL，正确的排序。无需任何手动操作。

## Philosophy

> 徽章应当是简洁的信号，而不应成为维护的负担。

badge-sync 遵循保守的设计原则：

- **零配置** —— 运行 `badge-sync apply` 即可工作
- **确定性** —— 同一份代码仓状态总是会生成相同的徽章
- **保守性** —— 从不删除您手动添加的徽章，仅更新过时的部分
- **离线优先** —— `apply` 和 `check` 命令无需网络连接即可运行
- **安全性** —— 仅修改 `<!-- BADGES:START -->` / `<!-- BADGES:END -->` 标记内的内容

## Installation

```bash
npm install -g badge-sync
```

或者直接运行：

```bash
npx badge-sync apply
```

## Usage

```bash
badge-sync init          # 设置标记并检测徽章
badge-sync apply         # 生成并应用徽章
badge-sync check         # 验证徽章是否与代码仓状态匹配 (适用于 CI)
badge-sync doctor        # 检测失效或不一致的徽章
badge-sync repair        # 自动修复徽章问题
```

## Supported Ecosystems

| Ecosystem              | Metadata Source                        | Badges Generated                  |
| ---------------------- | -------------------------------------- | --------------------------------- |
| JavaScript / TypeScript | `package.json`                        | npm version, Node version         |
| Python                 | `pyproject.toml` / `requirements.txt`  | PyPI version, Python version      |
| Rust                   | `Cargo.toml`                           | crates.io version                 |

会自动检测的其他徽章：

- **CI** —— GitHub Actions 工作流状态
- **License** —— 从 `LICENSE` 文件中提取
- **Stars** —— 从 GitHub 远程信息中提取

## Configuration

badge-sync 支持零配置运行。所有徽章均从代码仓文件中自动检测。

如果需要自定义徽章顺序或排除特定的徽章，请创建配置文件：

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

配置优先级：用户配置 > 项目预设 > 默认排序。

支持的配置文件： `badgesync.config.json`, `badgesync.config.yaml`, `badgesync.config.yml`

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

带有选项的用法：

```yaml
- uses: yeongseon/badge-sync@main
  with:
    command: apply
    readme: docs/README.md
    dry-run: true
```

如果徽章不同步，`badge-sync check` 将以退出码 `1` 结束，从而导致流水线失败。

## Roadmap

- [x] 核心徽章检测与生成
- [x] `apply`、`check`、`doctor`、`repair` 命令
- [ ] 更多生态支持 (Go, Java)
- [x] 覆盖率徽章检测
- [x] GitHub Action 发布
- [x] 交互式 CLI 设置
- [x] Monorepo 支持

## Documentation

- [Product Requirements](PRD.md)
- [Architecture](ARCH.md)
- [Design Principles](DESIGN.md)
- [CLI Specification](docs/CLI.md)
- [Agent Instructions](AGENTS.md)

## License

MIT
