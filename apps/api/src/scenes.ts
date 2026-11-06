import { BadRequestException, Injectable, NotFoundException, ConflictException } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { Database } from './database'
import { integer } from './tabletop-rules'
import { sceneSize, sceneError } from './scene-dimensions'
export const UNITS = ['mm','cm','m','km','in','ft','yd','mi']
export type SceneRow = { width:number;height:number;id: string; campaign_id: string; name: string; cell_size: number; grid_visible: boolean; snap: boolean; distance_per_cell: number; distance_unit: string; background_file: string | null; background_transform: {x:number;y:number;width:number;height:number} | null }
@Injectable()
export class Scenes {
  constructor(private readonly db: Database) {}
  async active(campaign: string): Promise<SceneRow> {
    const client = await this.db.pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('SELECT id FROM campaigns WHERE id=$1 FOR UPDATE', [campaign])
      let result = await client.query('SELECT s.* FROM tabletop_scenes s JOIN tabletop_active_scenes a ON a.scene_id=s.id WHERE a.campaign_id=$1', [campaign])
      if (!result.rows[0]) {
        result = await client.query('SELECT * FROM tabletop_scenes WHERE campaign_id=$1 ORDER BY created_at,id LIMIT 1',[campaign])
        if (!result.rows[0]) result = await client.query('INSERT INTO tabletop_scenes(id,campaign_id) VALUES($1,$2) RETURNING *', [randomUUID(), campaign])
        await client.query('INSERT INTO tabletop_active_scenes VALUES($1,$2)', [campaign,result.rows[0].id])
      }
      await client.query('COMMIT'); return result.rows[0]
    } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
  }
  async find(campaign: string, scene: string): Promise<SceneRow> {
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(scene)) throw new BadRequestException('Cenário inválido.')
    const { rows } = await this.db.pool.query('SELECT * FROM tabletop_scenes WHERE id=$1 AND campaign_id=$2', [scene,campaign])
    if (!rows[0]) throw new NotFoundException('Cenário não encontrado nesta mesa.')
    return rows[0]
  }
  present(scene: SceneRow) {
    return { id: scene.id, name: scene.name, cell_size: scene.cell_size, grid_visible: scene.grid_visible, snap: scene.snap, distance_per_cell: scene.distance_per_cell, distance_unit: scene.distance_unit, width: scene.width, height: scene.height, columns: Math.ceil(scene.width/scene.cell_size), rows:Math.ceil(scene.height/scene.cell_size),
      background_transform: scene.background_transform, background_url: scene.background_file ? `/api/campaigns/${scene.campaign_id}/tabletop/scenes/${scene.id}/background/${scene.background_file}` : null }
  }
  async update(campaign: string, sceneId: string, body: Record<string, unknown>) {
    const current = await this.find(campaign,sceneId)
    const size=sceneSize(body,current)
    const cell = integer(body?.cell_size,32,128,'Tamanho do grid')
    const name = body?.name === undefined ? current.name : body.name
    const distance = body?.distance_per_cell === undefined ? current.distance_per_cell : body.distance_per_cell
    const unit = body?.distance_unit === undefined ? current.distance_unit : body.distance_unit
    if (typeof name !== 'string' || !name.trim() || name.trim().length>100) throw new BadRequestException('Nome de cenário inválido.')
    if (typeof distance !== 'number' || !Number.isFinite(distance) || distance<=0 || distance>1e9) throw new BadRequestException('A distância por quadrado deve ser maior que zero e no máximo 1 bilhão.')
    if (typeof unit !== 'string' || !UNITS.includes(unit)) throw new BadRequestException('Unidade de distância inválida.')
    if (typeof body?.grid_visible !== 'boolean' || typeof body?.snap !== 'boolean') throw new BadRequestException('Configuração de grid inválida.')
    try { await this.db.pool.query('UPDATE tabletop_scenes SET name=$1,cell_size=$2,grid_visible=$3,snap=$4,distance_per_cell=$5,distance_unit=$6,width=$9,height=$10 WHERE id=$7 AND campaign_id=$8', [name.trim(),cell,body.grid_visible,body.snap,distance,unit,sceneId,campaign,size.width,size.height]) } catch(error) { if((error as {code?:string}).code==='23505') throw new ConflictException('Já existe um cenário com esse nome nesta mesa.');sceneError(error) }
    return { ok: true }
  }
}
