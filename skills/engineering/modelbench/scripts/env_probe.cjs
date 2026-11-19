// Usage: node env_probe.cjs OUT
// Shell is used only for fixed system-info commands; the Chrome path goes through execFileSync.
// Records machine, browser, WebGL renderer (hardware vs software) and idle rAF cadence to OUT/evidence/environment.json.
const { open, writeJson, CHROME } = require('./lib/common.cjs');
const { execSync, execFileSync } = require('child_process'); const os = require('os'); const path = require('path');
(async () => {
  const OUT = process.argv[2]; if (!OUT) throw new Error('usage: node env_probe.cjs OUT');
  const sh = (c) => { try { return execSync(c, { encoding: 'utf8' }).trim(); } catch { return null; } };
  const { ctx, page } = await open(path.join(os.tmpdir(), 'modelbench-probe'));
  await page.goto('about:blank');
  const info = await page.evaluate(async () => {
    const gl = document.createElement('canvas').getContext('webgl2'); const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    const t = []; await new Promise(res => { const s = performance.now(); const f = (n) => { t.push(n); if (n - s < 3000) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    const d = t.slice(1).map((x, i) => x - t[i]).sort((a, b) => a - b);
    return { ua: navigator.userAgent, webgl2: !!gl, renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null, dpr: devicePixelRatio, idleRafMedianMs: d[d.length >> 1], idleRafHz: Math.round(1000 / d[d.length >> 1]) };
  });
  await ctx.close();
  info.software = /swiftshader|llvmpipe|software/i.test(info.renderer || '');
  const env = { capturedUtc: new Date().toISOString(), os: sh('sw_vers 2>/dev/null | tr "\\n" " "') || os.type() + ' ' + os.release(), hardware: sh('system_profiler SPHardwareDataType 2>/dev/null | grep -E "Model Name|Model Identifier|Chip|Memory" | sed "s/^ *//" | tr "\\n" ";"'), browser: (() => { try { return execFileSync(CHROME, ['--version'], { encoding: 'utf8' }).trim(); } catch { return null; } })(), ...info, viewports: ['1440x900@1', '390x844@1'] };
  writeJson(path.join(OUT, 'evidence', 'environment.json'), env);
  console.log(JSON.stringify(env, null, 1));
})().catch(e => { console.error(e.message || e); process.exit(1); });
