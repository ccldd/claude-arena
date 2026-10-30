// The crowd is generated once from a fixed seed, so it looks the same on every visit.

const WIDTH = 200;
const HEIGHT = 44;
const SKIN = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#b07a4f'];
const SHIRT = ['#e63946', '#f4a261', '#2a9d8f', '#457b9d', '#e9c46a', '#9b5de5', '#f15bb5', '#00bbf9'];

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Fan {
  x: number;
  y: number;
  skin: string;
  shirt: string;
  cheer: number | null;
}

const FANS: Fan[] = (() => {
  const rand = rng(7);
  const fans: Fan[] = [];
  for (let row = 0; row < 5; row++) {
    for (let x = (row % 2) * 3 - 2; x < WIDTH; x += 6) {
      fans.push({
        x: x + Math.floor(rand() * 2),
        y: row * 8 + 2,
        skin: SKIN[Math.floor(rand() * SKIN.length)],
        shirt: SHIRT[Math.floor(rand() * SHIRT.length)],
        cheer: rand() < 0.3 ? Math.floor(rand() * 4) : null,
      });
    }
  }
  return fans;
})();

const FLASHES = Array.from({ length: 9 }, (_, i) => {
  const rand = rng(100 + i);
  return { x: Math.floor(rand() * WIDTH), y: Math.floor(rand() * 30) + 2, delay: rand() * 6 };
});

export function Crowd() {
  return (
    <svg
      className="crowd"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="xMidYMax slice"
      shapeRendering="crispEdges"
      aria-hidden
    >
      {FANS.map((f, i) => (
        <g key={i} className={f.cheer === null ? undefined : `cheer cheer-${f.cheer}`}>
          <rect x={f.x} y={f.y} width={4} height={4} fill={f.skin} />
          <rect x={f.x - 1} y={f.y + 4} width={6} height={5} fill={f.shirt} />
        </g>
      ))}
      {FLASHES.map((f, i) => (
        <rect
          key={i}
          className="flash"
          x={f.x}
          y={f.y}
          width={2}
          height={2}
          style={{ animationDelay: `${f.delay}s` }}
        />
      ))}
    </svg>
  );
}
