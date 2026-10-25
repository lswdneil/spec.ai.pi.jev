---
title: 快速开始
summary: 安装桌面端或命令行，接一个模型，跑第一个任务。
---

spec.jev 有两种用法：自带所需一切的**桌面端**，和 **`spec.jev` 命令行**。两者共用账号、设置、会话和经验，在一边开始的任务可以到另一边接着做。

## 桌面端 {#desktop-app}

1. 从 [Releases](https://github.com/lswdneil/spec.ai.pi.jev/releases/latest) 下载适合你系统的安装包，或者去[首页](@home#install)，它会替你选好系统。

   | 系统 | 文件 |
   | --- | --- |
   | macOS，Apple 芯片 | `spec.jev-<version>-mac-arm64.dmg` |
   | macOS，Intel | `spec.jev-<version>-mac-x64.dmg` |
   | Windows x64 / Arm | `spec.jev-<version>-win-x64.exe` / `spec.jev-<version>-win-arm64.exe` |
   | Linux x64 / Arm（Debian、Ubuntu） | `spec.jev-<version>-linux-amd64.deb` / `spec.jev-<version>-linux-arm64.deb` |

   发布页上的 `SHA256SUMS` 列出每个文件的校验和。macOS 版已签名，并经过 Apple 公证。Windows 版还没有代码签名，所以第一次运行时 SmartScreen 会警告：选**更多信息**，再选**仍要运行**。
2. 打开它。新手引导分四步：模型、权限模式、判定器、开始。
   - **模型。** 粘贴一个 API key，spec.jev 会从格式认出是哪家服务（DeepSeek、Kimi、Qwen、GLM、SiliconFlow、OpenRouter、OpenAI、Anthropic、Google Gemini、xAI 等），并用一次请求检查它。也可以用 ChatGPT、Claude、Grok 或 Google 订阅登录。密钥不对、余额为零、地区不支持或连不上网，每一种都会说明该怎么办。
   - **权限。** 默认选中「Jev 审批」；见[权限与安全](@docs/permissions)。
   - **判定器。** 没有密钥时，由免费的 Jev 回答。之后随时可以回来改。
   - **开始。** 如果 spec.jev 找到 Claude Code 或 Codex 的对话，会提出帮你导入。
3. 选一个文件夹，开始对话。

其他什么都不用装：不用 Node.js，第一次启动也不下载任何东西。有新版本时，桌面端会告诉你版本号和大小，你同意后才下载，重启时安装。

## 命令行 {#command-line}

```bash
npm i -g spec.jev      # Node.js 22.19 或更新
spec.jev setup               # 接入一个模型，选择判定器
spec.jev                     # 在当前目录开一个会话
```

`spec.jev setup` 一步步问你，中文或英文都行。如果跳过它，第一次在没有模型的情况下运行 `spec.jev` 时，会问一次要不要现在设置。写脚本时，`spec.jev setup --help` 列出非交互的用法；密钥从标准输入读取，从不写在命令行上。

可以试试这些：

| 命令 | 做什么 |
| --- | --- |
| `spec.jev "fix the failing test in src/pager.test.ts"` | 带着一条提示开始 |
| `spec.jev -p "summarize this repository"` | 回答一次就退出 |
| `spec.jev -c` / `spec.jev -r` | 接着上一个会话 / 选一个会话恢复 |
| `spec.jev import --list` | 找出可以导入的 Claude Code 和 Codex 对话 |
| `spec.jev doctor` | 检查安装、判定器和各项连接 |
| `spec.jev ledger 3` | 最近三个会话里判定器做了哪些决定 |

在会话里，`/status` 显示判定器、各判定点的模式和最近的判定，`/help` 列出所有命令。完整列表见[命令行](@docs/cli)页。

## 你的第一个任务 {#first-task}

打开一个项目文件夹，用你自己的话说要做什么。接下来会这样：

1. **Jev 先读你的消息**，显示一行判定，比如「多步任务 · 全力投入」。用时远不到一秒；按 <kbd>Esc</kbd> 跳过。
2. **模型开始干活。** 长工具输出先过滤再交给模型；在「Jev 审批」模式下，项目之外的命令要等批准。
3. **它说做完时**，spec.jev 检查有没有东西验证过这份工作，没有就提醒一次。

想让它一直做到某个条件成立，用[目标模式](@docs/goal)：`/goal all tests in packages/api pass`。

## 判定器 {#judge}

spec.jev 把一次会话里的例行问题交给一个小而快的判定器。你不需要专门设置：没有 Jev 密钥时，由 OpenCode Zen 上免费的 Jev 回答，spec.jev 每天提示一次。要用自己的密钥、本地判定器或别的模型，见[判定器](@docs/judges)。

{points} 个判定点里有 {points_active} 个从一开始就按判定结果行事（`context.compact` 和 `output.drift` 默认关闭），每次判定都会记录下来：`/status`、`spec.jev ledger`，或桌面端的「判定」页。想先观察判定器、再决定信不信它，就把判定点设成影子模式：照常提问并记录，但不改变任何东西。

```json
{ "modes": { "default": "shadow" } }
```

这一行写在 `~/.spec.jev/agent/spec.jev.json` 里；`/mu mode default shadow` 效果相同，但只对当前会话有效。

## 文件放在哪里 {#files}

| 路径 | 内容 |
| --- | --- |
| `~/.spec.jev/agent/spec.jev.json` | spec.jev 的设置：判定器、模式、功能 |
| `~/.spec.jev/agent/auth.json`、`models.json`、`settings.json` | pi 的登录、提供商和偏好设置 |
| `~/.spec.jev/agent/sessions/` | 会话，桌面端和命令行共用 |
| `~/.spec.jev/agent/mu/lessons.jsonl` | 经验库 |
| `~/.spec.jev/agent/mu/permissions.json` | 你上次选的权限模式 |
| `~/.spec.jev/backups/` | `spec.jev setup` 改动文件之前做的备份 |

在 Windows 上，`~` 是你的用户文件夹（`%USERPROFILE%`）。
