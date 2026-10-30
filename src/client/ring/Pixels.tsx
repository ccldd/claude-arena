// Draws a character map as SVG pixels. Each letter is a colour class (px-<letter>), '.' is empty.
// Runs of the same letter on a row merge into one rect.

export function Pixels({ map, x = 0, y = 0 }: { map: string[]; x?: number; y?: number }) {
  const rects: JSX.Element[] = [];
  map.forEach((row, ry) => {
    let start = 0;
    for (let rx = 1; rx <= row.length; rx++) {
      if (row[rx] === row[start]) continue;
      if (row[start] !== '.') {
        rects.push(
          <rect
            key={`${ry}-${start}`}
            className={`px-${row[start]}`}
            x={x + start}
            y={y + ry}
            width={rx - start}
            height={1}
          />,
        );
      }
      start = rx;
    }
  });
  return <>{rects}</>;
}
