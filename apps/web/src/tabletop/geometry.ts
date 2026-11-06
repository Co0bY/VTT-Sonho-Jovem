export type Point = { x: number; y: number }
export type Camera = Point & { scale: number }
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
export function toWorld(point: Point, camera: Camera): Point {
  return { x: (point.x - camera.x) / camera.scale, y: (point.y - camera.y) / camera.scale }
}
export function zoomAt(camera: Camera, point: Point, scale: number): Camera {
  const world = toWorld(point, camera)
  const nextScale = clamp(scale, 0.02, 2.5)
  return { x: point.x - world.x * nextScale, y: point.y - world.y * nextScale, scale: nextScale }
}
export function tokenPosition(point: Point, cell: number, snap: boolean, width: number, height: number): Point {
  const align = (n: number, limit: number) => clamp(snap ? Math.floor(n / cell) * cell + cell / 2 : n, cell / 2, limit - cell / 2)
  return { x: align(point.x, width), y: align(point.y, height) }
}
export function distance(a: Point, b: Point, cell: number, perCell = 1.5): number {
  return Math.hypot(a.x - b.x, a.y - b.y) / cell * perCell
}
