import { BadRequestException } from '@nestjs/common'
import { integer } from './tabletop-rules'

const conditionIds = new Set(['agarrado', 'assustado', 'atordoado', 'caido', 'cego', 'envenenado', 'inconsciente',
  'paralisado', 'sangrando', 'surdo', 'marcador-amarelo', 'marcador-azul', 'marcador-laranja', 'marcador-rosa',
  'marcador-roxo', 'marcador-verde', 'marcador-vermelho'])
function invalid(): never {
  throw new BadRequestException('Confira as propriedades de imagem, condições, barras, auras, visão e luz do token.')
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid()
  return value as Record<string, unknown>
}
function settingsArray(value: unknown, length: number) {
  if (!Array.isArray(value) || value.length !== length) return invalid()
  return value.map(record)
}
function distance(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1_000_000_000) return invalid()
  return value
}
function boolean(value: unknown) {
  return typeof value === 'boolean' ? value : invalid()
}
function range(value: Record<string, unknown>) {
  return { bright: distance(value.bright), dim: distance(value.dim), angle: integer(value.angle, 0, 360, 'Ângulo') }
}

export function tokenSettings(input: unknown) {
  const { bars, auras, conditions, image, vision, light } = record(input)
  const imageData = record(image)
  const visionData = record(vision)
  if (!Array.isArray(conditions) || conditions.some(id => typeof id !== 'string' || !conditionIds.has(id))
    || conditions.length !== new Set(conditions).size) return invalid()
  return {
    bars: settingsArray(bars, 3).map(bar => ({
      value: bar.value === null ? null : integer(bar.value, -2147483648, 2147483647, 'Valor da barra'),
      max: bar.max === null ? null : integer(bar.max, 1, 2147483647, 'Máximo da barra'),
    })),
    auras: settingsArray(auras, 2).map(aura => {
      if ((aura.shape !== 'circle' && aura.shape !== 'square') || typeof aura.color !== 'string'
        || !/^#[0-9a-f]{6}$/i.test(aura.color)) return invalid()
      return { radius: distance(aura.radius), shape: aura.shape, color: aura.color, opacity: integer(aura.opacity, 0, 100, 'Opacidade da aura') }
    }),
    conditions,
    image: { opacity: integer(imageData.opacity, 0, 100, 'Opacidade da imagem'), mirrored: boolean(imageData.mirrored) },
    vision: { ...range(visionData), enabled: boolean(visionData.enabled), dark: distance(visionData.dark) },
    light: range(record(light)),
  }
}
