'use strict';
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { normalizeCodex } = require('./normalize.cjs');
function findCodex() {
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
  const triple = arch === 'arm64' ? 'aarch64-pc-windows-msvc' : 'x86_64-pc-windows-msvc';
  const roots = [path.join(process.env.APPDATA || '', 'npm/node_modules/@openai/codex'),
    path.join(os.homedir(), '.local/share/pnpm/global/5/node_modules/@openai/codex')];
  const candidates = [process.env.QUOTA_GLASS_CODEX_EXE, ...roots.map(r => path.join(r,
    `node_modules/@openai/codex-win32-${arch}/vendor/${triple}/bin/codex.exe`)),
    ...roots.map(r => path.join(r, `vendor/${triple}/codex/codex.exe`)),
    ...(process.env.PATH || '').split(path.delimiter).map(p => path.join(p,'codex.exe'))];
  return candidates.find(p => p && fs.existsSync(p));
}
async function readCodex({signal} = {}) {
  const executable = findCodex();
  if (!executable) throw new Error('codex_missing');
  const data = await new Promise((resolve,reject) => {
    const child = spawn(executable,['app-server'],{ windowsHide:true, stdio:['pipe','pipe','pipe'] });
    let buffer = '', finished = false;
    const finish = (error,result) => {
      if (finished) return;
      finished = true; clearTimeout(timer); signal?.removeEventListener('abort',abort); child.stdin.end(); child.kill();
      error ? reject(new Error(error)) : resolve(result);
    };
    const timer = setTimeout(() => finish('timeout'),18000);
    const abort = () => finish('connection');
    signal?.addEventListener('abort',abort,{once:true});
    if(signal?.aborted) {abort();return;}
    const send = obj => { if (!finished) child.stdin.write(JSON.stringify(obj)+'\n'); };
    child.on('error',() => finish('codex_missing'));
    child.on('exit',() => { if (!finished) finish('connection'); });
    child.stdin.on('error',() => finish('connection'));
    child.stderr.on('data',() => {}); // Never surface backend logs or credentials.
    child.stdout.on('data',chunk => {
      buffer += chunk;
      if (buffer.length > 1024*1024) return finish('unsupported');
      let index;
      while ((index = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0,index); buffer = buffer.slice(index+1);
        let msg; try { msg = JSON.parse(line); } catch { continue; }
        if (msg.id === 1) {
          if (msg.error) return finish('unsupported');
          send({method:'initialized'});
          send({id:2,method:'account/rateLimits/read'});
        } else if (msg.id === 2) {
          if (msg.error) return finish('codex_auth');
          finish(null,msg.result);
        }
      }
    });
    send({id:1,method:'initialize',params:{clientInfo:{name:'quota_glass',version:'1.0.0'},capabilities:{experimentalApi:true}}});
  });
  return {...normalizeCodex(data),source:'Codex 官方本地接口'};
}
module.exports = { id:'codex', name:'Codex', icon:'codex', read:readCodex, findCodex };
