import { BadRequestException } from '@nestjs/common'
import type { PageField, SheetField, StoredSheet } from './character-sheet'
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

type Bar = { value: number | null; max: number | null; valueFieldId?: string; maxFieldId?: string }
function barFieldId(value: unknown) {
  if (value === undefined) return undefined
  if (typeof value !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)) return invalid()
  return value
}

export function resolvedBars(bars: Bar[], sheet: StoredSheet | null) {
  const fields = sheet?.version === 2 ? sheet.pages.flatMap(page => page.fields) : sheet?.fields ?? []
  const values = new Map(fields.map(field => [field.id, field.value]))
  function resolve(id: string | undefined, manual: number | null, minimum: number) {
    if (id === undefined) return manual
    const raw = values.get(id)?.trim()
    const value = raw && /^[-+]?\d+(?:[.,]0+)?$/.test(raw) ? Number(raw.replace(',', '.')) : NaN
    return Number.isInteger(value) && value >= minimum && value <= 2147483647 ? value : null
  }
  return bars.map(bar => {
    const value = resolve(bar.valueFieldId, bar.value, -2147483648)
    const max = resolve(bar.maxFieldId, bar.max, 1)
    return value === null || max === null ? { value: null, max: null } : { value, max }
  })
}

export function tokenSettings(input: unknown) {
  const { bars, auras, conditions, image, vision, light } = record(input)
  if (!Array.isArray(bars) || bars.length > 12) return invalid()
  const imageData = record(image)
  const visionData = record(vision)
  if (!Array.isArray(conditions) || conditions.some(id => typeof id !== 'string' || !conditionIds.has(id))
    || conditions.length !== new Set(conditions).size) return invalid()
  return {
    bars: bars.map(record).map(bar => ({
      value: bar.value === null ? null : integer(bar.value, -2147483648, 2147483647, 'Valor da barra'),
      max: bar.max === null ? null : integer(bar.max, 1, 2147483647, 'Máximo da barra'),
      valueFieldId: barFieldId(bar.valueFieldId),
      maxFieldId: barFieldId(bar.maxFieldId),
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

export function applyLinkedBarUpdates(sheet: StoredSheet, bars: Bar[], raw: unknown): StoredSheet {
  const entries = Object.entries(record(raw))
  const linked = new Set(bars.flatMap(bar => [bar.valueFieldId, bar.maxFieldId]))
  const maximums = new Set(bars.map(bar => bar.maxFieldId))
  const fields = sheet.version === 2 ? sheet.pages.flatMap(page => page.fields) : sheet.fields
  const updated = new Map<string, string>()
  for (const [id, input] of entries) {
    const field = fields.find(item => item.id === id)
    if (!field || !linked.has(id)) throw new BadRequestException('O campo precisa estar vinculado a uma barra deste token.')
    if ('readOnly' in field && field.readOnly) throw new BadRequestException(`${field.label} está em somente leitura.`)
    const value = input === null ? '' : String(integer(input, maximums.has(id) ? 1 : -2147483648, 2147483647, field.label))
    if ((field.type === 'bar' && (value === '' || Number(value) < 0 || Number(value) > field.maximum))
      || ((field.type === 'select' || field.type === 'radio') && value !== '' && !field.options.includes(value))
      || field.type === 'checkbox') throw new BadRequestException(`O valor é inválido para o campo ${field.label}.`)
    updated.set(id, value)
  }
  function withValue<T extends PageField | SheetField>(field: T): T {
    const value = updated.get(field.id)
    return value === undefined ? field : { ...field, value }
  }
  return sheet.version === 2
    ? { ...sheet, pages: sheet.pages.map(page => ({ ...page, fields: page.fields.map(withValue) })) }
    : { ...sheet, fields: sheet.fields.map(withValue) }
}
