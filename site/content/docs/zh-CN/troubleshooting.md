---
title: 排错
summary: spec.jev 启动不了、连不上模型，或者判定器好像什么都没做时，该检查什么。
---

先运行 `spec.jev doctor`，或在会话里用 `/doctor`：它检查安装、模型、判定器和各项连接，并告诉你要修什么。在桌面端，日志在「设置 → 关于」里，点一下就能打开。

如果这些都没用，请[提一个 issue](https://github.com/lswdneil/spec.ai.pi.jev/issues/new/choose)，附上版本、平台和 `spec.jev doctor` 的输出。

## 安装和启动 {#install}

**`spec.jev needs Node >= 22.19 (found v20…)`。** 命令行需要 Node.js 22.19 或更新：`nvm install 24`，或者用你系统的包。桌面端自带 Node.js，什么都不需要装。

**Windows 显示 SmartScreen 警告。** Windows 版还没有代码签名。选**更多信息**，再选**仍要运行**。每个下载文件的校验和都在发布页的 `SHA256SUMS` 里。

**Windows：对话里说缺少 Git for Windows。** spec.jev 在 Windows 上用 POSIX shell 运行命令。装上 [Git for Windows](https://git-scm.com/download/win)，再开一个新对话。

**装在 `C:\Program Files\spec.jev` 里的应用启动不了 spec.jev。** 已在 0.1.5 修复：把最新版本装在旧版本上面即可；你的数据会保留。

**`spec.jev install`、`spec.jev list` 或 `spec.jev config` 反而开了一个会话。** 已在 spec.jev 0.1.8 和桌面端 0.1.7 修复，更新到最新版本即可。

## 模型和网络 {#models}

**没有设置模型。** 运行 `spec.jev setup`，或者用桌面端的新手引导：粘贴一个 API key，或者用订阅登录。

**桌面端里出现「User location is not supported」或请求超时，终端里却正常。** 模型的服务拒绝了你所在网络的地区，或者桌面端没看到你的网络代理。从 0.1.5 起，没有设置 `HTTPS_PROXY` 时，桌面端会跟随系统代理；检查代理是否打开，或者为 spec.jev 设置 `HTTPS_PROXY`。

## 判定器 {#judge}

**判定器好像什么都没做。** 处于影子模式的判定点只记录判定，不改变任何东西；关闭的判定点根本不问。`/status` 显示每个判定点的模式；看看 `~/.spec.jev/agent/spec.jev.json` 里有没有 `"default": "shadow"` 或 `"off"`，或者你的环境里有没有 `SPECJEV_JUDGE_MODE`。

**「还没有可用的判定器，所以每一步都先问你。」** 在「Jev 审批」模式下，没有判定器能回答时，spec.jev 会对每一个需要审批的步骤都问你：没有密钥且免费的 Jev 不可用、账户额度用完，或者只有一个本地判定器，而本地判定器不被信任来审批。设置一个 Jev 密钥（`spec.jev setup`），或者用 `/permissions` 切换模式。

**免费的 Jev 不再回答了。** 它是 OpenCode Zen 的限时活动，结束时 spec.jev 会告诉你。为某个 [Jev 服务](@docs/judges#jev)设置密钥，或者选另一个判定器。

**判定很慢。** 每个判定点都有时限，超时后 spec.jev 不等判定继续往下；不会有什么卡很久。`spec.jev ledger --json` 显示每次判定的延迟。慢的或远的判定器可以用 `routes` 按判定点替换。

**本地判定器要下载模型。** Laya 的模型约 930 MB；只有你同意后，spec.jev 才会在 `spec.jev judge setup` 里或桌面端里下载它。

## 终端 {#terminal}

**子代理启动时，终端界面崩溃并报「Rendered line … exceeds terminal width」。** 已在 spec.jev 0.1.8 和桌面端 0.1.7 修复，更新到最新版本即可。

## 从头开始 {#reset}

`spec.jev setup` 会先把它要改的每个文件复制到 `~/.spec.jev/backups/<time>/`。要重置 spec.jev 自己的设置，把 `~/.spec.jev/agent/spec.jev.json` 移走；spec.jev 会用默认值启动。会话、登录和经验是单独的文件，都会保留。
