// Geometry of the club's volleyball mark, in a 40×40 box (outline: circle r=17 around 20,20).
// Three identical panels turn around the centre: each seam is a circular arc from the centre to
// the outline, and each panel has one parallel (concentric) line from the next seam to the
// outline — so every line really belongs to the ball's panel structure.
// `node scripts/ball.mjs` prints the SVG path used in site/index.html.

const C = 20, R = 17;
const SEAM = 12;     // radius of each seam arc (its centre lies SEAM from the ball centre)
const PANEL = 6;     // distance of the parallel panel line from its seam

const inside = ([x, y]) => Math.hypot(x - C, y - C) <= R;
const at = (S, r, t) => [S[0] + r * Math.cos(t), S[1] + r * Math.sin(t)];

export function ballArcs() {
  const seams = [0, 1, 2].map((k) => {
    const a = -Math.PI / 2 + k * 2 * Math.PI / 3;
    const S = [C + SEAM * Math.cos(a), C + SEAM * Math.sin(a)];
    const t0 = Math.atan2(C - S[1], C - S[0]);
    let lo = 0, hi = Math.PI; // grow the arc until it reaches the outline
    for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; inside(at(S, SEAM, t0 + m)) ? lo = m : hi = m; }
    return { S, r: SEAM, t0, span: lo };
  });

  const crossesSeam = (p, q, j) => {
    const { S, r, t0, span } = seams[j];
    const side = (x) => Math.sign(Math.hypot(x[0] - S[0], x[1] - S[1]) - r);
    if (side(p) === side(q)) return false;
    let t = Math.atan2(q[1] - S[1], q[0] - S[0]);
    while (t < t0) t += 2 * Math.PI;
    return t <= t0 + span;
  };

  const panels = seams.map((seam, k) => {
    const r = SEAM + PANEL, N = 20000, step = 2 * Math.PI / N;
    const ok = (i) => {
      const p = at(seam.S, r, i * step), q = at(seam.S, r, (i - 1) * step);
      return inside(p) && ![0, 1, 2].some((j) => j !== k && crossesSeam(q, p, j));
    };
    let best = null, cur = null;
    for (let i = 0; i < 2 * N; i++) {
      if (ok(i % N)) { cur = cur ? { a: cur.a, b: i } : { a: i, b: i }; if (!best || cur.b - cur.a > best.b - best.a) best = { ...cur }; } else cur = null;
    }
    return { S: seam.S, r, t0: best.a * step, span: (best.b - best.a) * step };
  });
  return [...seams, ...panels];
}

const fx = (n) => +n.toFixed(2);
export function ballPath() {
  return ballArcs().map(({ S, r, t0, span }) => {
    const [x0, y0] = at(S, r, t0), [x1, y1] = at(S, r, t0 + span);
    return `M${fx(x0)} ${fx(y0)}A${r} ${r} 0 ${span > Math.PI ? 1 : 0} 1 ${fx(x1)} ${fx(y1)}`;
  }).join('');
}

if (process.argv[1]?.endsWith('ball.mjs')) {
  console.log(ballPath());
}
