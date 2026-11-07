import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { Database } from './database'
import { Storage } from './storage'
import { layer } from './layers'
import { position } from './tabletop-rules'

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export type CharacterRow={id:string;campaign_id:string;owner_id:string;name:string;color:string;appearance_file:string|null;token_file:string|null}
export type CharacterContext={campaign:{id:string;owner_id:string};user:{id:string};master:boolean;scene:{id:string;cell_size:number;snap:boolean;width:number;height:number;grid_type:string}}
export type CharacterFiles={appearance?:Express.Multer.File[];token?:Express.Multer.File[]}

@Injectable()
export class Characters {
  constructor(private readonly db:Database,private readonly storage:Storage){}

  present(character:CharacterRow){
    const image=(kind:string,file:string|null)=>file?`/api/campaigns/${character.campaign_id}/tabletop/characters/${character.id}/images/${kind}/${file}`:null
    return {id:character.id,owner_id:character.owner_id,name:character.name,color:character.color,appearance_url:image('appearance',character.appearance_file),token_url:image('token',character.token_file)}
  }

  async find(campaign:string,id:string):Promise<CharacterRow>{
    if(!uuid.test(id))throw new BadRequestException('Personagem inválido.')
    const result=await this.db.pool.query('SELECT * FROM tabletop_characters WHERE id=$1 AND campaign_id=$2',[id,campaign])
    if(!result.rows[0])throw new NotFoundException('Personagem não encontrado nesta campanha.')
    return result.rows[0]
  }

  async save(access:CharacterContext,id:string|undefined,body:Record<string,unknown>,files:CharacterFiles={}){
    if(!access.master)throw new ForbiddenException('Somente o mestre pode criar ou editar personagens.')
    const text=(key:string,max:number)=>{const value=body[key];if(typeof value!=='string'||!value.trim()||value.trim().length>max)throw new BadRequestException(`Campo ${key} inválido.`);return value.trim()}
    const name=text('name',40),owner=text('owner_id',36),color=text('color',7)
    if(!uuid.test(owner)||!/^#[0-9a-f]{6}$/i.test(color))throw new BadRequestException('Cor ou participante inválido.')
    const member=await this.db.pool.query('SELECT id FROM users WHERE id=$1 AND (id=$2 OR EXISTS(SELECT 1 FROM campaign_members WHERE campaign_id=$3 AND user_id=$1))',[owner,access.campaign.owner_id,access.campaign.id])
    if(!member.rowCount)throw new BadRequestException('O controlador precisa participar da campanha.')
    for(const key of ['remove_appearance','remove_token'])if(body[key]!==undefined&&!['true','false'].includes(String(body[key])))throw new BadRequestException('Opção de imagem inválida.')
    if(id)await this.find(access.campaign.id,id)
    const saved:{category:'outros'|'tokens';name:string}[]=[]
    const old:{category:'outros'|'tokens';name:string}[]=[]
    const client=await this.db.pool.connect()
    try{
      for(const [kind,category] of [['appearance','outros'],['token','tokens']] as const){
        const file=files[kind]?.[0]
        if(file)saved.push({category,name:await this.storage.saveImage(access.campaign.owner_id,access.campaign.id,category,file)})
      }
      await client.query('BEGIN')
      let previous:CharacterRow|undefined
      if(id){previous=(await client.query('SELECT * FROM tabletop_characters WHERE id=$1 AND campaign_id=$2 FOR UPDATE',[id,access.campaign.id])).rows[0];if(!previous)throw new NotFoundException('Personagem não encontrado.')}
      const appearance=saved.find(file=>file.category==='outros')?.name??(String(body.remove_appearance)==='true'?null:previous?.appearance_file??null)
      const token=saved.find(file=>file.category==='tokens')?.name??(String(body.remove_token)==='true'?null:previous?.token_file??null)
      let character:CharacterRow
      if(previous){
        character=(await client.query('UPDATE tabletop_characters SET name=$1,owner_id=$2,color=$3,appearance_file=$4,token_file=$5 WHERE id=$6 AND campaign_id=$7 RETURNING *',[name,owner,color,appearance,token,id,access.campaign.id])).rows[0]
        await client.query('UPDATE tabletop_tokens SET name=$1,owner_id=$2,color=$3 WHERE character_id=$4 AND campaign_id=$5',[name,owner,color,id,access.campaign.id])
        if(previous.appearance_file&&previous.appearance_file!==appearance)old.push({category:'outros',name:previous.appearance_file})
        if(previous.token_file&&previous.token_file!==token)old.push({category:'tokens',name:previous.token_file})
      }else{
        character=(await client.query('INSERT INTO tabletop_characters(id,campaign_id,owner_id,name,color,appearance_file,token_file) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',[randomUUID(),access.campaign.id,owner,name,color,appearance,token])).rows[0]
      }
      await client.query('COMMIT')
      for(const file of old)await this.cleanup(access,file)
      return this.present(character)
    }catch(error){
      await client.query('ROLLBACK')
      for(const file of saved)await this.cleanup(access,file)
      throw error
    }finally{client.release()}
  }

  private async cleanup(access:CharacterContext,file:{category:'outros'|'tokens';name:string}){
    try{await this.storage.remove(access.campaign.owner_id,access.campaign.id,file.category,file.name)}catch{console.warn('Não foi possível limpar uma imagem de personagem.')}
  }

  async place(access:CharacterContext,id:string,body:Record<string,unknown>){
    if(!access.master)throw new ForbiddenException('Somente o mestre pode adicionar personagens ao mapa.')
    const character=await this.find(access.campaign.id,id)
    const coords=position(body.x,body.y,access.scene.cell_size,access.scene.snap,access.scene.width,access.scene.height,access.scene.grid_type)
    const targetLayer=layer(body.layer??'geral')
    const client=await this.db.pool.connect()
    try{
      await client.query('BEGIN')
      const current=(await client.query('SELECT * FROM tabletop_characters WHERE id=$1 AND campaign_id=$2 FOR SHARE',[character.id,access.campaign.id])).rows[0]
      if(!current)throw new NotFoundException('Personagem não encontrado.')
      const token=(await client.query('INSERT INTO tabletop_tokens(id,campaign_id,scene_id,character_id,owner_id,name,color,x,y,layer) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',[randomUUID(),access.campaign.id,access.scene.id,current.id,current.owner_id,current.name,current.color,coords.x,coords.y,targetLayer])).rows[0]
      await client.query('COMMIT');return token
    }catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}

  }

  async image(access:CharacterContext,id:string,kind:string,filename:string){
    if(!['appearance','token'].includes(kind))throw new NotFoundException('Imagem não encontrada.')
    const character=await this.find(access.campaign.id,id)
    const actual=kind==='appearance'?character.appearance_file:character.token_file
    if(!actual||actual!==filename)throw new NotFoundException('Imagem não encontrada.')
    if(!access.master&&character.owner_id!==access.user.id){
      const visible=await this.db.pool.query("SELECT id FROM tabletop_tokens WHERE character_id=$1 AND campaign_id=$2 AND scene_id=$3 AND layer<>'mestre' LIMIT 1",[id,access.campaign.id,access.scene.id])
      if(!visible.rowCount)throw new NotFoundException('Imagem não encontrada.')
    }
    return this.storage.read(access.campaign.owner_id,access.campaign.id,kind==='appearance'?'outros':'tokens',filename)
  }
}
