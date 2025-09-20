export function calculateAngle(a: any, b: any, c: any) {
  // a, b, c are landmarks (with x, y values)
  const ab = { x: a.x - b.x, y: a.y - b.y, z: (a.z || 0) - (b.z || 0) };
  const cb = { x: c.x - b.x, y: c.y - b.y, z: (c.z || 0) - (b.z || 0) };

  const dot = ab.x * cb.x + ab.y * cb.y;
  const magAB = Math.sqrt(ab.x ** 2 + ab.y ** 2);
  const magCB = Math.sqrt(cb.x ** 2 + cb.y ** 2);

  const cosine = dot / (magAB * magCB);
  const angle = Math.acos(Math.min(Math.max(cosine, -1), 1)); // clamp to avoid NaN
  return (angle * 180) / Math.PI; // convert to degrees
}

export function midpoint(a: any, b: any): any {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: ((a.z || 0) + (b.z || 0)) / 2 };
}

export function veticalVector(a: any, b: any) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function vectorLength(v: { x: number; y: number; z?: number }): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + (v.z || 0) * (v.z || 0));
}

export function angleBetween(v1: { x: number; y: number; z?: number }, v2: { x: number; y: number; z?: number }) {
  const dot = v1.x * v2.x + v1.y * v2.y + (v1.z || 0) * (v2.z || 0);
  const l = Math.max(1e-6, vectorLength(v1) * vectorLength(v2));
  let cos = dot / l;
  cos = Math.min(1, Math.max(-1, cos));
  return Math.acos(cos) * (180 / Math.PI);
}

export const drawPoint = (
  ctx: CanvasRenderingContext2D,
  p: any,
  color = "red"
) => {
  if (!p) return;
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;

  ctx.beginPath();
  ctx.arc(p.x * w, p.y * h, 2, 0, 2 * Math.PI);
  ctx.fillStyle = color;
  ctx.fill();
};

export const drawLine = (
  ctx: CanvasRenderingContext2D,
  a: any,
  b: any,
  color = "lime"
) => {
  if (!a || !b) return;
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;

  ctx.beginPath();
  ctx.moveTo(a.x * w, a.y * h);
  ctx.lineTo(b.x * w, b.y * h);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.stroke();
};