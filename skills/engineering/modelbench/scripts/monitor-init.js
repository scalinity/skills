
// Lightweight independent rAF monitor + WebGL draw counters (init script for performance trials).
(() => {
  const M = window.__mon = { t: [], drawsAt: [], points: 0, maxPoints: 0, draws: 0, on: false, first: null };
  const wrap = (proto) => {
    if (!proto) return;
    for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
      const orig = proto[name]; if (!orig) continue;
      proto[name] = function (mode, a, b, c, d) {
        M.draws++;
        if (name === 'drawArrays' && mode === 0) { M.points += b; }
        if (M.first === null) M.first = performance.now();
        return orig.call(this, mode, a, b, c, d);
      };
    }
  };
  wrap(window.WebGL2RenderingContext && WebGL2RenderingContext.prototype);
  wrap(window.WebGLRenderingContext && WebGLRenderingContext.prototype);
  let lastDraws = 0, lastPoints = 0;
  const tick = (now) => {
    if (M.on) { M.t.push(now); M.drawsAt.push(M.draws - lastDraws); if (M.points - lastPoints > M.maxPoints) M.maxPoints = M.points - lastPoints; }
    lastDraws = M.draws; lastPoints = M.points;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  M.start = () => { M.t = []; M.drawsAt = []; M.maxPoints = 0; M.on = true; };
  M.stop = () => { M.on = false; return { t: M.t, drawsAt: M.drawsAt, maxPointsPerFrame: M.maxPoints }; };
})();