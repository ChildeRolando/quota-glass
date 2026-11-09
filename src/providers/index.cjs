'use strict';
// A provider owns authentication and wire format. The renderer only gets this safe contract.
const providers = [require('./command.cjs'),require('./codex.cjs'),require('./openai.cjs')];
const messages = {
  openai_login:'请先加载本地连接扩展，再在浏览器中打开 OpenAI 账单页登录。',
  openai_expired:'OpenAI 网页会话已失效或被拒绝，请在浏览器中重新连接账单页。',
  openai_bridge:'本机余额连接端口不可用，请重启 HUD 后重试。',
  openai_balance:'尚未读取到官方余额，请打开账单页确认登录和组织。',
  codex_missing:'未找到 Codex CLI。安装并登录后重试。',
  codex_auth:'无法读取 Codex 订阅。请确认 Codex CLI 已使用 ChatGPT 账号登录。',
  command_missing:'未找到 Command Code 登录信息或 CC Switch 中的服务配置。',
  command_auth:'Command Code 拒绝了额度请求。请在原客户端确认登录或密钥仍有效。',
  connection:'暂时无法连接额度服务，请检查网络后重试。',
  timeout:'额度查询超时，请稍后重试。',
  rate_limited:'查询过于频繁，稍后会自动重试。',
  unsupported:'服务返回了暂不支持的额度格式。'
};
function validateSnapshot(value) {
  if (!value || !Array.isArray(value.windows) || value.windows.length > 8) throw new Error('unsupported');
  if (!value.windows.length && !Number.isFinite(value.balance?.value)) throw new Error('unsupported');
  for (const w of value.windows) {
    if (typeof w.label !== 'string')throw new Error('unsupported');
    if(w.remaining===null&&w.status==='unavailable')continue;
    if (typeof w.remaining !== 'number' || !Number.isFinite(w.remaining) || w.remaining < 0 || w.remaining > 100) throw new Error('unsupported');
  }
  // Explicit projection keeps provider credentials and opaque account IDs out of IPC.
  return { windows:value.windows.map(w => ({id:String(w.id),label:w.label.slice(0,16),remaining:w.remaining,
    resetsAt:Number.isFinite(w.resetsAt) && w.resetsAt > 0 ? w.resetsAt : null,
    durationMins:Number.isFinite(w.durationMins) ? w.durationMins : null,
    ...(w.status==='unavailable'?{status:'unavailable'}:{}),
    ...(typeof w.basis==='string'?{basis:w.basis.slice(0,100)}:{})})),
    balance:value.balance && Number.isFinite(value.balance.value) ? {value:value.balance.value,unit:String(value.balance.unit).slice(0,12)} : null,
    plan:typeof value.plan === 'string' ? value.plan.slice(0,40) : null,
    source:typeof value.source === 'string' ? value.source.slice(0,100) : '' };
}
async function readProvider(provider,context) {
  const base = {id:provider.id,name:provider.name,icon:provider.icon,display:provider.display};
  try {
    return {...base,...validateSnapshot(await provider.read(context)),status:'connected',updatedAt:Date.now(),error:null};
  } catch (error) {
    return {...base,status:'disconnected',windows:[],balance:null,updatedAt:null,
      error:messages[error.message] || messages.connection};
  }
}
module.exports = {providers,readProvider,validateSnapshot};
