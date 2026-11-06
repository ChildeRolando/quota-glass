'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { normalizeCommand } = require('./normalize.cjs');
function readKey() {
  const env = process.env.COMMAND_CODE_API_KEY || process.env.CMD_API_KEY;
  if (env) return {key:env,source:'Command Code 环境变量'};
  try {
    const auth = JSON.parse(fs.readFileSync(path.join(os.homedir(),'.commandcode/auth.json'),'utf8'));
    if (typeof auth.apiKey === 'string' && auth.apiKey) return {key:auth.apiKey,source:'Command Code 本地登录'};
  } catch {}
  // Read only this service's saved configuration; never execute CC Switch scripts.
  const dbFile = path.join(os.homedir(),'.cc-switch/cc-switch.db');
  if (fs.existsSync(dbFile)) {
    let db;
    try {
      const { DatabaseSync } = require('node:sqlite');
      db = new DatabaseSync(dbFile,{readOnly:true});
      const rows = db.prepare('SELECT settings_config, website_url FROM providers ORDER BY is_current DESC').all();
      for (const row of rows) {
        const env = JSON.parse(row.settings_config)?.env;
        if (!env) continue;
        let host; try { host = new URL(env.ANTHROPIC_BASE_URL).hostname; } catch { continue; }
        if (host !== 'api.commandcode.ai') continue;
        const key = env.ANTHROPIC_AUTH_TOKEN || env.ANTHROPIC_API_KEY;
        if (typeof key === 'string' && key) return {key,source:'CC Switch · Command Code'};
      }
    } catch {} finally { db?.close(); }
  }
  throw new Error('command_missing');
}
async function readCommand({fetch,signal}) {
  const {key,source} = readKey();
  const get=async route=>{
   let response;
   try {
    response = await fetch('https://api.commandcode.ai/alpha/'+route,{
      method:'GET', redirect:'error', signal:signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000),
      headers:{Authorization:`Bearer ${key}`,'x-command-code-version':'1.88.4',Accept:'application/json','User-Agent':'QuotaGlass/1.0'}
    });
   } catch { throw new Error('connection'); }
  if (response.status === 401 || response.status === 403) throw new Error('command_auth');
  if (!response.ok) throw new Error(response.status === 429 ? 'rate_limited' : 'connection');
   try {return await response.json();} catch {throw new Error('unsupported');}
  };
  const [credits,subscription]=await Promise.allSettled([get('billing/credits'),get('billing/subscriptions')]);
  if(credits.status!=='fulfilled')throw credits.reason;
  return {...normalizeCommand(credits.value,subscription.status==='fulfilled'?subscription.value:null),source};
}
module.exports = { id:'command',name:'Command Code',icon:'command',read:readCommand };
