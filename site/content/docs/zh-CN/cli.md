---
title: 命令行
summary: spec.jev 的命令、会话里的斜杠命令，以及原样来自 pi 的部分。
---

`spec.jev` 命令就是加载了 spec.jev 判定内核的 pi（一个编码代理）。pi 能做的一切照常可用；spec.jev 在此之上加了自己的命令和判定点。

```bash
npm i -g spec.jev      # 需要 Node.js 22.19 或更新
spec.jev                     # 在当前目录开一个交互会话
```

## 启动 spec.jev {#starting}

| 命令 | 做什么 |
| --- | --- |
| `spec.jev` | 在当前目录开一个交互会话 |
| `spec.jev "prompt"` | 交互会话，以这条提示开始 |
| `spec.jev -p "prompt"` | 一次性：打印回答后退出 |
| `spec.jev -c` | 接着上一个会话 |
| `spec.jev -r` | 选一个会话恢复 |
| `spec.jev --help` | 代理的全部参数 |

`spec.jev install`、`remove`、`update`、`list` 和 `config` 管理 pi 的包，和 pi 里一样。

## spec.jev 自己的命令 {#commands}

| 命令 | 做什么 |
| --- | --- |
| `spec.jev setup` | 接入一个模型（一个 API key，或从列表里选一个服务），并选择判定器。`spec.jev setup --help` 列出脚本用的形式。 |
| `spec.jev doctor` | 检查安装、模型、判定器和各项连接，并告诉你要修什么 |
| `spec.jev ledger [n] [--json]` | 最近 n 个会话里判定器做了哪些决定。`--json` 给出每条记录及其概率和耗时。 |
| `spec.jev import --list` | 找出你的 Claude Code 和 Codex 对话 |
| `spec.jev import <file>…` | 把它们导入 spec.jev，在这里接着聊 |
| `spec.jev judge setup \| start \| stop \| status` | 本地判定器 Laya。`setup` 下载模型前会先问你。 |
| `spec.jev link` / `spec.jev unlink` | 把 `spec.jev` 命令放进 PATH（`~/.local/bin`），或移除 |
| `spec.jev auth status \| login <provider> \| logout <provider>` | 订阅登录，和桌面端用的一样 |
| `spec.jev migrate [--dry-run]` | 一次性：把改名前的主目录 `~/.spec.jev` 搬到 `~/.spec.jev` |

## 会话里的命令 {#slash-commands}

| 命令 | 做什么 |
| --- | --- |
| `/status` | 判定器、各判定点的模式、没放进上下文的内容、最近的判定 |
| `/mu judge <judges>` | 由哪些判定器回答、按什么顺序：`laya`、`laya,jev`、`jev-opencode-free`、`classifier:<provider>/<model>`、`llm:<provider>/<model>` |
| `/mu route <point> <judges>` | 让某一个判定点用自己的判定器 |
| `/mu mode <point> <off\|shadow\|active>` | 在这个会话里切换某一个判定点，或用 `default` 切换全部 |
| `/frame` | 任务帧：目标、你的约束及你在哪里说的、验收条件 |
| `/goal <condition>` | 一直干到条件成立；`/goal clear` 结束 |
| `/permissions` | 完全访问、Jev 审批或最小权限 |
| `/board` | 为这个项目打开或关闭人话看板；`/board model` 选择写看板的模型 |
| `/remember <text>`、`/lessons`、`/forget <id>` | 记一条经验、列出经验、让一条退役 |
| `/review`、`/commit` | 评审改动，发现按 P0 到 P3 分级；把改动拆成多个提交 |
| `/checkpoints`、`/rewind` | 列出检查点；退回到某一个（`/rewind undo` 撤销这次回退） |
| `/agents`、`/swarm` | 委派给子代理；看每一个在做什么 |
| `/hive <question>` | 就一个难题发起蜂群 |
| `/browse`、`/jobs` | 内置浏览器；后台命令 |
| `/capabilities`、`/ledger` | 装了哪些能力、打开了哪些；最近的判定 |
| `/inherit` | 从 Claude Code、Cursor 和 Codex 沿用了什么，没沿用什么 |
| `/import-chat` | 导入 Claude Code 或 Codex 的对话 |
| `/doctor` | 检查配置和连接 |

pi 自己的命令原样保留：`/model`、`/thinking`、`/login`、`/resume`、`/tree`、`/fork`、`/compact`、`/export`、`/mcp` 等等。

## 判定行 {#verdict-line}

一轮开始之前，spec.jev 会稍等一下判定器对你这条消息的判断，并把它显示在输入框上方，例如「◆ jev-1.13-free  multi-step task · full effort · 699 ms」。按 <kbd>Esc</kbd> 可以不等它直接开始。状态栏显示权限模式；有目标在运行时，也显示这个目标。

## 只对一次运行生效的环境变量 {#env}

| 变量 | 效果 |
| --- | --- |
| `SPECJEV_JUDGE=laya,jev spec.jev` | 只为这次运行指定判定器。`SPECJEV_JUDGE=off` 关掉判定内核。 |
| `SPECJEV_JUDGE_MODE=shadow spec.jev` | 这次运行里所有判定点都用影子模式 |
| `MU_PERMISSIONS=ask spec.jev` | 这次运行的权限模式：`full`、`jev` 或 `ask` |
| `SPECJEV_LANG=zh-CN spec.jev` | spec.jev 自己的消息用中文（`zh`）或英文（其他任何值） |

完整列表见[配置](@docs/configuration#env)。
