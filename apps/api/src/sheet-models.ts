import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { characterSheet, sheetPageParts, type PagedSheet } from './character-sheet'
import type { CharacterFiles } from './characters'
import { Database } from './database'
import { Storage } from './storage'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
type SheetModel = { id: string; owner_id: string; name: string; global: 'S' | 'N'; sheet: PagedSheet }

@Injectable()
export class SheetModels {
  constructor(private readonly db: Database, private readonly storage: Storage) {}

  async list(userId: string) {
    const { rows } = await this.db.pool.query(
      `SELECT m.id, m.name, m.global, u.name AS author
       FROM modelos_ficha m JOIN users u ON u.id=m.owner_id
       WHERE m.owner_id=$1 OR m.global='S' ORDER BY m.name, m.id`,
      [userId],
    )
    return rows
  }

  async create(userId: string, body: Record<string, unknown>, files: CharacterFiles = {}) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const global = body.global === undefined ? 'N' : body.global
    if (!name || name.length > 80) throw new BadRequestException('Informe um nome de até 80 caracteres para o modelo.')
    if (global !== 'S' && global !== 'N') throw new BadRequestException('A visibilidade deve ser S ou N.')
    const sheet = characterSheet(body.sheet)
    if (sheet.version !== 2 || sheetPageParts.some((part, index) => files[part]?.length && !sheet.pages[index])) {
      throw new BadRequestException('Envie as páginas da ficha e seus respectivos fundos.')
    }

    const id = randomUUID()
    const storedFiles: string[] = []
    try {
      const pages: PagedSheet['pages'] = []
      for (const [index, { removeBackground, ...page }] of sheet.pages.entries()) {
        const upload = files[sheetPageParts[index]]?.[0]
        const backgroundFile = upload ? await this.storage.saveImage(userId, id, 'outros', upload) : undefined
        if (backgroundFile) storedFiles.push(backgroundFile)
        pages.push({
          ...page,
          backgroundFile,
          fields: page.fields.map(field => ({
            ...field,
            value: field.type === 'bar' ? '0' : field.type === 'checkbox' ? 'false' : '',
          })),
        })
      }
      const { rows } = await this.db.pool.query(
        `WITH saved AS (
           INSERT INTO modelos_ficha(id, owner_id, name, global, sheet)
           VALUES ($1, $2, $3, $4, $5) RETURNING id, owner_id, name, global
         )
         SELECT saved.id, saved.name, saved.global, u.name AS author FROM saved JOIN users u ON u.id=saved.owner_id`,
        [id, userId, name, global, { ...sheet, pages }],
      )
      return rows[0]
    } catch (error) {
      for (const filename of storedFiles) {
        try { await this.storage.remove(userId, id, 'outros', filename) }
        catch { console.warn('Não foi possível limpar a imagem do modelo de ficha.') }
      }
      throw error
    }
  }

  private async find(userId: string, id: string): Promise<SheetModel> {
    if (!uuid.test(id)) throw new NotFoundException('Modelo de ficha não encontrado.')
    const { rows } = await this.db.pool.query<SheetModel>(
      "SELECT * FROM modelos_ficha WHERE id=$1 AND (owner_id=$2 OR global='S')",
      [id, userId],
    )
    if (!rows[0]) throw new NotFoundException('Modelo de ficha não encontrado.')
    return rows[0]
  }

  async detail(userId: string, id: string) {
    const { sheet } = await this.find(userId, id)
    return {
      ...sheet,
      pages: sheet.pages.map(({ backgroundFile, ...page }) => ({
        ...page,
        backgroundUrl: backgroundFile ? `/api/modelos-ficha/${id}/fundos/${page.id}` : null,
      })),
    }
  }

  async background(userId: string, id: string, pageId: string) {
    const model = await this.find(userId, id)
    const filename = model.sheet.pages.find(page => page.id === pageId)?.backgroundFile
    if (!filename) throw new NotFoundException('Fundo do modelo não encontrado.')
    return { filename, file: await this.storage.read(model.owner_id, id, 'outros', filename) }
  }
}
