import { Body, Controller, Get, Post, Param, Req, Res, Injectable, Module, UnauthorizedException, BadRequestException, ForbiddenException, ConflictException, NotFoundException, HttpException, UseInterceptors, UploadedFile, UploadedFiles, StreamableFile } from '@nestjs/common'
import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { Database } from './database'
import { Scenes } from './scenes'
import { Storage, MAX_IMAGE_BYTES } from './storage'
import { sceneSize, sceneError } from './scene-dimensions'
import { layer, bounds, normalizeRotation } from './layers'
import { imageSize } from 'image-size'
import { Characters, type CharacterFiles } from './characters'
import { FileInterceptor, FileFieldsInterceptor } from '@nestjs/platform-express'
import { Mailer } from './mailer'
import { position, rollDice, integer } from './tabletop-rules'

const derive = promisify(scrypt)
const digest = (value: string) => createHash('sha256').update(value).digest('hex')
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// Small structural interfaces avoid coupling application code to Express types.
type Request = { headers: Record<string, string | undefined>; ip: string }
type Response = { setHeader(name: string, value: string): void }
function field(body: unknown, key: string, min: number, max: number, trim = true) {
  const value = body && typeof body === 'object' ? (body as Record<string, unknown>)[key] : undefined
  if (typeof value !== 'string') throw new BadRequestException(`Campo inválido: ${key}`)
  const result = trim ? value.trim() : value
  if (result.length < min || result.length > max) throw new BadRequestException(`Campo ${key}: use entre ${min} e ${max} caracteres.`)
  return result
}
function sessionToken(req: Request) { return /(?:^|;\s*)vtt_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1] || '' }
function cookie(res: Response, token: string, age: number) {
  res.setHeader('Set-Cookie', `vtt_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${age}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`)
  res.setHeader('Cache-Control', 'no-store')
}
@Injectable()
class Accounts {
  constructor(readonly db: Database) {}
  private attempts = new Map<string, { count: number; until: number }>()
  mutation(req: Request, limited = false) {
    const origin = req.headers.origin
    if (origin && origin !== (process.env.WEB_ORIGIN || 'http://127.0.0.1:9000') && !(process.env.NODE_ENV !== 'production' && origin === 'http://localhost:9000')) throw new ForbiddenException('Origem não permitida')
    if (!limited) return
    const now = Date.now()
    for (const [key, value] of this.attempts) if (value.until < now) this.attempts.delete(key)
    const key = req.ip || 'local'
    const entry = this.attempts.get(key) || { count: 0, until: now + 900_000 }
    this.attempts.set(key, entry)
    if (++entry.count > 30) throw new HttpException('Muitas tentativas. Aguarde 15 minutos.', 429)
  }
  async user(req: Request) {
    const result = await this.db.pool.query(`SELECT u.id, u.name, u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()`, [digest(sessionToken(req))])
    if (!result.rows[0]) throw new UnauthorizedException('Entre na sua conta para continuar.')
    return result.rows[0] as { id: string; name: string; email: string }
  }
  async session(userId: string, res: Response) {
    const token = randomBytes(32).toString('hex')
    await this.db.pool.query('DELETE FROM sessions WHERE expires_at <= now()')
    await this.db.pool.query(`INSERT INTO sessions VALUES ($1,$2,now()+interval '7 days')`, [digest(token), userId])
    cookie(res, token, 604800)
  }
}
@Controller()
class ApiController {
  constructor(private readonly accounts: Accounts, private readonly db: Database, private readonly mailer: Mailer, private readonly scenes: Scenes, private readonly storage: Storage, private readonly characters:Characters) {}
  @Get('health') async health() { await this.db.pool.query('SELECT 1'); return { status: 'ok', database: 'up' } }
  @Get('auth/me') async me(@Req() req: Request, @Res({ passthrough: true }) res: Response) { res.setHeader('Cache-Control', 'no-store'); return this.accounts.user(req) }
  @Post('auth/register') async register(@Body() body: unknown, @Req() req: Request) {
    this.accounts.mutation(req, true)
    const name = field(body, 'name', 2, 80)
    const email = field(body, 'email', 3, 254).toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('Informe um e-mail válido.')
    const invitation = body && typeof body === 'object' ? (body as Record<string, unknown>).invitation : undefined
    const client = await this.db.pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('INSERT INTO users(id,name,email) VALUES($1,$2,$3) ON CONFLICT(email) DO NOTHING', [randomUUID(), name, email])
      const { rows } = await client.query('SELECT id,password_hash FROM users WHERE email=$1 FOR UPDATE', [email])
      if (rows[0].password_hash) throw new ConflictException('Este e-mail já está cadastrado. Entre na sua conta.')
      const token = randomBytes(32).toString('hex')
      await client.query(`INSERT INTO password_setup_tokens VALUES($1,$2,now()+interval '48 hours')
        ON CONFLICT(user_id) DO UPDATE SET token_hash=excluded.token_hash, expires_at=excluded.expires_at`, [digest(token), rows[0].id])
      await this.mailer.firstAccess(email, token, typeof invitation === 'string' ? invitation : undefined)
      await client.query('COMMIT')
      return { message: 'Enviamos um link para seu e-mail. Defina sua senha em até 2 dias para acessar sua conta.' }
    } catch (error) { await client.query('ROLLBACK'); throw error }
    finally { client.release() }
  }
  @Post('auth/forgot-password') async forgotPassword(@Body() body: unknown, @Req() req: Request) {
    this.accounts.mutation(req, true)
    const email = field(body, 'email', 3, 254).toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('Informe um e-mail válido.')
    const client = await this.db.pool.connect()
    try {
      await client.query('BEGIN')
      const { rows } = await client.query('SELECT id FROM users WHERE email=$1 AND password_hash IS NOT NULL FOR UPDATE', [email])
      if (rows[0]) {
        const token = randomBytes(32).toString('hex')
        await client.query(`INSERT INTO password_reset_tokens VALUES($1,$2,now()+interval '1 hour')
          ON CONFLICT(user_id) DO UPDATE SET token_hash=excluded.token_hash, expires_at=excluded.expires_at`, [digest(token), rows[0].id])
        await this.mailer.passwordReset(email, token)
      }
      await client.query('COMMIT')
      return { message: 'Se houver uma conta ativada com este e-mail, você receberá um link para redefinir sua senha. Verifique sua caixa de entrada.' }
    } catch (error) { await client.query('ROLLBACK'); throw error }
    finally { client.release() }
  }
  @Post('auth/first-access') async firstAccess(@Body() body: unknown, @Req() req: Request) {
    return this.setPassword(body, req, false)
  }
  @Post('auth/reset-password') async resetPassword(@Body() body: unknown, @Req() req: Request) {
    return this.setPassword(body, req, true)
  }
  private async setPassword(body: unknown, req: Request, reset: boolean) {
    this.accounts.mutation(req, true)
    const token = field(body, 'token', 64, 64)
    if (!/^[a-f0-9]{64}$/.test(token)) throw new BadRequestException('Link inválido, expirado ou já utilizado.')
    const password = field(body, 'password', 10, 128, false)
    const confirmation = field(body, 'confirmation', 10, 128, false)
    if (password !== confirmation) throw new BadRequestException('As senhas não conferem.')
    const salt = randomBytes(16).toString('hex')
    const hash = await derive(password, salt, 64) as Buffer
    const client = await this.db.pool.connect()
    const table = reset ? 'password_reset_tokens' : 'password_setup_tokens'
    try {
      await client.query('BEGIN')
      // Lock user before token, matching registration lock order and avoiding resend deadlocks.
      await client.query(`SELECT id FROM users WHERE id=(SELECT user_id FROM ${table} WHERE token_hash=$1) FOR UPDATE`, [digest(token)])
      // DELETE serializes concurrent consumption: exactly one request obtains the token.
      const { rows } = await client.query(`DELETE FROM ${table} WHERE token_hash=$1 AND expires_at>now() RETURNING user_id`, [digest(token)])
      if (!rows[0]) throw new BadRequestException(reset ? 'Link inválido, expirado ou já utilizado. Solicite uma nova redefinição de senha.' : 'Link inválido, expirado ou já utilizado. Cadastre seu nome e e-mail novamente para receber outro link.')
      const updated = await client.query(`UPDATE users SET password_hash=$1 WHERE id=$2 AND password_hash IS ${reset ? 'NOT ' : ''}NULL RETURNING id`, [`${salt}:${hash.toString('hex')}`, rows[0].user_id])
      if (!updated.rowCount) throw new BadRequestException('Esta conta já foi ativada. Entre com sua senha.')
      await client.query('DELETE FROM sessions WHERE user_id=$1', [rows[0].user_id])
      await client.query('COMMIT')
      return { message: reset ? 'Senha redefinida! Entre com seu e-mail e sua nova senha.' : 'Senha definida! Entre com seu e-mail e sua nova senha.' }
    } catch (error) { await client.query('ROLLBACK'); throw error }
    finally { client.release() }
  }
  @Post('auth/login') async login(@Body() body: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.accounts.mutation(req, true)
    const email = field(body, 'email', 3, 254).toLowerCase()
    const password = field(body, 'password', 1, 128, false)
    const { rows } = await this.db.pool.query('SELECT * FROM users WHERE email=$1', [email])
    const user = rows[0]
    const [salt, expected] = (user?.password_hash || `${'0'.repeat(32)}:${'0'.repeat(128)}`).split(':')
    const actual = await derive(password, salt, 64) as Buffer
    if (!user?.password_hash || !timingSafeEqual(actual, Buffer.from(expected, 'hex'))) throw new UnauthorizedException('E-mail ou senha incorretos.')
    await this.accounts.session(user.id, res)
    return { id: user.id, name: user.name, email: user.email }
  }
  @Post('auth/logout') async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.accounts.mutation(req)
    await this.db.pool.query('DELETE FROM sessions WHERE token_hash=$1', [digest(sessionToken(req))])
    cookie(res, '', 0); return { ok: true }
  }
  @Get('campaigns') async campaigns(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store')
    const user = await this.accounts.user(req)
    return (await this.db.pool.query(`SELECT c.*, CASE WHEN c.owner_id=$1 THEN 'mestre' ELSE 'jogador' END AS role,
      (SELECT count(*)::int FROM campaign_members m WHERE m.campaign_id=c.id)+1 AS participants
      FROM campaigns c WHERE c.owner_id=$1 OR EXISTS(SELECT 1 FROM campaign_members m WHERE m.campaign_id=c.id AND m.user_id=$1) ORDER BY c.created_at DESC`, [user.id])).rows
  }
  @Post('campaigns') async create(@Body() body: unknown, @Req() req: Request) {
    this.accounts.mutation(req)
    const user = await this.accounts.user(req)
    return (await this.db.pool.query('INSERT INTO campaigns(id,owner_id,name,description,system) VALUES($1,$2,$3,$4,$5) RETURNING *', [randomUUID(), user.id, field(body, 'name', 2, 100), field(body, 'description', 0, 1000), field(body, 'system', 2, 80)])).rows[0]
  }
  private async tableAccess(id: string, req: Request) {
    const user = await this.accounts.user(req)
    if (!uuid.test(id)) throw new BadRequestException('Mesa inválida.')
    const { rows } = await this.db.pool.query(`SELECT c.id,c.name,c.system,c.owner_id,c.description FROM campaigns c
      WHERE c.id=$1 AND (c.owner_id=$2 OR EXISTS(SELECT 1 FROM campaign_members m WHERE m.campaign_id=c.id AND m.user_id=$2))`, [id, user.id])
    if (!rows[0]) throw new ForbiddenException('Você não participa desta mesa.')
    return { user, campaign: rows[0], master: rows[0].owner_id === user.id, scene: await this.scenes.active(id) }
  }
  @Get('campaigns/:id/tabletop') async tabletop(@Param('id') id: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store')
    const access = await this.tableAccess(id, req)
    const [sceneList, tokens, messages, members, objects, folders, characters] = await Promise.all([
      this.db.pool.query('SELECT * FROM tabletop_scenes WHERE campaign_id=$1 AND ($2::boolean OR id=$3) ORDER BY created_at,id', [id, access.master, access.scene.id]),
      this.db.pool.query("SELECT t.id,t.character_id,t.owner_id,t.name,t.color,t.x,t.y,t.width,t.height,t.rotation,t.layer,c.token_file FROM tabletop_tokens t JOIN tabletop_characters c ON c.id=t.character_id AND c.campaign_id=t.campaign_id WHERE t.campaign_id=$1 AND t.scene_id=$2 AND ($3::boolean OR t.layer<>'mestre') ORDER BY t.created_at,t.id", [id,access.scene.id,access.master]),
      this.db.pool.query(`SELECT * FROM (SELECT m.id::text,m.content,m.roll,m.created_at,u.name AS author,u.id AS user_id FROM tabletop_messages m
        JOIN users u ON u.id=m.user_id WHERE m.campaign_id=$1 ORDER BY m.id DESC LIMIT 100) latest ORDER BY created_at,id::bigint`, [id]),
      this.db.pool.query(`SELECT u.id,u.name,CASE WHEN u.id=$2 THEN 'mestre' ELSE 'jogador' END AS role FROM users u
        WHERE u.id=$2 OR EXISTS(SELECT 1 FROM campaign_members m WHERE m.campaign_id=$1 AND m.user_id=u.id) ORDER BY u.name`, [id, access.campaign.owner_id]),
      this.db.pool.query("SELECT id,name,layer,x,y,width,height,rotation FROM tabletop_objects WHERE campaign_id=$1 AND scene_id=$2 AND ($3::boolean OR layer<>'mestre') ORDER BY created_at,id",[id,access.scene.id,access.master]),
      this.db.pool.query('SELECT id,name FROM tabletop_scene_folders WHERE campaign_id=$1 AND $2::boolean ORDER BY lower(name),id',[id,access.master]),
      this.db.pool.query('SELECT * FROM tabletop_characters WHERE campaign_id=$1 AND ($2::boolean OR owner_id=$3) ORDER BY created_at,id',[id,access.master,access.user.id]),
    ])
    return { characters:characters.rows.map(character=>this.characters.present(character)), folders:folders.rows, campaign: access.campaign, user: access.user, role: access.master ? 'mestre' : 'jogador', scene: this.scenes.present(access.scene), scenes: sceneList.rows.map(scene => this.scenes.present(scene)), tokens: tokens.rows.map(({token_file,...token})=>({...token,token_url:token_file?`/api/campaigns/${id}/tabletop/characters/${token.character_id}/images/token/${token_file}`:null})), objects: objects.rows.map(object=>({...object,image_url:`/api/campaigns/${id}/tabletop/objects/${object.id}/image`})), messages: messages.rows, members: members.rows }
  }
  @Post('campaigns/:id/tabletop/settings') async tableSettings(@Param('id') id: string, @Body() body: Record<string, unknown>, @Req() req: Request) {
    this.accounts.mutation(req)
    const access = await this.tableAccess(id, req)
    if (!access.master) throw new ForbiddenException('Somente o mestre pode configurar o grid.')
    return this.scenes.update(id,access.scene.id,body)
  }
  @Post('campaigns/:id/tabletop/scenes') async createScene(@Param('id') id: string, @Body() body: unknown, @Req() req: Request) {
    this.accounts.mutation(req)
    const access = await this.tableAccess(id,req)
    if (!access.master) throw new ForbiddenException('Somente o mestre pode criar cenários.')
    const name = field(body,'name',1,100)
    const size=sceneSize(body as Record<string,unknown>,{width:3200,height:2200})
    const folder=await this.scenes.folderId(id,(body as Record<string,unknown>)?.folder_id)
    const cell=integer((body as Record<string,unknown>)?.cell_size??64,32,128,'Tamanho do grid')
    try {
      const result = await this.db.pool.query('INSERT INTO tabletop_scenes(id,campaign_id,name,width,height,cell_size,folder_id) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',[randomUUID(),id,name,size.width,size.height,cell,folder])
      return this.scenes.present(result.rows[0])
    } catch(error) { if((error as {code?:string}).code==='23505') throw new ConflictException('Já existe um cenário com esse nome nesta mesa.');sceneError(error) }
  }
  @Post('campaigns/:id/tabletop/folders') async createFolder(@Param('id') id:string,@Body() body:unknown,@Req() req:Request){
    this.accounts.mutation(req);const access=await this.tableAccess(id,req)
    if(!access.master)throw new ForbiddenException('Somente o mestre pode organizar cenários.')
    const name=field(body,'name',1,100)
    try{const result=await this.db.pool.query('INSERT INTO tabletop_scene_folders(id,campaign_id,name) VALUES($1,$2,$3) RETURNING id,name',[randomUUID(),id,name]);return result.rows[0]}
    catch(error){if((error as {code?:string}).code==='23505')throw new ConflictException('Já existe uma pasta com esse nome nesta mesa.');throw error}
  }
  @Post('campaigns/:id/tabletop/folders/:folderId/settings') async renameFolder(@Param('id') id:string,@Param('folderId') folderId:string,@Body() body:unknown,@Req() req:Request){
    this.accounts.mutation(req);const access=await this.tableAccess(id,req)
    if(!access.master)throw new ForbiddenException('Somente o mestre pode organizar cenários.')
    await this.scenes.folderId(id,folderId);const name=field(body,'name',1,100)
    try{const result=await this.db.pool.query('UPDATE tabletop_scene_folders SET name=$1 WHERE id=$2 AND campaign_id=$3 RETURNING id',[name,folderId,id]);if(!result.rowCount)throw new NotFoundException('Pasta não encontrada.');return {ok:true}}
    catch(error){if((error as {code?:string}).code==='23505')throw new ConflictException('Já existe uma pasta com esse nome nesta mesa.');throw error}
  }
  @Post('campaigns/:id/tabletop/folders/:folderId/remove') async removeFolder(@Param('id') id:string,@Param('folderId') folderId:string,@Req() req:Request){
    this.accounts.mutation(req);const access=await this.tableAccess(id,req)
    if(!access.master)throw new ForbiddenException('Somente o mestre pode organizar cenários.')
    await this.scenes.folderId(id,folderId)
    const result=await this.db.pool.query('DELETE FROM tabletop_scene_folders WHERE id=$1 AND campaign_id=$2 RETURNING id',[folderId,id])
    if(!result.rowCount)throw new NotFoundException('Pasta não encontrada.')
    return {ok:true}
  }
  @Post('campaigns/:id/tabletop/scenes/:sceneId/folder') async moveSceneFolder(@Param('id') id:string,@Param('sceneId') sceneId:string,@Body() body:Record<string,unknown>,@Req() req:Request){
    this.accounts.mutation(req);const access=await this.tableAccess(id,req)
    if(!access.master)throw new ForbiddenException('Somente o mestre pode organizar cenários.')
    await this.scenes.find(id,sceneId)
    if(body.folder_id===undefined)throw new BadRequestException('Selecione uma pasta ou Sem pasta.')
    const folder=await this.scenes.folderId(id,body.folder_id)
    try{const result=await this.db.pool.query('UPDATE tabletop_scenes SET folder_id=$1 WHERE id=$2 AND campaign_id=$3 RETURNING id',[folder,sceneId,id]);if(!result.rowCount)throw new NotFoundException('Cenário não encontrado.')}catch(error){sceneError(error)}
    return {ok:true}
  }
  @Post('campaigns/:id/tabletop/scenes/:sceneId/settings') async updateScene(@Param('id') id: string, @Param('sceneId') sceneId: string, @Body() body: Record<string,unknown>, @Req() req: Request) {
    this.accounts.mutation(req)
    const access = await this.tableAccess(id,req)
    if (!access.master) throw new ForbiddenException('Somente o mestre pode configurar cenários.')
    return this.scenes.update(id,sceneId,body)
  }
  @Post('campaigns/:id/tabletop/scenes/:sceneId/activate') async activateScene(@Param('id') id: string, @Param('sceneId') sceneId: string, @Req() req: Request) {
    this.accounts.mutation(req)
    const access = await this.tableAccess(id,req)
    if (!access.master) throw new ForbiddenException('Somente o mestre pode exibir outro cenário.')
    await this.scenes.find(id,sceneId)
    await this.db.pool.query('UPDATE tabletop_active_scenes SET scene_id=$1 WHERE campaign_id=$2',[sceneId,id])
    return { ok:true }
  }
  @Post('campaigns/:id/tabletop/scenes/:sceneId/background')
  @UseInterceptors(FileInterceptor('image',{ limits: { fileSize: MAX_IMAGE_BYTES, files:1, fields:0 } }))
  async uploadBackground(@Param('id') id: string, @Param('sceneId') sceneId: string, @UploadedFile() file: Express.Multer.File | undefined, @Req() req: Request) {
    this.accounts.mutation(req)
    const access = await this.tableAccess(id,req)
    if (!access.master) throw new ForbiddenException('Somente o mestre pode enviar imagens de cenários.')
    await this.scenes.find(id,sceneId)
    const filename = await this.storage.saveImage(access.campaign.owner_id,id,'cenarios',file)
    const client = await this.db.pool.connect().catch(async error => {
      await this.storage.remove(access.campaign.owner_id,id,'cenarios',filename)
      throw error
    })
    let previous: string | null = null
    try {
      await client.query('BEGIN')
      const locked = await client.query('SELECT background_file FROM tabletop_scenes WHERE id=$1 AND campaign_id=$2 FOR UPDATE',[sceneId,id])
      if (!locked.rowCount) throw new NotFoundException('Cenário não encontrado.')
      previous = locked.rows[0].background_file
      await client.query('UPDATE tabletop_scenes SET background_file=$1,background_transform=NULL WHERE id=$2',[filename,sceneId])
      await client.query('COMMIT')
    } catch(error) { await client.query('ROLLBACK'); await this.storage.remove(access.campaign.owner_id,id,'cenarios',filename); throw error }
    finally { client.release() }
    if (previous) await this.storage.remove(access.campaign.owner_id,id,'cenarios',previous)
    return { ok:true }
  }
  @Get('campaigns/:id/tabletop/scenes/:sceneId/background/:filename') async sceneBackground(@Param('id') id: string, @Param('sceneId') sceneId: string, @Param('filename') filename: string, @Req() req: Request, @Res({passthrough:true}) res: Response) {
    const access = await this.tableAccess(id,req)
    const scene = await this.scenes.find(id,sceneId)
    if (!access.master && access.scene.id !== scene.id) throw new ForbiddenException('Este cenário ainda não está em exibição.')
    if (!scene.background_file || scene.background_file !== filename) throw new NotFoundException('Imagem não encontrada.')
    const file = await this.storage.read(access.campaign.owner_id,id,'cenarios',filename)
    const extension = filename.split('.').pop()
    res.setHeader('Content-Type',extension === 'jpg' ? 'image/jpeg' : `image/${extension}`)
    res.setHeader('Cache-Control','private, no-store')
    res.setHeader('X-Content-Type-Options','nosniff')
    return new StreamableFile(file.createReadStream())
  }
  @Post('campaigns/:id/tabletop/scenes/:sceneId/remove') async removeScene(@Param('id') id: string,@Param('sceneId') sceneId: string,@Req() req: Request) {
    this.accounts.mutation(req);const access=await this.tableAccess(id,req)
    if(!access.master) throw new ForbiddenException('Somente o mestre pode excluir cenários.')
    await this.scenes.find(id,sceneId)
    const client=await this.db.pool.connect()
    const files:string[]=[]
    try{
      await client.query('BEGIN');await client.query('SELECT id FROM campaigns WHERE id=$1 FOR UPDATE',[id])
      const remaining=await client.query('SELECT id FROM tabletop_scenes WHERE campaign_id=$1 AND id<>$2 ORDER BY created_at,id',[id,sceneId])
      if(!remaining.rowCount) throw new ConflictException('A mesa precisa ter pelo menos um cenário.')
      await client.query('UPDATE tabletop_active_scenes SET scene_id=$1 WHERE campaign_id=$2 AND scene_id=$3',[remaining.rows[0].id,id,sceneId])
      const assets=await client.query('SELECT background_file AS filename FROM tabletop_scenes WHERE id=$1 UNION ALL SELECT filename FROM tabletop_objects WHERE scene_id=$1',[sceneId])
      files.push(...assets.rows.map(row=>row.filename).filter(Boolean))
      await client.query('DELETE FROM tabletop_scenes WHERE id=$1 AND campaign_id=$2',[sceneId,id]);await client.query('COMMIT')
      for(const filename of files)try{await this.storage.remove(access.campaign.owner_id,id,'cenarios',filename)}catch{console.warn('Não foi possível limpar uma imagem do cenário excluído.')}
      return {ok:true}
    }catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
  }
  @Post('campaigns/:id/tabletop/scenes/:sceneId/background/transform') async transformBackground(@Param('id') id:string,@Param('sceneId') sceneId:string,@Body() body:Record<string,unknown>,@Req() req:Request){
    this.accounts.mutation(req);const access=await this.tableAccess(id,req)
    if(!access.master)throw new ForbiddenException('Somente o mestre pode redimensionar imagens.')
    const scene=await this.scenes.find(id,sceneId);if(!scene.background_file)throw new BadRequestException('Este cenário não possui imagem de fundo.')
    const size=sceneSize(body,scene,'scene_'),rect=bounds(body,size),cell=integer(body.scene_cell_size??scene.cell_size,32,128,'Tamanho do grid')
    try{await this.db.pool.query('UPDATE tabletop_scenes SET background_transform=$1,width=$3,height=$4,cell_size=$5 WHERE id=$2',[JSON.stringify(rect),sceneId,size.width,size.height,cell])}catch(error){sceneError(error)}return {ok:true}
  }
  @Post('campaigns/:id/tabletop/tokens/:tokenId/layer') async tokenLayer(@Param('id') id:string,@Param('tokenId') tokenId:string,@Body() body:Record<string,unknown>,@Req() req:Request){
    this.accounts.mutation(req);const access=await this.tableAccess(id,req)
    if(!access.master)throw new ForbiddenException('Somente o mestre pode alterar camadas.')
    if(!uuid.test(tokenId))throw new BadRequestException('Token inválido.')
    const result=await this.db.pool.query('UPDATE tabletop_tokens SET layer=$1 WHERE id=$2 AND campaign_id=$3 AND scene_id=$4 RETURNING id',[layer(body?.layer),tokenId,id,access.scene.id])
    if(!result.rowCount)throw new NotFoundException('Token não encontrado.');return {ok:true}
  }
  @Post('campaigns/:id/tabletop/objects')
  @UseInterceptors(FileInterceptor('image',{limits:{fileSize:MAX_IMAGE_BYTES,files:1,fields:2}}))
  async addObject(@Param('id') id:string,@Body() body:Record<string,unknown>,@UploadedFile() file:Express.Multer.File|undefined,@Req() req:Request){
    this.accounts.mutation(req);const access=await this.tableAccess(id,req)
    if(!access.master)throw new ForbiddenException('Somente o mestre pode adicionar objetos.')
    const targetLayer=layer(body?.layer),name=field(body,'name',1,100)
    const filename=await this.storage.saveImage(access.campaign.owner_id,id,'cenarios',file)
    const dimensions=imageSize(file!.buffer),scale=Math.min(Math.min(640,access.scene.width)/dimensions.width!,Math.min(440,access.scene.height)/dimensions.height!,1)
    try{await this.db.pool.query('INSERT INTO tabletop_objects(id,campaign_id,scene_id,name,layer,filename,x,y,width,height) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[randomUUID(),id,access.scene.id,name,targetLayer,filename,Math.min(1000,Math.max(0,access.scene.width-Math.max(8,dimensions.width!*scale))),Math.min(700,Math.max(0,access.scene.height-Math.max(8,dimensions.height!*scale))),Math.max(8,dimensions.width!*scale),Math.max(8,dimensions.height!*scale)])}
    catch(error){await this.storage.remove(access.campaign.owner_id,id,'cenarios',filename);sceneError(error)}return {ok:true}
  }
  @Post('campaigns/:id/tabletop/objects/:objectId/transform') async transformObject(@Param('id') id:string,@Param('objectId') objectId:string,@Body() body:Record<string,unknown>,@Req() req:Request){
    this.accounts.mutation(req);const access=await this.tableAccess(id,req)
    if(!access.master)throw new ForbiddenException('Somente o mestre pode editar objetos.')
    if(!uuid.test(objectId))throw new BadRequestException('Objeto inválido.')
    const size=sceneSize(body,access.scene,'scene_'),rect=bounds(body,size),cell=integer(body.scene_cell_size??access.scene.cell_size,32,128,'Tamanho do grid')
    const client=await this.db.pool.connect()
    try{
    await client.query('BEGIN')
    await client.query('UPDATE tabletop_scenes SET width=$1,height=$2,cell_size=$4 WHERE id=$3',[size.width,size.height,access.scene.id,cell])
    const result=await client.query('UPDATE tabletop_objects SET x=$1,y=$2,width=$3,height=$4,rotation=$9,layer=COALESCE($5,layer) WHERE id=$6 AND campaign_id=$7 AND scene_id=$8 RETURNING id',[rect.x,rect.y,rect.width,rect.height,body.layer===undefined?null:layer(body.layer),objectId,id,access.scene.id,rect.rotation])
    if(!result.rowCount)throw new NotFoundException('Objeto não encontrado.');await client.query('COMMIT');return {ok:true}
    }catch(error){await client.query('ROLLBACK');sceneError(error)}finally{client.release()}
  }
  @Post('campaigns/:id/tabletop/objects/:objectId/remove') async removeObject(@Param('id') id:string,@Param('objectId') objectId:string,@Req() req:Request){
    this.accounts.mutation(req);const access=await this.tableAccess(id,req)
    if(!access.master)throw new ForbiddenException('Somente o mestre pode excluir objetos.')
    if(!uuid.test(objectId))throw new BadRequestException('Objeto inválido.')
    const result=await this.db.pool.query('DELETE FROM tabletop_objects WHERE id=$1 AND campaign_id=$2 AND scene_id=$3 RETURNING filename',[objectId,id,access.scene.id])
    if(!result.rowCount)throw new NotFoundException('Objeto não encontrado.')
    try{await this.storage.remove(access.campaign.owner_id,id,'cenarios',result.rows[0].filename)}catch{console.warn('Não foi possível limpar a imagem do objeto excluído.')}
    return {ok:true}
  }
  @Get('campaigns/:id/tabletop/objects/:objectId/image') async objectImage(@Param('id') id:string,@Param('objectId') objectId:string,@Req() req:Request,@Res({passthrough:true}) res:Response){
    const access=await this.tableAccess(id,req)
    if(!uuid.test(objectId))throw new NotFoundException('Imagem não encontrada.')
    const {rows}=await this.db.pool.query("SELECT filename FROM tabletop_objects WHERE id=$1 AND campaign_id=$2 AND ($3::boolean OR (scene_id=$4 AND layer<>'mestre'))",[objectId,id,access.master,access.scene.id])
    if(!rows[0])throw new NotFoundException('Imagem não encontrada.')
    const file=await this.storage.read(access.campaign.owner_id,id,'cenarios',rows[0].filename)
    const ext=rows[0].filename.split('.').pop();res.setHeader('Content-Type',ext==='jpg'?'image/jpeg':`image/${ext}`);res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');return new StreamableFile(file.createReadStream())
  }
  @Post('campaigns/:id/tabletop/characters')
  @UseInterceptors(FileFieldsInterceptor([{name:'appearance',maxCount:1},{name:'token',maxCount:1}],{limits:{fileSize:MAX_IMAGE_BYTES,files:2,fields:5}}))
  async createCharacter(@Param('id') id:string,@Body() body:Record<string,unknown>,@UploadedFiles() files:CharacterFiles|undefined,@Req() req:Request){
    this.accounts.mutation(req)
    return this.characters.save(await this.tableAccess(id,req),undefined,body,files)
  }
  @Post('campaigns/:id/tabletop/characters/:characterId/settings')
  @UseInterceptors(FileFieldsInterceptor([{name:'appearance',maxCount:1},{name:'token',maxCount:1}],{limits:{fileSize:MAX_IMAGE_BYTES,files:2,fields:5}}))
  async updateCharacter(@Param('id') id:string,@Param('characterId') characterId:string,@Body() body:Record<string,unknown>,@UploadedFiles() files:CharacterFiles|undefined,@Req() req:Request){
    this.accounts.mutation(req)
    return this.characters.save(await this.tableAccess(id,req),characterId,body,files)
  }
  @Post('campaigns/:id/tabletop/characters/:characterId/place') async placeCharacter(@Param('id') id:string,@Param('characterId') characterId:string,@Body() body:Record<string,unknown>,@Req() req:Request){
    this.accounts.mutation(req)
    return this.characters.place(await this.tableAccess(id,req),characterId,body)
  }
  @Get('campaigns/:id/tabletop/characters/:characterId/images/:kind/:filename') async characterImage(@Param('id') id:string,@Param('characterId') characterId:string,@Param('kind') kind:string,@Param('filename') filename:string,@Req() req:Request,@Res({passthrough:true}) res:Response){
    const file=await this.characters.image(await this.tableAccess(id,req),characterId,kind,filename)
    const ext=filename.split('.').pop();res.setHeader('Content-Type',ext==='jpg'?'image/jpeg':`image/${ext}`)
    res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff')
    return new StreamableFile(file.createReadStream())
  }
  @Post('campaigns/:id/tabletop/tokens') async addToken(@Param('id') id: string, @Body() body: Record<string, unknown>, @Req() req: Request) {
    this.accounts.mutation(req)
    const access = await this.tableAccess(id, req)
    if (!access.master) throw new ForbiddenException('Somente o mestre pode criar tokens.')
    const name = field(body, 'name', 1, 40)
    const color = field(body, 'color', 7, 7)
    const owner = field(body, 'owner_id', 36, 36)
    if (!/^#[0-9a-f]{6}$/i.test(color) || !uuid.test(owner)) throw new BadRequestException('Cor ou participante inválido.')
    const members = await this.db.pool.query(`SELECT id FROM users WHERE id=$1 AND (id=$2 OR EXISTS(SELECT 1 FROM campaign_members WHERE campaign_id=$3 AND user_id=$1))`, [owner, access.campaign.owner_id, id])
    if (!members.rowCount) throw new BadRequestException('O controlador precisa participar da mesa.')
    const targetLayer = layer(body.layer || 'geral')
    const coords = position(body.x, body.y, access.scene.cell_size, access.scene.snap,access.scene.width,access.scene.height,access.scene.grid_type)
    const size=access.scene.grid_type==='none'?null:access.scene.cell_size
    return (await this.db.pool.query('INSERT INTO tabletop_tokens(id,campaign_id,owner_id,name,color,x,y,scene_id,layer,width,height) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10) RETURNING *', [randomUUID(), id, owner, name, color, coords.x, coords.y, access.scene.id, targetLayer,size])).rows[0]
  }
  @Post('campaigns/:id/tabletop/tokens/:tokenId/rotate') async rotateToken(@Param('id') id:string,@Param('tokenId') tokenId:string,@Body() body:Record<string,unknown>,@Req() req:Request){
    this.accounts.mutation(req);const access=await this.tableAccess(id,req)
    if(!access.master)throw new ForbiddenException('Somente o mestre pode girar tokens.')
    if(!uuid.test(tokenId))throw new BadRequestException('Token inválido.')
    if(body.free!==undefined&&typeof body.free!=='boolean')throw new BadRequestException('Modo de rotação inválido.')
    const angle=normalizeRotation(body.rotation)
    const rotation=body.free===true?angle:normalizeRotation(Math.round(angle/15)*15)
    const result=await this.db.pool.query('UPDATE tabletop_tokens SET rotation=$1 WHERE id=$2 AND campaign_id=$3 AND scene_id=$4 RETURNING *',[rotation,tokenId,id,access.scene.id])
    if(!result.rowCount)throw new NotFoundException('Token não encontrado neste cenário.')
    return result.rows[0]
  }
  @Post('campaigns/:id/tabletop/tokens/:tokenId/resize') async resizeToken(@Param('id') id:string,@Param('tokenId') tokenId:string,@Body() body:Record<string,unknown>,@Req() req:Request){
    this.accounts.mutation(req);const access=await this.tableAccess(id,req)
    if(!access.master)throw new ForbiddenException('Somente o mestre pode redimensionar tokens.')
    if(!uuid.test(tokenId))throw new BadRequestException('Token inválido.')
    const rect=bounds(body,access.scene)
    try{
      const result=await this.db.pool.query('UPDATE tabletop_tokens SET x=$1,y=$2,width=$3,height=$4,rotation=COALESCE($8,rotation) WHERE id=$5 AND campaign_id=$6 AND scene_id=$7 RETURNING *',[rect.x+rect.width/2,rect.y+rect.height/2,rect.width,rect.height,tokenId,id,access.scene.id,body.rotation===undefined?null:rect.rotation])
      if(!result.rowCount)throw new NotFoundException('Token não encontrado neste cenário.')
      return result.rows[0]
    }catch(error){sceneError(error)}
  }
  @Post('campaigns/:id/tabletop/tokens/:tokenId/move') async moveToken(@Param('id') id: string, @Param('tokenId') tokenId: string, @Body() body: Record<string, unknown>, @Req() req: Request) {
    this.accounts.mutation(req)
    const access = await this.tableAccess(id, req)
    if (!uuid.test(tokenId)) throw new BadRequestException('Token inválido.')
    const current=await this.db.pool.query("SELECT t.width,t.height,c.token_file FROM tabletop_tokens t JOIN tabletop_characters c ON c.id=t.character_id AND c.campaign_id=t.campaign_id WHERE t.id=$1 AND t.campaign_id=$2 AND t.scene_id=$3 AND ($4::boolean OR (t.owner_id=$5 AND t.layer='geral'))",[tokenId,id,access.scene.id,access.master,access.user.id])
    if(!current.rowCount)throw new ForbiddenException('Você não pode mover este token.')
    const size=await this.characters.mapSize(access,current.rows[0])
    const coords = position(body?.x, body?.y, access.scene.cell_size, access.scene.snap,access.scene.width,access.scene.height,access.scene.grid_type,size)
    const result = await this.db.pool.query(`UPDATE tabletop_tokens SET x=$1,y=$2,width=$8,height=$9 WHERE id=$3 AND campaign_id=$4 AND ($5::boolean OR (owner_id=$6 AND layer='geral')) AND scene_id=$7 RETURNING *`, [coords.x, coords.y, tokenId, id, access.master, access.user.id, access.scene.id,size.width,size.height])
    if (!result.rowCount) throw new ForbiddenException('Você não pode mover este token.')
    return result.rows[0]
  }
  @Post('campaigns/:id/tabletop/tokens/:tokenId/remove') async removeToken(@Param('id') id: string, @Param('tokenId') tokenId: string, @Req() req: Request) {
    this.accounts.mutation(req)
    const access = await this.tableAccess(id, req)
    if (!access.master) throw new ForbiddenException('Somente o mestre pode remover tokens.')
    if (!uuid.test(tokenId)) throw new BadRequestException('Token inválido.')
    await this.db.pool.query('DELETE FROM tabletop_tokens WHERE id=$1 AND campaign_id=$2 AND scene_id=$3', [tokenId, id, access.scene.id])
    return { ok: true }
  }
  @Post('campaigns/:id/tabletop/messages') async tableMessage(@Param('id') id: string, @Body() body: unknown, @Req() req: Request) {
    this.accounts.mutation(req)
    const access = await this.tableAccess(id, req)
    const content = field(body, 'content', 1, 2000)
    const command = /^\/(?:roll|r)\s+(.+)$/i.exec(content)
    if (content.startsWith('/') && !command) throw new BadRequestException('Comando desconhecido. Use /roll 1d20 ou envie uma mensagem.')
    const roll = command ? rollDice(command[1]) : null
    return (await this.db.pool.query('INSERT INTO tabletop_messages(campaign_id,user_id,content,roll) VALUES($1,$2,$3,$4) RETURNING id::text', [id, access.user.id, content, roll ? JSON.stringify(roll) : null])).rows[0]
  }
  @Post('campaigns/:id/invitations') async invite(@Param('id') id: string, @Req() req: Request) {
    this.accounts.mutation(req)
    const user = await this.accounts.user(req)
    if (!uuid.test(id)) throw new BadRequestException('Mesa inválida')
    const { rows } = await this.db.pool.query('SELECT id FROM campaigns WHERE id=$1 AND owner_id=$2', [id, user.id])
    if (!rows.length) throw new ForbiddenException('Somente o mestre pode convidar jogadores.')
    const token = randomBytes(32).toString('hex')
    await this.db.pool.query(`INSERT INTO invitations VALUES($1,$2,now()+interval '7 days')`, [digest(token), id])
    return { token, expiresInDays: 7 }
  }
  @Post('invitations/:token/accept') async accept(@Param('token') token: string, @Req() req: Request) {
    this.accounts.mutation(req)
    const user = await this.accounts.user(req)
    if (!/^[a-f0-9]{64}$/.test(token)) throw new NotFoundException('Convite inválido ou expirado.')
    const { rows } = await this.db.pool.query('SELECT c.id,c.owner_id FROM invitations i JOIN campaigns c ON c.id=i.campaign_id WHERE i.token_hash=$1 AND i.expires_at>now()', [digest(token)])
    if (!rows[0]) throw new NotFoundException('Convite inválido ou expirado.')
    if (rows[0].owner_id !== user.id) await this.db.pool.query('INSERT INTO campaign_members VALUES($1,$2) ON CONFLICT DO NOTHING', [rows[0].id, user.id])
    return { campaignId: rows[0].id }
  }
}
@Module({ controllers: [ApiController], providers: [Database, Accounts, Mailer, Scenes, Storage, Characters] })
export class AppModule {}
