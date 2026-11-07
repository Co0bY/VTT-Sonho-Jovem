import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common'
import { mkdir, writeFile, unlink, open } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { imageSize } from 'image-size'

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
@Injectable()
export class Storage {
  readonly root = resolve(process.env.STORAGE_ROOT || resolve(__dirname, '../../..', 'storage'))
  private directory(owner: string, campaign: string, category: 'cenarios' | 'tokens' | 'outros') {
    if (!uuid.test(owner) || !uuid.test(campaign)) throw new BadRequestException('Destino de armazenamento inválido.')
    return join(this.root, owner, campaign, category)
  }
  private filename(name: string) {
    if (!/^[a-f0-9-]{36}\.(png|jpg|webp)$/.test(name)) throw new BadRequestException('Arquivo inválido.')
    return name
  }
  async saveImage(owner: string, campaign: string, category: 'cenarios' | 'tokens' | 'outros', file: Express.Multer.File | undefined) {
    if (!file?.buffer?.length) throw new BadRequestException('Selecione uma imagem PNG, JPEG ou WebP.')
    if (file.buffer.length > MAX_IMAGE_BYTES) throw new BadRequestException('A imagem deve ter no máximo 10 MB.')
    let image
    try { image = imageSize(file.buffer) } catch { throw new BadRequestException('O arquivo não é uma imagem válida.') }
    const types: Record<string, { extension: string; mime: string }> = { png: { extension: 'png', mime: 'image/png' }, jpg: { extension: 'jpg', mime: 'image/jpeg' }, webp: { extension: 'webp', mime: 'image/webp' } }
    const type = image.type && types[image.type]
    if (!type || file.mimetype !== type.mime) throw new BadRequestException('Envie uma imagem PNG, JPEG ou WebP com formato válido.')
    if (!image.width || !image.height || image.width > 8192 || image.height > 8192 || image.width * image.height > 32_000_000) throw new BadRequestException('Use uma imagem de até 8192 pixels por lado e 32 megapixels.')
    for (const item of ['cenarios', 'tokens', 'outros']) await mkdir(join(this.root, owner, campaign, item), { recursive: true })
    const name = `${randomUUID()}.${type.extension}`
    await writeFile(join(this.directory(owner, campaign, category), name), file.buffer, { flag: 'wx' })
    return name
  }
  async remove(owner: string, campaign: string, category: 'cenarios' | 'tokens' | 'outros', name: string) {
    try { await unlink(join(this.directory(owner, campaign, category), this.filename(name))) } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
  }
  async read(owner: string, campaign: string, category: 'cenarios' | 'tokens' | 'outros', name: string) {
    try { return await open(join(this.directory(owner, campaign, category), this.filename(name)), 'r') } catch { throw new NotFoundException('Imagem não encontrada.') }
  }
}
