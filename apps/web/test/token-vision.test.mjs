import assert from 'node:assert/strict'
import test from 'node:test'
import { containsSector, tokenPointVisible, tokenVisibility } from '../src/tabletop/token-vision.ts'

const scene = { width: 800, height: 800, cell_size: 60, distance_per_cell: 3 }
const origin = { x: 400, y: 400, owner_id: 'player', layer: 'geral', rotation: 0 }

test('a visão segue o ângulo do token e a unidade do cenário', () => {
  const settings = { vision: { enabled: true, dark: 6, dim: 0, bright: 0, angle: 90 } }
  const visibility = tokenVisibility([{ ...origin, settings }], scene, 'player', false)
  assert.ok(containsSector(visibility.sight[0].dark, { x: 400, y: 300 }))
  assert.ok(!tokenPointVisible({ x: 400, y: 280 - 1 }, visibility))
  assert.ok(!tokenPointVisible({ x: 400, y: 500 }, visibility))
  const turned = tokenVisibility([{ ...origin, rotation: 180, settings }], scene, 'player', false)
  assert.ok(tokenPointVisible({ x: 400, y: 500 }, turned))
})

test('usa luz intensa e fraca na visão e conserva a mesa aberta para o mestre', () => {
  const viewer = { ...origin, settings: { vision: { enabled: true, bright: 10, dim: 6, dark: 0, angle: 360 } } }
  const light = { ...origin, owner_id: 'other', settings: { light: { bright: 8, dim: 12, angle: 360 } } }
  const visibility = tokenVisibility([viewer, light], scene, 'player', false)
  assert.ok(tokenPointVisible({ x: 540, y: 400 }, visibility))
  assert.ok(!tokenPointVisible({ x: 600, y: 400 }, visibility))
  assert.ok(tokenPointVisible({ x: 600, y: 400 }, tokenVisibility([viewer, light], scene, 'player', true)))
})
