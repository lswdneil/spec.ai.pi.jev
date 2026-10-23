# 从 MU/AionUi 到 spec.jev：重平台化手册

> 适用场景：接手一个成熟但品牌、UI 或技术栈不再合适的上游 fork；需要在**不重写业务逻辑**的前提下，换品牌、换设计系统、换组件实现，并建立能长期防回归的工程约束。
>
> 本文记录的是 spec.jev 这次真实的迁移，不是通用理论。数字和文件名都来自当前仓库。
>
> 配套技能：`legacy-product-replatform`（含通用检查表、测试矩阵和故障目录）。

## 0. 先记住十件事

1. **先盘点，再动页面。** 不知道哪些该换、哪些该留，最后一定重写过头。
2. **上游要分层看。** spec.jev 的 agent 核心来自 pi，桌面壳来自 AionUi；把两者混成一个“上游”会误判风险。
3. **先定视觉合同，再写组件。** 没有定版参照，每个人都会按自己的审美修。
4. **token 是唯一尺寸/颜色来源。** 业务代码里不应再出现裸 hex、裸 `font-family`、裸图标尺寸。
5. **兼容层比批量改调用点便宜。** 先让旧 props 继续工作，再逐层换实现。
6. **保留领域逻辑。** 消息渲染、工具调用、diff、Monaco、浏览器、i18n、IPC、会话存储，不是这次要重写的东西。
7. **新旧 UI 可以并存，但必须有退出计划。** 否则 `?ui=v1` 会永久留在产品里。
8. **每迁移一批，就扩一批防回归。** 只改代码不加 guard，下一轮还会长回来。
9. **视觉回归要跑真实 runtime。** 静态 HTML 截图不能证明 Electron/WebUI 真的按 token 渲染。
10. **测试替身不能代替产品路径。** 为了启动而 stub 的 bridge，必须当成产品缺口记录，不能当成“已支持”。

---

## 1. 这次迁移到底是什么

### 1.1 两个上游

| 层 | 来源 | 说明 |
| --- | --- | --- |
| Agent 核心 | pi `1.3.0` | `packages/coding-agent`、`packages/ai` 是 `@earendil-works/pi-*` 1.3.0 |
| 判定内核 | kYRN / JEV | `packages/kyrn-judge`，作为 pi extension 加载 |
| 桌面壳 | AionUi fork | `desktop/` 是 Electron 应用，`desktop/AIONUI-FILES.txt` 记录来源文件 |
| 本地后端 | AionCore | 独立 Rust 服务，原 AionUi backend，当前打包版本 `v0.2.2` |
| 产品名 | MU → spec.jev | `MU_*`、`@mu/desktop`、`kyrn/bin/mu.mjs` 是旧/内部命名 |

### 1.2 规模

迁移开始时 renderer 的盘点：

- 887 个 `.ts/.tsx/.css` 文件
- 217 个文件导入 `@arco-design/web-react`
- 37 个 CSS Modules
- `pages/conversation` 285 个文件
- `pages/settings` 99 个文件

最终：

- renderer 的 Arco import：**0**
- `@arco-design` 依赖：已移除
- 全量单测：**6761 passed / 0 failed / 116 skipped**（迁移收口时）
- 视觉 E2E：4 个通过
- 旧 MU shell：**仍保留为 `?ui=v1` 回退**，尚未彻底删除

### 1.3 关键判断

这次不是“把旧页面全部重写”，而是：

> **换壳、换原语、换 token；保留消息/工具/编辑器/浏览器等真正的产品能力。**

`INVENTORY.md` 把表面分成 Replace / Keep / Restyle，是整次迁移最重要的前置文档之一。

---

## 2. 阶段 0：先建立事实

### 2.1 UI 盘点

至少产出四张表：

1. **文件规模表**：按页面/组件目录统计。
2. **组件使用表**：每个旧库组件用了多少处。
3. **表面决策表**：Replace / Keep / Restyle。
4. **迁移波次表**：shell → chrome → settings → edge。

spec.jev 的结论：

- App shell、欢迎页、会话 chrome、设置导航：**Replace**
- 消息/工具/diff/Monaco/浏览器/i18n：**Keep**
- 设置表单、cron、team、guid、native 控件：**Restyle + 换原语**

### 2.2 视觉合同

先有定版参照，再写组件：

- `design/archive/phase-0-dense/dense-confirmed.html`
- `design/archive/phase-0-dense/shots/`
- `design/DESIGN.md`
- `design/tokens.json`
- `design/tokens.css`

规则要写到可以验收，例如：

- 扁平表面、1px matte border、无阴影
- 一个普通 UI 主色；Jev 粉/紫只用于判定系统
- 13px UI、20px 页面标题；monospace 只给代码/标识/时间
- 208px sidebar、48px folded rail、40px topbar、300px judge rail
- 只有 Dark / Light / Auto

没有这一步，后面每个页面都会出现“这里也改一下”的局部审美。

### 2.3 上游与许可证

- pi：MIT
- AionUi：Apache 2.0；保留 `NOTICE`、`AIONUI-FILES.txt`、文件头
- AionCore：独立程序，保留其协议名/数据库名/环境变量
- 旧名称映射集中管理：`desktop/docs/contributing/upstream-names.md`

**原则：**

> 产品文案、类名、事件、storage key 可以改成 spec.jev；外部程序真正读取的协议名不要乱改。

---

## 3. 阶段 1：tokens 和原语

### 3.1 token 分层

`styles/specjev/tokens.css` 负责：

- 颜色：`--sv-bg`、`--sv-surface`、`--sv-text`、`--sv-brand`、`--sv-focus`、`--sv-line`
- 字体：`--sv-font-ui`、`--sv-font-mono`、`--sv-fs-*`
- 圆角：`--sv-r-*`
- 布局：`--sv-sidebar`、`--sv-topbar`、`--sv-rail`
- 动效：`--sv-t-*`、`--sv-ease`
- 图标：`--sv-icon-xs/sm/md/lg/xl/sider/titlebar`

### 3.2 主题优先级

旧主题有大量 `[data-theme]`、`[data-color-scheme]`、Arco 变量覆盖。Dense token 必须用足够明确的选择器，例如：

```css
html[data-sv-ui="dense"][data-theme="dark"] { ... }
html[data-sv-ui="dense"][data-theme="light"] { ... }
```

否则旧 MU 的粉色/紫色会盖掉 Dense 的 sage。这个坑在 `HARDCODING-AUDIT.md` 中有记录。

### 3.3 原语层

`renderer/ui/` 只承载：

- Button / Input / Select / Dialog / Tooltip / Dropdown / Tabs / Switch / Checkbox / Radio / Tag / Alert / Spinner / Empty / Card / Steps / Form / toast

要求：

- 新页面不再直接 import 旧组件库
- wrapper 的 props 尽量保留旧调用点习惯（`type`、`size`、`status`、`visible`、`onCancel`、`content`、`position`）
- wrapper 内部只用 token + Tailwind
- 复杂组件（Table/Tree/DatePicker/Upload）按需单独替换，不强行一次替换

这就是为什么 217 个 Arco 文件不需要 217 次页面重写。

### 3.4 默认切换与回退

默认 Dense，旧 shell 留一个 flag：

```text
?ui=v1  -> 旧 shell
?ui=v2  -> 清除选择，回到 Dense
```

**教训：** flag 是迁移工具，不是长期产品功能。必须在迁移完成后安排退出，否则旧 UI、旧 CSS、旧 class 会永久存在。当前 spec.jev 的退出计划记录在 `design/PENDING.md`。

---

## 4. 阶段 2：移除 Arco

### 4.1 顺序

1. 先建兼容层，让旧 props 继续编译。
2. 替换 Top 10：Button、Message、Tooltip、Input、Modal、Spin、Dropdown/Menu、Tag、Switch、Alert。
3. 替换 shell 和 Appearance。
4. 替换 settings forms。
5. 替换复杂组件：Table、Tree、DatePicker、Upload、InputNumber。
6. 移除依赖、CSS、locale、adapter、chunk 配置。
7. 加 `noArcoImports` guard。
8. 最后才清理兼容 class 和旧 CSS。

### 4.2 兼容层不是永久层

Arco 已经不在 `package.json`，但代码里仍有：

- `arco-btn`
- `arco-select`
- `arco-tag`
- `arco-dropdown-menu`
- `arco-spin`
- `MuModal`
- `legacy-overrides.css`
- `mu-scales.css`
- `mu-shell.css`

**不要混淆：**

> “没有 Arco 依赖” ≠ “没有 Arco 兼容层”。

### 4.3 原生控件重置

迁移后最容易漏的是原生 `<button>` 的白底：

- Select trigger / option
- Menu / Dropdown
- Tree node
- Radio 分段
- Switch
- Collapse header
- Dialog close
- Image preview close
- Input clear / InputTag remove
- Pagination
- Popconfirm cancel
- Tabs trigger
- Tag close

每个都要显式 `bg-transparent` / token 背景 / focus 样式。`UI-CONFORMANCE-CHECKLIST.md` 有逐项记录。

---

## 5. 阶段 3：UI 规范化

### 5.1 字体

- UI 正文、标题、标签、空状态：`--sv-font-ui`
- 代码、ID、时间、命令：`--sv-font-mono`
- 不再在业务组件里写 `font-family`
- 中英文混排统一走 UI 字体

### 5.2 颜色

- 普通 UI：sage `--sv-brand`
- Jev 判定系统：粉色/紫色 `--sv-jev-pink` / `--sv-jev-violet`
- 不把 Jev 粉/紫扩散到普通按钮、普通 focus、普通标签
- 主题切换后，状态点/标签的颜色必须跟着 token 走

### 5.3 图标

五档：

```text
xs 12 / sm 14 / md 16 / lg 18 / xl 20
```

任务栏/标题栏：

```text
--sv-icon-sider: 18
--sv-icon-titlebar: 18
```

规则：

- 业务代码不写 `size={14}` / `h-4 w-4`
- icon-park wrapper 的 className 要能作用到子 SVG：
  ```css
  .sv-icon-sm, .sv-icon-sm > svg { width: var(--sv-icon-sm); height: var(--sv-icon-sm); }
  ```
- 自定义 SVG 组件要接受 `className`，不要自己写 width/height
- 非图标尺寸不要硬塞进 icon scale：头像、ProviderMark、MuMark、Spinner、24/28px 插图、Cron 状态复合标记、checkbox/radio/slider 控件外框

### 5.4 焦点与交互

- 输入框/设置搜索：细描边，不加 ring/紫色 accent bar
- 命令面板关闭后：焦点回到触发点，焦点样式为 inset sage hairline
- 菜单/Select/Tree：hover/selected 统一 2px 行首 brand bar
- hover dropdown：80ms 打开、180ms 关闭宽限；菜单内容接管 hover，解决触发器与菜单间隙闪动
- z-index：欢迎页 popover 要在 screen 之上

### 5.5 硬编码审计

`themeTokens.test.ts` 检查：

- 裸 hex / rgb / rgba
- 字面量 font-family
- 图标尺寸

允许例外必须写清楚：

- token 源文件
- 主题预览 swatches
- 用户自定义主题
- 品牌 logo
- 语法高亮
- OS 窗口控制
- 透明的功能 mask
- 外部页面 inspector
- Demo 页面

---

## 6. 阶段 4：内容区图标迁移

不要一次全改。按 UI 区域分批：

1. shell / taskbar / titlebar
2. composer / SendBox
3. Markdown
4. conversation message surface
5. settings
6. preview / media / source control
7. native / cron / platforms
8. base components / explorer / one-off panels
9. chat chrome / UI primitives

每批流程：

1. 扫描目录里的 `size={..}`、`size='..'`、`h-3`、`h-3.5`、`h-4`、`h-5`
2. 区分图标 vs 控件/头像/插图
3. 替换为 `sv-icon-*`
4. 保留已有 utility class（`block`、`shrink-0`、`rtl-mirror`、`line-height-0`）
5. 运行 focused tests
6. 扩展 `iconTokens.test.ts` 扫描范围
7. 提交

**坑：**

- 同一个 JSX 元素可能已有 `className`，不要写出两个 `className`
- 15px/13px/10px 这种非标准值要按最近档归一，但要想清楚视觉影响
- 不要把 `checkbox` 的 16px 方框、radio 圆点、slider thumb 当成图标
- `CronJobIndicator` 这种复合状态标记有红点尺寸计算，不要只换外层 class
- 大插图（24/28）不要为了“扫干净”强行缩到 20

---

## 7. 阶段 5：测试与验证

### 7.1 验证阶梯

每次改动按成本从低到高：

```bash
bunx tsc --noEmit
bun run lint
bunx vitest run <focused tests>
bun run package
bunx vitest run --testTimeout=30000 --hookTimeout=30000
E2E_DEV=1 bun run test:visual
```

提交前至少要有：

- 类型检查
- lint
- 相关 focused tests
- 全量单测
- 打包
- 视觉 E2E（如果改了 UI）

### 7.2 单元/DOM 测试

适合：

- token 值、class 映射
- 图标尺寸 guard
- 禁用 Arco import
- web catalog provider
- hover dropdown 行为
- 原生控件表面
- 主题选择
- 旧 storage key 迁移

spec.jev 的 guard 例子：

- `tests/unit/renderer/iconTokens.test.ts`
- `tests/unit/renderer/themeTokens.test.ts`
- `tests/unit/renderer/noArcoImports.test.ts`
- `tests/unit/renderer/dropdownHover.dom.test.tsx`
- `tests/unit/renderer/nativeButtonSurfaces.test.ts`
- `tests/unit/renderer/kyrnWebCatalog.dom.test.ts`

### 7.3 全量测试的坑

- 并行跑全量 + 打包/DEV 时，DOM 测试可能因为资源竞争出现随机 timeout
- 先单独重跑失败的 8 个文件；如果全过，不要把它当代码回归
- 不要为了“通过”把 timeout 降到 5s；应先隔离负载
- 全量失败时看失败类型：`Test timed out` / `Hook timed out` / `worker` 启动失败，和断言失败不是一类问题

### 7.4 视觉 E2E

spec.jev 的做法：

- 启动真实 Electron 应用
- 跳过 onboarding
- 固定 viewport
- 深/浅主题
- 测量 `.sv-icon-*` 的 computed width/height
- 截图：home、command palette、collapsed rail、settings、narrow desktop
- 真实会话：注入 file-change / failed-tool 卡片，打开 work panel，聚焦 judge context toggle
- 手机：Chrome + web-host 静态服务，390×844，`isMobile`、`hasTouch`

截图输出在 Playwright test output，不提交二进制 baseline；先做“运行时断言 + 人工审图”，比维护像素 baseline 更稳。

### 7.5 WebUI/手机专项

- Electron 中 `isElectronDesktop()` 为 true，窗口再窄也不会进入 phone layout
- 真手机布局必须在浏览器/WebUI 或真机验证
- WebUI 没有 Electron main 的 bridge；`kyrn.catalog` 需要 Web 实现
- 该实现应是**只读**的：读 `/api/agents/management` 和 `/api/assistants`，不注册/不关闭 agent
- 其他 KyRN provider 依赖本地文件、密钥或子进程，不要在浏览器里重写；让 WebUI 通过带 token 的 loopback KyRN host 调用桌面 main 的同一批 provider
- host 链接形如 `?kyrnHost=ws://127.0.0.1:<port>/<token>`；远程必须 `wss://` 并先设计配对、TLS、撤销
- 手机测试要用 web-host 静态服务 + 构建后的 `out/renderer`
- 测试里的启动 stub 只能当临时探针；一旦真实实现完成，立即删除 stub，否则测试会掩盖产品缺口

### 7.6 E2E 交互的坑

- 标题栏 drag overlay 会拦截点击：用 DOM `element.click()` 或 `click({ force: true })`
- 主题切换有 160ms 颜色过渡：断言前等 200–250ms，否则会读到旧色
- 截图前把鼠标移开、blur 当前元素，否则 tooltip 会留在截图中
- 工作面板 tab 是 `id="mu-work-panel-tab-judge"`，不是 `data-testid`
- `getByTestId` 可能匹配到屏幕外仍“可见”的 DOM；状态断言优先用 class / aria / scoped locator
- 打包产物可能落后于源码：手机/视觉测试跑 `out/renderer` 前先 `bun run package`；`out/win-unpacked` 需要重打包才会更新

---

## 8. 坑位清单

| # | 症状 | 根因 | 处理 |
| --- | --- | --- | --- |
| 1 | 以为删了 Arco 依赖就干净了 | 兼容 class、旧 CSS、旧 shell 还在 | 区分“依赖”与“兼容层”，列退出计划 |
| 2 | 新 UI 主题被旧粉色/紫色覆盖 | token 选择器优先级不够 | `html[data-sv-ui="dense"][data-theme]` |
| 3 | 原生按钮白底 | 新原语没重置浏览器默认样式 | 每个表面显式背景/focus |
| 4 | 输入框 focus 出现紫色竖条 | 旧 focus ring/Arco 残留 | 行内 1px sage hairline |
| 5 | 菜单跨触发器闪动 | hover 触发器与菜单之间有间隙 | 80ms open / 180ms close + 菜单接管 hover |
| 6 | icon-park 图标不遵守 class | className 只在外层 wrapper 上 | `.sv-icon-* > svg` 同时设置 |
| 7 | 某个文件出现两个 `className` | 批量替换时没保留原 class | 合并到同一个字符串 |
| 8 | 扫描把 checkbox 方框当图标 | 控件尺寸不是 icon scale | 显式排除非图标表面 |
| 9 | 全量测试随机 timeout | 并行/打包/DEV 资源竞争 | 单独重跑，隔离负载；看失败类型 |
| 10 | 主题颜色断言失败 | 颜色 transition 未结束 | 等 200–250ms |
| 11 | Electron 390px 不是手机布局 | `isElectronDesktop()` 强制 desktop | 用 Chrome + web-host/真机 |
| 12 | WebUI 卡启动页 | `kyrn.catalog` 没有 Web provider | 加只读 catalog provider |
| 13 | 手机测试一直绿但产品不可用 | 测试 stub 了 catalog | 完成真实 provider 后删 stub |
| 14 | E2E 点击被 drag div 拦截 | 标题栏 overlay | DOM click / force |
| 15 | 截图里有 tooltip | 鼠标/焦点还在触发点 | 移开鼠标 + blur + 等 |
| 16 | 工作面板 tab 找不到 | 用了 `data-testid`，实际是 `id` | 用 `#mu-work-panel-tab-judge` |
| 17 | 打包后仍是旧 UI | `out/win-unpacked` 未重打 | 重新打包，不只 build renderer |
| 18 | 把 `dnredson/aioncore` 当后端 | 同名 IoT 项目 | 用 `iOfficeAI/AionCore`，当前 v0.2.2 |
| 19 | `?ui=v1` 永远留着 | 没有退出计划 | 迁移完成前明确删除窗口 |
| 20 | 重写消息/Monaco/浏览器 | 把“换 UI”理解成“重写产品” | 先做 Keep/Restyle 盘点 |

---

## 9. 检查清单

### 9.1 项目启动

- [ ] 确认两个上游分别是什么
- [ ] 确认许可证和来源文件
- [ ] 盘点文件/组件/表面
- [ ] 产出 Replace / Keep / Restyle
- [ ] 选定视觉合同
- [ ] 建 token 源
- [ ] 建立新旧 UI 回退开关
- [ ] 定义删除回退的条件

### 9.2 每批 UI 迁移

- [ ] 只改这一批
- [ ] 保留领域逻辑
- [ ] 替换原语/尺寸/token
- [ ] 保留 utility class
- [ ] 跑 focused tests
- [ ] 扩 guard
- [ ] 截图/检查深色和浅色
- [ ] 本地提交

### 9.3 提交前

- [ ] `tsc`
- [ ] `lint`
- [ ] focused tests
- [ ] 全量单测
- [ ] `package`
- [ ] 视觉 E2E（UI 改动）
- [ ] `git diff --check`
- [ ] 只 stage 自己的文件

### 9.4 宣布“迁移完成”前

- [ ] 旧 UI flag 是否删除
- [ ] 旧 CSS / 旧 class / 旧组件是否清理
- [ ] 是否还有 stub 冒充产品能力
- [ ] WebUI/手机是否走真实 bridge
- [ ] 文档是否记录残余风险
- [ ] 全量测试和视觉测试是否干净

---

## 10. 证据索引

- `design/INVENTORY.md`：规模、组件计数、Replace/Keep/Restyle
- `design/ARCO-MIGRATION.md`：兼容层、映射表、移除顺序
- `design/UI-CONFORMANCE-CHECKLIST.md`：逐项视觉验收
- `design/HARDCODING-AUDIT.md`：硬编码边界和例外
- `design/P0-VISUAL-AUDIT.md`：P0 结论、18px 决策
- `design/P1-ICON-MIGRATION.md`：6 批内容图标迁移、视觉测试
- `design/PENDING.md`：旧 MU UI 彻底移除的待办
- `design/archive/phase-0-dense/`：定版视觉合同
- `desktop/docs/native-host.md`：AionCore/ACP 与 native host 链路
- `desktop/docs/contributing/upstream-names.md`：改名边界
- `docs/architecture.md`：pi + JEV + desktop 的分层
- `packages/shared-scripts/src/prepare-aioncore.js`：真正的 AionCore 来源

关键提交（示例）：

- `2e5bb15bd` Dense tokens / primitives / Appearance
- `ade6c7241` Dense shell and conversation surface
- `2dcd79776` remove Arco dependency
- `e6451abd2` rename legacy Arco CSS + guard
- `b0d9fed60` make Dense shell default
- `826926e41` shared icon scale
- `7ac3cfd8f` … `43f6ef1f2` content icon migration
- `207a4b769` runtime icon E2E
- `4d8615484` phone shell E2E
- `d95288a4c` read-only WebUI catalog
