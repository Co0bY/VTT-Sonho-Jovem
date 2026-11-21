import type { Camera, Point } from './geometry'
import type { Scene, Token } from './types'

export type Sector = Point & { radius: number; angle: number; direction: number }
export type TokenVisibility = {
  brightLights: Sector[]
  dimLights: Sector[]
  sight: { origin: Sector; bright: Sector; dim: Sector; dark: Sector }[]
}

export function distancePixels(scene: Scene, distance: number) {
  return Math.min(distance * scene.cell_size / scene.distance_per_cell, 2 * Math.hypot(scene.width, scene.height))
}

function sector(token: Token, scene: Scene, radius: number, angle: number): Sector {
  return { x: token.x, y: token.y, radius: distancePixels(scene, radius), angle, direction: (token.rotation ?? 0) * Math.PI / 180 - Math.PI / 2 }
}

export function tokenVisibility(tokens: Token[], scene: Scene, userId: string, master: boolean): TokenVisibility {
  const brightLights: Sector[] = [], dimLights: Sector[] = [], sight: TokenVisibility['sight'] = []
  for (const token of tokens) {
    if (token.layer === 'mestre' && !master) continue
    const light = token.settings?.light
    if (light) {
      if (light.bright > 0) brightLights.push(sector(token, scene, light.bright, light.angle))
      if (light.dim > 0) dimLights.push(sector(token, scene, light.dim, light.angle))
    }
    const vision = token.settings?.vision
    if (!master && token.owner_id === userId && token.layer === 'geral' && vision?.enabled) {
      sight.push({
        origin: sector(token, scene, scene.distance_per_cell / 2, 360),
        bright: sector(token, scene, vision.bright, vision.angle),
        dim: sector(token, scene, vision.dim, vision.angle),
        dark: sector(token, scene, vision.dark, vision.angle),
      })
    }
  }
  return { brightLights, dimLights, sight }
}

export function containsSector(sector: Sector, point: Point) {
  const dx = point.x - sector.x, dy = point.y - sector.y
  if (sector.radius <= 0 || sector.angle <= 0 || Math.hypot(dx, dy) > sector.radius) return false
  if (sector.angle === 360 || (dx === 0 && dy === 0)) return true
  const difference = Math.atan2(dy, dx) - sector.direction
  return Math.abs(Math.atan2(Math.sin(difference), Math.cos(difference))) <= sector.angle * Math.PI / 360
}

export function tokenPointVisible(point: Point, visibility: TokenVisibility) {
  if (!visibility.sight.length) return true
  const lighting = visibility.brightLights.some(light => containsSector(light, point)) ? 'bright'
    : visibility.dimLights.some(light => containsSector(light, point)) ? 'dim' : 'dark'
  return visibility.sight.some(view => containsSector(view.origin, point) || containsSector(view.dark, point) || containsSector(view[lighting], point))
}

export function drawTokenFog(canvas: HTMLCanvasElement, scene: Scene, camera: Camera, visibility: TokenVisibility,
  buffers: HTMLCanvasElement[], width: number, height: number) {
  canvas.hidden = !visibility.sight.length
  if (canvas.hidden || !width || !height) return
  const contexts = [canvas, ...buffers].map(layer => {
    if (layer.width !== width || layer.height !== height) { layer.width = width; layer.height = height }
    const context = layer.getContext('2d')!
    context.globalCompositeOperation = 'source-over'
    context.clearRect(0, 0, width, height)
    return context
  })
  const [fog, bright, dim, cut] = contexts
  if (!fog || !bright || !dim || !cut) return

  function fill(context: CanvasRenderingContext2D, area: Sector) {
    if (area.radius <= 0 || area.angle <= 0) return
    const x = camera.x + area.x * camera.scale, y = camera.y + area.y * camera.scale
    const halfAngle = area.angle * Math.PI / 360
    context.beginPath()
    if (area.angle < 360) context.moveTo(x, y)
    context.arc(x, y, area.radius * camera.scale, area.direction - halfAngle, area.direction + halfAngle)
    context.closePath()
    context.fill()
  }

  visibility.brightLights.forEach(light => fill(bright, light))
  visibility.dimLights.forEach(light => fill(dim, light))
  dim.globalCompositeOperation = 'destination-out'
  dim.drawImage(buffers[0]!, 0, 0)
  fog.fillStyle = '#15121d'
  fog.fillRect(camera.x, camera.y, scene.width * camera.scale, scene.height * camera.scale)
  fog.globalCompositeOperation = 'destination-out'

  for (const view of visibility.sight) {
    fill(fog, view.origin)
    fill(fog, view.dark)
    for (const [zone, buffer] of [[view.bright, buffers[0]!], [view.dim, buffers[1]!]] as const) {
      cut.globalCompositeOperation = 'source-over'
      cut.clearRect(0, 0, width, height)
      fill(cut, zone)
      cut.globalCompositeOperation = 'source-in'
      cut.drawImage(buffer, 0, 0)
      fog.drawImage(buffers[2]!, 0, 0)
    }
  }
  fog.globalCompositeOperation = 'source-over'
}
