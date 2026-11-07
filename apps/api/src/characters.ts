import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { characterSheet, emptySheet, type CharacterSheet } from './character-sheet'
import sanitizeHtml from 'sanitize-html'
import { randomUUID } from 'node:crypto'
import { Database } from './database'
import { Storage } from './storage'
import { layer } from './layers'
import { imageSize } from 'image-size'
import { minimumTokenSize } from './grid'
import { position } from './tabletop-rules'

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export type CharacterRow={id:string;campaign_id:string;owner_id:string;name:string;color:string;description:string;notes:string;sheet:CharacterSheet;sheet_background_file:string|null;description_format:'plain'|'html';notes_format:'plain'|'html';appearance_file:string|null;token_file:string|null}
export type CharacterContext={campaign:{id:string;owner_id:string};user:{id:string};master:boolean;scene:{id:string;cell_size:number;snap:boolean;width:number;height:number;grid_type:string}}
export type CharacterFiles={appearance?:Express.Multer.File[];token?:Express.Multer.File[];sheet?:Express.Multer.File[]}

@Injectable()
export class Characters {
  constructor(private readonly db:Database,private readonly storage:Storage){}

  present(character:CharacterRow){
    const image=(kind:string,file:string|null)=>file?`/api/campaigns/${character.campaign_id}/tabletop/characters/${character.id}/images/${kind}/${file}`:null
    return {id:character.id,owner_id:character.owner_id,name:character.name,color:character.color,description:character.description,notes:character.notes,description_format:character.description_format,notes_format:character.notes_format,sheet:character.sheet,sheet_background_url:image('sheet',character.sheet_background_file),appearance_url:image('appearance',character.appearance_file),token_url:image('token',character.token_file)}
  }

  async find(campaign:string,id:string):Promise<CharacterRow>{
    if(!uuid.test(id))throw new BadRequestException('Personagem inválido.')
    const result=await this.db.pool.query('SELECT * FROM tabletop_characters WHERE id=$1 AND campaign_id=$2',[id,campaign])
    if(!result.rows[0])throw new NotFoundException('Personagem não encontrado nesta campanha.')
    return result.rows[0]
  }

  async save(access:CharacterContext,id:string|undefined,body:Record<string,unknown>,files:CharacterFiles={}){
    const existing=id?await this.find(access.campaign.id,id):undefined
    if(!access.master&&(!existing||existing.owner_id!==access.user.id))throw new ForbiddenException('Você só pode editar personagens sob seu controle.')
    if(!access.master&&body.owner_id!==undefined&&body.owner_id!==existing!.owner_id)throw new ForbiddenException('Somente o mestre pode alterar o controlador.')
    if(body.text_format!==undefined&&!['plain','html'].includes(String(body.text_format)))throw new BadRequestException('Formato de texto inválido.')
    const text=(key:string,max:number)=>{const value=body[key];if(typeof value!=='string'||!value.trim()||value.trim().length>max)throw new BadRequestException(`Campo ${key} inválido.`);return value.trim()}
    for(const key of ['description','notes']){
      if(typeof body[key]==='string')body[key]=(body[key] as string).replace(/\r\n?/g,'\n')
      if(body[key]!==undefined&&(typeof body[key]!=='string'||(body[key] as string).length>20000))throw new BadRequestException(`Campo ${key} inválido: use até 20000 caracteres.`)
      if(body[key]!==undefined&&body.text_format==='html'){body[key]=cleanCharacterHtml(body[key] as string);if((body[key] as string).length>20000)throw new BadRequestException('Texto formatado muito longo.')}
    }
    const sheet=body.sheet===undefined?undefined:characterSheet(body.sheet)
    const name=text('name',40),owner=access.master?text('owner_id',36):existing!.owner_id,color=text('color',7)
    if(!uuid.test(owner)||!/^#[0-9a-f]{6}$/i.test(color))throw new BadRequestException('Cor ou participante inválido.')
    const member=await this.db.pool.query('SELECT id FROM users WHERE id=$1 AND (id=$2 OR EXISTS(SELECT 1 FROM campaign_members WHERE campaign_id=$3 AND user_id=$1))',[owner,access.campaign.owner_id,access.campaign.id])
    if(!member.rowCount)throw new BadRequestException('O controlador precisa participar da campanha.')
    for(const key of ['remove_appearance','remove_token','remove_sheet'])if(body[key]!==undefined&&!['true','false'].includes(String(body[key])))throw new BadRequestException('Opção de imagem inválida.')
    if(id)await this.find(access.campaign.id,id)
    const saved:{kind:'appearance'|'token'|'sheet';category:'outros'|'tokens';name:string}[]=[]
    const old:{category:'outros'|'tokens';name:string}[]=[]
    const client=await this.db.pool.connect()
    try{
      for(const [kind,category] of [['appearance','outros'],['token','tokens'],['sheet','outros']] as const){
        const file=files[kind]?.[0]
        if(file)saved.push({kind,category,name:await this.storage.saveImage(access.campaign.owner_id,access.campaign.id,category,file)})
      }
      await client.query('BEGIN')
      let previous:CharacterRow|undefined
      if(id){previous=(await client.query('SELECT * FROM tabletop_characters WHERE id=$1 AND campaign_id=$2 FOR UPDATE',[id,access.campaign.id])).rows[0];if(!previous)throw new NotFoundException('Personagem não encontrado.');if(!access.master&&previous.owner_id!==access.user.id)throw new ForbiddenException('O controle do personagem mudou.')}
      const appearance=saved.find(file=>file.kind==='appearance')?.name??(String(body.remove_appearance)==='true'?null:previous?.appearance_file??null)
      const token=saved.find(file=>file.kind==='token')?.name??(String(body.remove_token)==='true'?null:previous?.token_file??null)
      const background=saved.find(file=>file.kind==='sheet')?.name??(String(body.remove_sheet)==='true'?null:previous?.sheet_background_file??null)
      const savedSheet=sheet??previous?.sheet??emptySheet()
      const description=body.description??previous?.description??'',notes=body.notes??previous?.notes??''
      const format=(key:'description'|'notes')=>body[key]===undefined?(previous?.[`${key}_format`]??'plain'):(body.text_format==='html'?'html':'plain')
      const descriptionFormat=format('description'),notesFormat=format('notes')
      let character:CharacterRow
      if(previous){
        character=(await client.query('UPDATE tabletop_characters SET name=$1,owner_id=$2,color=$3,appearance_file=$4,token_file=$5,description=$8,notes=$9,description_format=$10,notes_format=$11,sheet=$12::jsonb,sheet_background_file=$13 WHERE id=$6 AND campaign_id=$7 RETURNING *',[name,owner,color,appearance,token,id,access.campaign.id,description,notes,descriptionFormat,notesFormat,JSON.stringify(savedSheet),background])).rows[0]
        await client.query('UPDATE tabletop_tokens SET name=$1,owner_id=$2,color=$3 WHERE character_id=$4 AND campaign_id=$5',[name,owner,color,id,access.campaign.id])
        if(previous.appearance_file&&previous.appearance_file!==appearance)old.push({category:'outros',name:previous.appearance_file})
        if(previous.sheet_background_file&&previous.sheet_background_file!==background)old.push({category:'outros',name:previous.sheet_background_file})
        if(previous.token_file&&previous.token_file!==token)old.push({category:'tokens',name:previous.token_file})
      }else{
        character=(await client.query('INSERT INTO tabletop_characters(id,campaign_id,owner_id,name,color,appearance_file,token_file,description,notes,description_format,notes_format,sheet,sheet_background_file) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13) RETURNING *',[randomUUID(),access.campaign.id,owner,name,color,appearance,token,description,notes,descriptionFormat,notesFormat,JSON.stringify(savedSheet),background])).rows[0]
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

  async mapSize(access:CharacterContext,token:{width:number|null;height:number|null;token_file:string|null}){
    if(access.scene.grid_type==='none')return {width:token.width,height:token.height}
    let width=token.width??access.scene.cell_size*0.8,height=token.height??access.scene.cell_size*0.8
    if(token.width===null&&token.token_file){
      try{
        const file=await this.storage.read(access.campaign.owner_id,access.campaign.id,'tokens',token.token_file)
        try{const size=imageSize(await file.readFile());const scale=access.scene.cell_size*0.8/Math.max(size.width!,size.height!);width=size.width!*scale;height=size.height!*scale}finally{await file.close()}
      }catch{/* A missing image uses the same square fallback as the canvas. */}
    }
    return minimumTokenSize({width,height},access.scene.cell_size,access.scene.grid_type)
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
      const size=await this.mapSize(access,{width:null,height:null,token_file:current.token_file})
      const token=(await client.query('INSERT INTO tabletop_tokens(id,campaign_id,scene_id,character_id,owner_id,name,color,x,y,layer,width,height) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *',[randomUUID(),access.campaign.id,access.scene.id,current.id,current.owner_id,current.name,current.color,coords.x,coords.y,targetLayer,size.width,size.height])).rows[0]
      await client.query('COMMIT');return token
    }catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}

  }


  card(character:CharacterRow){
    const {id,name,color,appearance_url,token_url}=this.present(character)
    return {id,name,color,appearance_url,token_url,description:character.description_format==='html'?cleanCharacterHtml(character.description):plainCharacterHtml(character.description)}
  }

  async presentationEvents(access:CharacterContext,after:unknown){
    if(after!==undefined&&(typeof after!=='string'||!/^\d{1,19}$/.test(after)))throw new BadRequestException('Cursor inválido.')
    // One SQL statement gives the cursor and events the same database snapshot.
    const result=await this.db.pool.query(`WITH heartbeat AS (
      INSERT INTO tabletop_presence(campaign_id,user_id,seen_at) VALUES($1,$2,now())
      ON CONFLICT(campaign_id,user_id) DO UPDATE SET seen_at=now()
    ), latest AS (SELECT COALESCE(MAX(id),0)::text AS cursor FROM tabletop_presentations WHERE campaign_id=$1)
    SELECT cursor,COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id::text,'card',card) ORDER BY id)
      FROM tabletop_presentations WHERE campaign_id=$1 AND $3::numeric IS NOT NULL AND id>$3::numeric
      AND $2::uuid=ANY(recipients) AND created_at>now()-interval '10 seconds'),'[]'::jsonb) AS events FROM latest`,[access.campaign.id,access.user.id,after??null])
    return result.rows[0]
  }

  async showCard(access:CharacterContext,id:string){
    if(!access.master)throw new ForbiddenException('Somente o mestre pode exibir cartões aos jogadores.')
    const character=await this.find(access.campaign.id,id)
    await this.db.pool.query("DELETE FROM tabletop_presentations WHERE campaign_id=$1 AND created_at<now()-interval '1 hour'",[access.campaign.id])
    const result=await this.db.pool.query(`INSERT INTO tabletop_presentations(campaign_id,character_id,recipients,card)
      SELECT $1,$2,COALESCE(array_agg(user_id),'{}'::uuid[]),$3::jsonb FROM tabletop_presence p
      WHERE campaign_id=$1 AND user_id<>$4 AND seen_at>now()-interval '10 seconds'
      AND EXISTS(SELECT 1 FROM campaign_members m WHERE m.campaign_id=$1 AND m.user_id=p.user_id)
      RETURNING id::text,cardinality(recipients) AS recipients`,[access.campaign.id,id,JSON.stringify(this.card(character)),access.user.id])
    return result.rows[0]
  }

  async image(access:CharacterContext,id:string,kind:string,filename:string){
    if(!['appearance','token','sheet'].includes(kind))throw new NotFoundException('Imagem não encontrada.')
    const character=await this.find(access.campaign.id,id)
    const actual=kind==='sheet'?character.sheet_background_file:kind==='appearance'?character.appearance_file:character.token_file
    if(kind==='sheet'&&!access.master&&character.owner_id!==access.user.id)throw new NotFoundException('Imagem não encontrada.')
    if(!actual||actual!==filename)throw new NotFoundException('Imagem não encontrada.')
    if(!access.master&&character.owner_id!==access.user.id){
      const visible=await this.db.pool.query("SELECT id FROM tabletop_tokens WHERE character_id=$1 AND campaign_id=$2 AND scene_id=$3 AND layer<>'mestre' LIMIT 1",[id,access.campaign.id,access.scene.id])
      const shared=await this.db.pool.query("SELECT id FROM tabletop_presentations WHERE campaign_id=$1 AND character_id=$2 AND $3::uuid=ANY(recipients) AND created_at>now()-interval '1 hour' LIMIT 1",[access.campaign.id,id,access.user.id])
      if(!visible.rowCount&&!shared.rowCount)throw new NotFoundException('Imagem não encontrada.')
    }
    return this.storage.read(access.campaign.owner_id,access.campaign.id,kind==='token'?'tokens':'outros',filename)
  }
}

export function cleanCharacterHtml(value:string){
  return sanitizeHtml(value,{allowedTags:['p','div','br','b','strong','i','em','u','s','strike','ul','ol','li','blockquote'],allowedAttributes:{},disallowedTagsMode:'discard'})
}
function plainCharacterHtml(value:string){
  return value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/\n/g,'<br>')
}
