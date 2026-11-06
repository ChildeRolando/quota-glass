# 添加服务商

接入点是 `src/providers/index.cjs` 的 `providers` 数组。新增一个 `src/providers/<id>.cjs` 模块并注册即可，窗口宽度按服务商数量自动调整。不需要复制环形 UI 或更改 IPC。

```js
module.exports = {
  id: 'example',
  name: 'Example',
  icon: 'generic',
  async read({ fetch, signal }) {
    // Read locally managed credentials here. Request only the provider's fixed origin.
    // Adapt the actual upstream response. Never substitute demo/default percentages.
    return {
      windows: [{
        id: 'weekly', label: '1w', remaining: 88,
        resetsAt: 1794461836000, durationMins: 10080
      }],
      balance: null,
      plan: null,
      source: 'Your local client'
    };
  }
};
```

上例的数值仅解释数据结构，不能作为实际适配器的 fallback。通用组件最多绘制三圈，其他窗口显示在详情。Command Code 固定 monthly / weekly / fiveHour 对应外 / 中 / 内圈。点击环选择中间显示窗口，选择会在本地记住。

`remaining` 必须是 0–100 的有限数值，或在明确 `status:'unavailable'` 时为 null；未知不能表示成 0。`resetsAt` 是 Unix 毫秒数或 null。不提供重置时间时，不应从当前时间推算。失败抛错，统一入口将结果变为 disconnected 并清空旧数据。认证及原始服务器响应不传给渲染器；`validateSnapshot` 只选取必要的安全字段。

内置适配器：
- `codex.cjs`：发现 CLI 路径、JSON-RPC 初始化、读取用量，18 秒超时并结束子进程。
- `command.cjs`：查找已保存凭据、并行读取 credits/subscriptions，15 秒超时；通过只读 SQLite 读取 CC Switch。`command-plans.cjs` 封装官方 CLI 1.88.4 的标准月积分池表，未知 planId 不猜测。套餐调整后需同步该表；monthlyCredits 不包含额外购买/赠送余额。
- `normalize.cjs`：协议字段到额度结构的纯函数转换，有独立回归测试。

适配器隔离的具体原因：Codex 的 usedPercent 与 Command Code 的 used/cap 语义不同；认证来源、进程生命周期与网络请求各自变化。将这些实现放入渲染器会暴露凭据，也会令新增服务影响现有环形展示。

当前不加载任意外部脚本，不提供运行时 JS 插件安装。新增适配器后需要重新打包。
