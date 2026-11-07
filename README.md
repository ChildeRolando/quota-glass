# Quota Glass

Windows 桌面订阅额度悬浮窗。支持 Command Code 与 Codex，采用可扩展的服务商适配器。

## 运行

打开打包目录内的 `QuotaGlass.exe`，无需安装 Node.js。整个打包目录必须保持完整。

- 拖动面板的标题、空白区域移动窗口；拖动窗口边缘使用 Windows 原生缩放，保持面板比例，位置与大小自动保存。
- Command Code 内圈是 5h、中圈是周、外圈是月；直接点击圆环切换中间数字、周期标签和倒计时，选择会自动记住。中心文字只展示数据，点击没有动作。
- 鼠标保持默认箭头，圆环与按钮通过悬浮亮度变化提示可操作性。三圈未选中亮度一致，选中圈和服务商标题均为白色。
- 设置页的面板大小滑块支持 60%–140% 连续调节，拖动时即时更新原生窗口尺寸，自动保存。
- 玻璃透明度支持 20%–90%，数值越高越通透，文字与圆环保持清晰。
- 右下角设置按钮可查看各周期的精确剩余百分比、积分余额和连接来源。
- 点击刷新按钮立即查询；默认每 60 秒自动刷新。
- 点击减号收起到托盘；双击托盘图标切换显示/隐藏。
- 勾选托盘“锁定”后，鼠标穿过 HUD 操作后面的窗口；从托盘取消勾选即可恢复点击和拖动。锁定状态会在重启后保留，默认关闭。
- `Ctrl+Shift+Q` 显示/隐藏窗口；若该快捷键已被其他软件占用，请使用托盘。
- 托盘右键菜单仅有“显示、置顶、锁定、设置、退出”；“显示”的勾选状态与面板实际显隐同步，点击即可切换。
- 设置页提供“开机启动”：默认关闭，可选择登录 Windows 后自动显示面板。退出或取消勾选不会改变原客户端配置。

## 额度含义

圆环与中心数字表示**剩余百分比**，中心数字四舍五入到整数。详情展示一位小数。Command Code 固定三圈：外圈月、中圈周、内圈 5h；Codex 按实际返回周期显示，`7d` 是一周，`5h` 是五小时，`1m` 是一个月。

Codex 不假设每个订阅都有 5 小时限制。Command Code 月圈由实际订阅 planId 匹配官方 CLI 1.88.4 的标准月积分池，使用 monthlyCredits 剩余值计算；例如 GOAT 的标准积分池为 70。官网按模型折算的“最高可用金额”不是该积分池，不混用。额外购买/赠送积分只计入详情余额，不混入月圈。月重置时间来自实际账单结束时间，不能用固定 30 天替代。未知套餐或订阅查询失败时月圈显示“— / 1m”，其余窗口仍独立可用。

重置时间为零显示“等待周期开始”；倒计时到零后等待下一次服务数据，不自行把额度补满。

查询失败显示“未连接”，不继续把上次成功数据当作当前额度。设置窗口给出错误原因；每个服务独立读取，互不覆盖。

## 数据来源与隐私

Codex 使用已安装的官方 CLI `codex app-server` 的 `account/rateLimits/read`，复用 CLI 管理的登录。不会创建对话或发送模型请求；不会消耗额度重置次数。常见 npm 安装位置与 PATH 中的 `codex.exe` 会自动识别；其他位置可通过 `QUOTA_GLASS_CODEX_EXE` 指定可执行文件。

Command Code 按顺序读取 `COMMAND_CODE_API_KEY` / `CMD_API_KEY`、`~/.commandcode/auth.json` 的 `apiKey`，或 CC Switch 数据库中 API 主机为 `api.commandcode.ai` 的配置。数据库只读，不运行其中的脚本。只向固定的 `https://api.commandcode.ai/alpha/billing/credits` 和 `billing/subscriptions` 发出读取请求，不跟随重定向。请求附带与核对过的 Command Code CLI 1.88.4 对应的版本头。

凭据保留在主进程内存中，不写入本程序配置、不传入网页、不导出到截图或日志。窗口设置保存在 `%APPDATA%/quota-glass/settings.json`（打包版目录名称取决于 Electron 的应用名）。原客户端仍负责登录维护。

核对依据：
- [Codex App Server 官方文档](https://learn.chatgpt.com/docs/app-server)
- [Command Code 配置官方文档](https://commandcode.ai/docs/settings)
- 官方 npm 包 `command-code@1.88.4` 的只读 usage 请求及返回字段。

## 源码开发

需要 Node.js 22+。在源码目录运行：

```powershell
npm ci
npm start
npm test
npm run verify
npm run verify:settings
npm run verify:appearance
npm run verify:topmost
npm run package
```

打包结果位于 `dist/QuotaGlass-win32-x64/`，可通过 `QUOTA_GLASS_OUTPUT_DIR` 自定义输出目录。仓库包含附源码的原生辅助程序；重新编译需安装 .NET Framework 4.8 开发工具与 Windows SDK 10.0.20348.0。

`verify` 会真实读取本机额度并测试两个窗口、60%–140% 连续缩放、置顶、隔离与断线展示；测试截图中 `offline-panel.png` 为明确注入的断线场景，`live-panel.png` 为实际查询结果。开发测试状态与正常运行状态使用不同配置目录，验证模式禁用开机启动操作。截图、真实查询结果与本机验证记录不会提交到 Git。

`verify:settings` 检查首次打开设置、重复打开、关闭后重开和最小化恢复，在置顶开关两种状态下验证显示时机与窗口归属。

`verify:appearance` 检查托盘显隐、隐藏面板后打开设置、滑块拖动期间的尺寸采样、透明度、原生边缘命中与圆角裁剪。

`verify:topmost` 读取原生窗口置顶标记和 Z 顺序，检查另一普通窗口切到前台后 HUD 与玻璃层仍位于其上方，以及取消置顶、缩放和显隐恢复。

Windows 11 使用透明窗口，禁用整窗 Accent、系统背景和边框。`src/native/GlassHelper.exe` 裁剪指定 PID 的窗口；`GlassBackdrop.exe` 在其下方放置不抢焦点、不接收点击的原生合成窗口，HostBackdropBrush 配合圆角几何遮罩，让模糊效果本身也严格限于圆角以内。它常驻跟随面板移动、缩放、隐藏，在尺寸变化时更新窗口圆角，通过本地管道调整模糊透明度，并随程序退出，不采集屏幕截图。两个辅助程序均附 C# 源码，可用 `scripts/build-native.ps1` 编译。玻璃观感会随桌面背景、系统透明效果和显示缩放变化。此版本针对 Windows 11 x64 打包，其他系统兼容性需单独确认。

## 添加服务商

见 [docs/providers.md](docs/providers.md)。认证与服务商响应格式各自封装，通用界面只消费经过筛选的额度结构。现有实现没有 GLM 或 DeepSeek 接入。

`npm run verify:lock` 检查托盘锁定往返、HUD 与玻璃层的原生鼠标穿透标记、Windows 实际命中后方测试窗口、隐藏恢复和重启后的锁定状态。

### Clash Verge 延迟扩展
设置 → 扩展 → 显示 Clash Verge 节点延迟，默认关闭。开启后在更新时间右侧显示 `ping 191ms`，立即测速一次，此后随手动或每 60 秒的额度刷新测速；关闭后隐藏并取消未完成的查询，开关会保存。

通过本机 Clash Verge / Clash Verge Rev 的命名管道（含服务模式）或本地控制接口读取当前选择。规则模式跟随最终 MATCH 策略，全局模式跟随 GLOBAL，递归定位选中的节点。延迟是 Clash 的 HTTP URL 测试结果，不是 ICMP ping；优先使用 Verge 的测速地址或策略组地址，默认 `http://cp.cloudflare.com/generate_204`。不修改节点、代理设置或配置文件；接口凭据只在主进程内使用。

未运行、直连、没有唯一当前节点、超时或测速期间节点切换时显示 `ping —`，设置中说明原因，不沿用旧数值。测速独立于额度请求，不延迟额度显示。`npm run verify:clash` 需要本机 Clash Verge 正在运行，用实际节点验证显示开关和取消查询，并用明确的模拟数据检查布局。
