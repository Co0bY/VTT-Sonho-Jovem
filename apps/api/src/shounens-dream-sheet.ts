import { randomBytes } from 'node:crypto'
import type { PoolClient } from 'pg'
import { characterSheet, type FieldType, type PageField, type PagedSheet } from './character-sheet'

const systemId = 'b9ee1867-ddb8-4f48-ba55-88c2d5b1b635'
export const systemEmail = 'sistema@vtt.invalid'
export const shounensDreamModelId = 'c43e10d1-46a3-4eba-81e8-d117e1ec0b50'
export const shounensDreamBackgrounds = ['page-1.png', 'page-2.png', 'page-3.png'] as const

function stableId(index: number) {
  return `e0723818-d7be-4adb-aa21-${index.toString(16).padStart(12, '0')}`
}

function buildSheet(): PagedSheet {
  const width = 800
  // Positions and row spacing are measured in points from the editable PDF.
  const px = (points: number) => Math.round(points * width / 595.2756)
  let fieldIndex = 4
  function field(reference: string, label: string, type: FieldType, x: number, y: number, w: number, h: number, options: string[] = []): PageField {
    const left = px(x), top = px(y)
    return {
      id: stableId(fieldIndex++), reference, label, type,
      x: left, y: top, width: px(x + w) - left, height: px(y + h) - top,
      value: '', hideLabel: true, highlight: false, maximum: 100, options,
    }
  }

  const attributes = [
    ['fis', 'Poder (FÍS)', 85.04], ['hab', 'Habilidade', 181.42], ['vit', 'Vitalidade', 277.8],
    ['men', 'Mentalidade', 374.17], ['enc', 'Encanto', 470.55],
  ] as const
  const attributeFields = attributes.map(([ref, label, x]) =>
    field(`atributo_${ref}`, label, 'number', x, 462.05, 34.02, 19.84))
  const elements = [
    ['vento', 'Vento'], ['agua', 'Água'], ['plantae', 'Plantae'], ['magma', 'Magma'],
    ['fogo', 'Fogo'], ['raio', 'Raio/Trovão'], ['gelo', 'Gelo'], ['terra', 'Pedra/Terra'],
    ['tempo', 'Tempo'], ['criacao', 'Criação'], ['espaco', 'Espaço'], ['destruicao', 'Destruição'],
  ]
  const levels = Array.from({ length: 20 }, (_, index) => String(index + 1))
  const identity = [
    field('nome', 'Nome', 'text', 65.2, 158.74, 226.77, 17.01),
    field('jogador', 'Jogador', 'text', 306.14, 158.74, 223.94, 17.01),
    field('origem', 'Origem', 'text', 65.2, 198.43, 150.24, 17.01),
    field('idade', 'Idade', 'text', 229.61, 198.43, 70.87, 17.01),
    field('arquetipo', 'Arquétipo', 'text', 314.65, 198.43, 215.43, 17.01),
    field('pv_atual', 'PV atual', 'number', 65.2, 306.14, 85.04, 25.51),
    field('pv_maximo', 'PV máximo', 'number', 172.91, 306.14, 85.04, 25.51),
    field('energia_atual', 'Ki ou Mana atual', 'number', 280.63, 306.14, 85.04, 25.51),
    field('energia_maximo', 'Ki ou Mana máximo', 'number', 388.35, 306.14, 85.04, 25.51),
    field('tipo_energia', 'Tipo de energia', 'radio', 477.07, 303.68, 50, 30.25, ['Ki', 'Mana']),
    ...attributeFields,
    ...elements.map(([ref, label], index) =>
      field(`elemento_${ref}`, `Nível de ${label}`, 'select',
        65.2 + (index % 4) * 119.055, 609.45 + Math.floor(index / 4) * 53.858, 96.38, 17.01, levels)),
  ]

  const techniques = Array.from({ length: 8 }, (_, index) => {
    const number = index + 1
    const row = `tecnica_${number}`
    const y = 189.92 + index * 76.5354
    return [
      field(`${row}_nome`, `Nome da técnica ${number}`, 'text', 65.2, y, 184.25, 17.01),
      field(`${row}_nivel`, `Nível da técnica ${number}`, 'select', 257.95, y, 42.52, 17.01, levels),
      field(`${row}_elemento`, `Elemento da técnica ${number}`, 'select', 308.98, y, 79.37, 17.01, elements.map(([, label]) => label)),
      { ...field(`${row}_custo`, `Custo da técnica ${number}`, 'number', 396.85, y, 53.86, 17.01), readOnly: true },
      field(`${row}_alcance`, `Alcance da técnica ${number}`, 'text', 459.21, y, 70.87, 17.01),
      field(`${row}_efeito`, `Efeito da técnica ${number}`, 'textarea', 150.24, y + 19.8425, 379.84, 19.84),
    ]
  })

  const traits = Array.from({ length: 8 }, (_, index) => {
    const number = index + 1
    const row = `qd_${number}`
    const y = 189.92 + index * 76.5354
    return [
      field(`${row}_tipo`, `Tipo do traço ${number}`, 'radio', 65.2, y + 4.44, 140, 15, ['Qualidade', 'Defeito']),
      field(`${row}_nome`, `Nome do traço ${number}`, 'text', 243.78, y, 204.09, 17.01),
      field(`${row}_custo`, `Custo do traço ${number}`, 'text', 459.21, y, 70.87, 17.01),
      field(`${row}_efeito`, `Impacto do traço ${number}`, 'textarea', 189.92, y + 19.8425, 340.16, 19.84),
    ]
  }).flat()

  const techniqueAttributes = techniques.map((_, index) =>
    field(`tecnica_${index + 1}_atributo`, `Atributo da técnica ${index + 1}`, 'select',
      65.2, 231 + index * 76.5354, 125, 17.01, attributeFields.map(({ label }) => label)),
  )

  return {
    version: 2,
    techniques: {
      attributes: Object.fromEntries(attributeFields.map(({ id, label }) => [label, id])),
      rows: techniques.map(([name, level, element, cost, range, effect], index) => ({
        name: name.id, level: level.id, element: element.id, cost: cost.id,
        range: range.id, effect: effect.id, attribute: techniqueAttributes[index].id,
      })),
    },
    pages: [identity, [...techniques.flat(), ...techniqueAttributes], traits].map((fields, index) => ({
      id: stableId(index + 1), width, height: px(841.8898), fields,
    })),
    macros: attributeFields.map(({ id }) => ({
      fieldId: id, event: 'clique',
      action: { kind: 'rolar', groups: [{ count: null, sides: 6, reduction: 'sucesso', success: { min: 5, max: 6 } }], combine: null },
    })),
  }
}

export async function seedShounensDreamSheet(client: PoolClient) {
  const sheet = characterSheet(JSON.stringify(buildSheet())) as PagedSheet
  const backgroundPages = sheet.pages.map((page, index) => ({ ...page, backgroundFile: shounensDreamBackgrounds[index] }))

  // A random hash has no known password. The account also has authentication explicitly disabled.
  const randomHash = `${randomBytes(16).toString('hex')}:${randomBytes(64).toString('hex')}`
  await client.query(
    'INSERT INTO users(id, name, email, password_hash, is_system) VALUES ($1, $2, $3, $4, true) ON CONFLICT (id) DO NOTHING',
    [systemId, 'Sistema', systemEmail, randomHash],
  )
  await client.query(
    "INSERT INTO modelos_ficha(id, owner_id, name, global, sheet) VALUES ($1, $2, $3, 'S', $4) ON CONFLICT (id) DO UPDATE SET sheet=EXCLUDED.sheet WHERE modelos_ficha.owner_id=EXCLUDED.owner_id AND NOT (modelos_ficha.sheet ? 'techniques')",
    [shounensDreamModelId, systemId, "Shounen’s Dream", { ...sheet, pages: backgroundPages }],
  )
}
