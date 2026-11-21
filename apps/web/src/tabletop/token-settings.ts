export const tokenConditions = [
  { value: 'agarrado', label: 'Agarrado', color: '#c89e77' },
  { value: 'assustado', label: 'Assustado', color: '#e4a5ae' },
  { value: 'atordoado', label: 'Atordoado', color: '#e4b564' },
  { value: 'caido', label: 'Caído', color: '#c494ef' },
  { value: 'cego', label: 'Cego', color: '#94a3b8' },
  { value: 'envenenado', label: 'Envenenado', color: '#74ca88' },
  { value: 'inconsciente', label: 'Inconsciente', color: '#72a9de' },
  { value: 'paralisado', label: 'Paralisado', color: '#de7dcc' },
  { value: 'sangrando', label: 'Sangrando', color: '#ec777e' },
  { value: 'surdo', label: 'Surdo', color: '#a2c5cf' },
  { value: 'marcador-amarelo', label: 'Marcador amarelo', color: '#e9d674' },
  { value: 'marcador-azul', label: 'Marcador azul', color: '#74b7ec' },
  { value: 'marcador-laranja', label: 'Marcador laranja', color: '#ecac65' },
  { value: 'marcador-rosa', label: 'Marcador rosa', color: '#ed94b9' },
  { value: 'marcador-roxo', label: 'Marcador roxo', color: '#b78ae9' },
  { value: 'marcador-verde', label: 'Marcador verde', color: '#79ce80' },
  { value: 'marcador-vermelho', label: 'Marcador vermelho', color: '#e97677' },
] as const
export const barColors = ['#79d68d', '#7aafea', '#e97780']
export type TokenSettings = {
  bars: { value: number | null; max: number | null }[]
  auras: { radius: number; shape: 'circle' | 'square'; color: string; opacity: number }[]
  conditions: string[]
  image: { opacity: number; mirrored: boolean }
  vision: { enabled: boolean; bright: number; dim: number; dark: number; angle: number }
  light: { bright: number; dim: number; angle: number }
}

export function editableTokenSettings(saved?: Partial<TokenSettings>): TokenSettings {
  return {
    bars: Array.from({ length: 3 }, (_, index) => ({ value: null, max: null, ...saved?.bars?.[index] })),
    auras: ['#e8c764', '#81d8ae'].map((color, index) => ({
      radius: 0, shape: 'circle', color, opacity: 35, ...saved?.auras?.[index],
    })),
    conditions: [...(saved?.conditions ?? [])],
    image: { opacity: 100, mirrored: false, ...saved?.image },
    vision: { enabled: false, bright: 0, dim: 0, dark: 0, angle: 360, ...saved?.vision },
    light: { bright: 0, dim: 0, angle: 360, ...saved?.light },
  }
}
