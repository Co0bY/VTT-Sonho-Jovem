// Runs against an isolated API process and the project's real local PostgreSQL.
const assert = require('node:assert/strict')
const { spawn } = require('node:child_process')
const { Pool } = require('pg')
const { randomUUID } = require('node:crypto')
const server = spawn(process.execPath, ['dist/main.js'], { env: { ...process.env, PORT: '3101', SMTP_HOST: '127.0.0.1', SMTP_PORT: '1025', SMTP_SECURE: 'false', SMTP_USER: '' }, stdio: ['ignore', 'pipe', 'pipe'] })
let serverLogs = ''
server.stdout.on('data', b => serverLogs += b)
server.stderr.on('data', b => serverLogs += b)
const db = new Pool({ host:'127.0.0.1', port:5432, user:'vtt', database:'vtt', password:process.env.POSTGRES_PASSWORD })
const emails = []
async function request(path, status, body, cookie, origin) {
  const response = await fetch(`http://127.0.0.1:3101/${path}`, { method:body ? 'POST':'GET', headers:{ ...(body ? {'Content-Type':'application/json'}:{}), ...(cookie ? {Cookie:cookie}:{}), ...(origin ? {Origin:origin}:{}) }, body:body ? JSON.stringify(body):undefined })
  const result = await response.json()
  assert.equal(response.status, status, `${path}: ${JSON.stringify(result)}`)
  return { data:result, cookie:response.headers.get('set-cookie')?.split(';')[0] }
}
async function emailsFor(email) {
  const response = await fetch(`http://127.0.0.1:8025/api/v2/search?kind=to&query=${encodeURIComponent(email)}`)
  assert.equal(response.status,200)
  return (await response.json()).items || []
}
async function activationToken(email) {
  const messages = await emailsFor(email)
  assert.ok(messages.length, 'O e-mail precisa chegar ao MailHog por SMTP')
  messages.sort((a,b)=>new Date(b.Created)-new Date(a.Created))
  const content = messages[0].Content.Body.replace(/=\r?\n/g,'').replace(/=([0-9A-F]{2})/gi,(_,hex)=>String.fromCharCode(parseInt(hex,16)))
  const url = new URL(content.match(/http[^\s]+/)[0])
  assert.equal(url.origin, 'http://127.0.0.1:9000')
  return new URLSearchParams(url.hash.slice(1)).get('primeiro-acesso')
}
async function validateEmailPreview(email) {
  const [message] = await emailsFor(email)
  // Reproduz a busca do MailHog: ele procura text/html no cabeçalho inteiro,
  // inclusive em type="text/html" de um contêiner multipart/related.
  function findHTML(part) {
    for (const child of part.MIME?.Parts || []) {
      const type = child.Headers['Content-Type']?.[0] || ''
      if (type.match('text/html;?.*')) return child
      if (/multipart\/.*/.test(type)) {
        const found = findHTML(child)
        if (found) return found
      }
    }
  }
  const part = findHTML(message)
  assert.ok(part, 'O MailHog deve encontrar a parte HTML')
  assert.match(part.Headers['Content-Type'][0], /^text\/html\b/)
  const html = Buffer.from(part.Body.replace(/=\r?\n/g,'').replace(/=([0-9A-F]{2})/gi,(_,hex)=>String.fromCharCode(parseInt(hex,16))), 'latin1').toString('utf8')
  assert.match(html, /^<!doctype html>/i)
  assert.ok(html.includes('Boas-vindas à sua próxima aventura.'))
  assert.ok(html.includes('style="'))
  assert.ok(html.includes('Atenciosamente,'))
  assert.ok(html.includes('src="cid:vtt-logo"'))
  const logoIndex = message.MIME.Parts.findIndex(p => p.Headers['Content-ID']?.[0] === '<vtt-logo>')
  assert.ok(logoIndex >= 0, 'A logo deve ficar no nível em que o MailHog resolve os CIDs')
  const response = await fetch(`http://127.0.0.1:8025/api/v1/messages/${encodeURIComponent(message.ID)}/mime/part/${logoIndex}/download`)
  assert.equal(response.status, 200)
  assert.deepEqual(Buffer.from(await response.arrayBuffer()).subarray(0,8), Buffer.from([137,80,78,71,13,10,26,10]))
}
async function activate(email,password) {
  const token = await activationToken(email)
  await request('auth/first-access',201,{token,password,confirmation:password})
  await request('auth/first-access',400,{token,password,confirmation:password})
  return request('auth/login',201,{email,password})
}
async function main() {
  for (let i=0; i<60; i++) {
    try { await request('health',200); break } catch (e) { if(i===59) throw new Error(serverLogs); await new Promise(r=>setTimeout(r,100)) }
  }
  await request('campaigns',401)
  const ownerEmail = `test-${randomUUID()}@example.test`, playerEmail = `test-${randomUUID()}@example.test`
  emails.push(ownerEmail,playerEmail)
  const credentials = {name:'Mestre de teste',email:ownerEmail,password:'Teste-seguro-12345'}
  await request('auth/register',400,{name:'Mestre',email:'invalido'})
  const registration = await request('auth/register',201,{name:credentials.name,email:ownerEmail})
  assert.equal(registration.cookie,undefined)
  assert.equal(registration.data.token,undefined)
  await request('auth/login',401,{email:ownerEmail,password:credentials.password})
  await request('auth/me',401)
  const first = await activationToken(ownerEmail)
  await validateEmailPreview(ownerEmail)
  const setup = (await db.query('SELECT token_hash, expires_at FROM password_setup_tokens WHERE user_id=(SELECT id FROM users WHERE email=$1)',[ownerEmail])).rows[0]
  assert.notEqual(setup.token_hash,first)
  assert.ok(Math.abs(new Date(setup.expires_at).getTime()-Date.now()-48*3600000)<60000)
  await request('auth/first-access',400,{token:'0'.repeat(64),password:credentials.password,confirmation:credentials.password})
  await request('auth/first-access',400,{token:first,password:'curta',confirmation:'curta'})
  await request('auth/first-access',400,{token:first,password:credentials.password,confirmation:'Senha-diferente-12345'})
  await db.query("UPDATE password_setup_tokens SET expires_at=now()-interval '1 second' WHERE user_id=(SELECT id FROM users WHERE email=$1)",[ownerEmail])
  await request('auth/first-access',400,{token:first,password:credentials.password,confirmation:credentials.password})
  await request('auth/register',201,{name:credentials.name,email:ownerEmail})
  const second = await activationToken(ownerEmail)
  assert.notEqual(second,first)
  await request('auth/first-access',400,{token:first,password:credentials.password,confirmation:credentials.password})
  const owner = await activate(ownerEmail,credentials.password)
  assert.match(owner.cookie,/vtt_session=/)
  assert.equal(owner.data.password_hash,undefined)
  await request('auth/register',409,{name:credentials.name,email:ownerEmail})
  await request('auth/login',401,{email:ownerEmail,password:'senha errada'})
  assert.equal((await request('auth/me',200,undefined,owner.cookie)).data.email,ownerEmail)
  await request('campaigns',403,{name:'Invasão',system:'Teste',description:''},owner.cookie,'https://evil.example')
  await request('campaigns',400,{name:'',system:'Teste',description:''},owner.cookie)
  const campaign = (await request('campaigns',201,{name:'Mesa de teste',system:'Sistema próprio',description:'Integração'},owner.cookie)).data
  const invite = (await request(`campaigns/${campaign.id}/invitations`,201,{},owner.cookie)).data
  await request('auth/register',201,{name:'Jogador',email:playerEmail,invitation:invite.token})
  const playerMessages = await emailsFor(playerEmail)
  const playerBody = playerMessages[0].Content.Body.replace(/=\r?\n/g,'').replace(/=([0-9A-F]{2})/gi,(_,hex)=>String.fromCharCode(parseInt(hex,16)))
  assert.ok(playerBody.includes(invite.token), 'O convite deve acompanhar o primeiro acesso')
  const playerToken = await activationToken(playerEmail)
  // Two simultaneous attempts must consume a first-access token exactly once.
  const attempts = await Promise.all([1,2].map(()=>fetch('http://127.0.0.1:3101/auth/first-access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:playerToken,password:credentials.password,confirmation:credentials.password})})))
  assert.deepEqual(attempts.map(r=>r.status).sort(),[201,400])
  const player = await request('auth/login',201,{email:playerEmail,password:credentials.password})
  assert.equal((await request('campaigns',200,undefined,player.cookie)).data.length,0)
  await request(`campaigns/${campaign.id}/tabletop`,403,undefined,player.cookie)
  await request(`campaigns/${campaign.id}/tabletop`,401)
  await request(`campaigns/${campaign.id}/invitations`,403,{},player.cookie)
  await request(`invitations/${invite.token}/accept`,401,{})
  await request('invitations/invalido/accept',404,{},player.cookie)
  await request(`invitations/${invite.token}/accept`,201,{},player.cookie)
  await request(`invitations/${invite.token}/accept`,201,{},player.cookie)
  const tables = (await request('campaigns',200,undefined,player.cookie)).data
  assert.equal(tables[0].role,'jogador'); assert.equal(tables[0].participants,2)
  assert.equal((await request('campaigns',200,undefined,owner.cookie)).data[0].role,'mestre')
  const tablePath = `campaigns/${campaign.id}/tabletop`
  const initialScene = (await request(tablePath,200,undefined,owner.cookie)).data
  assert.equal(initialScene.scene.cell_size,64)
  assert.equal(initialScene.members.length,2)
  assert.equal(initialScene.tokens.length,0)
  assert.equal((await request(tablePath,200,undefined,player.cookie)).data.role,'jogador')
  const settings = {cell_size:64,grid_visible:true,snap:true}
  await request(`${tablePath}/settings`,403,settings,player.cookie)
  await request(`${tablePath}/settings`,400,{...settings,cell_size:1},owner.cookie)
  await request(`${tablePath}/settings`,201,settings,owner.cookie)
  const playerId = player.data.id
  await request(`${tablePath}/tokens`,403,{name:'Invasão',color:'#aa55ff',owner_id:playerId,x:64,y:64},player.cookie)
  await request(`${tablePath}/tokens`,400,{name:'Inválido',color:'#aa55ff',owner_id:randomUUID(),x:64,y:64},owner.cookie)
  const ownedToken = (await request(`${tablePath}/tokens`,201,{name:'Guardião',color:'#aa55ff',owner_id:owner.data.id,x:64,y:64},owner.cookie)).data
  const playerTokenOnBoard = (await request(`${tablePath}/tokens`,201,{name:'Aventureiro',color:'#55aaff',owner_id:playerId,x:100,y:100},owner.cookie)).data
  assert.equal(playerTokenOnBoard.x,96)
  await request(`${tablePath}/tokens/${ownedToken.id}/move`,403,{x:128,y:128},player.cookie)
  await request(`${tablePath}/tokens/${playerTokenOnBoard.id}/move`,400,{x:-1,y:128},player.cookie)
  const moved = (await request(`${tablePath}/tokens/${playerTokenOnBoard.id}/move`,201,{x:130,y:200},player.cookie)).data
  assert.equal(moved.x,160); assert.equal(moved.y,224)
  await request(`${tablePath}/tokens/${playerTokenOnBoard.id}/remove`,403,{},player.cookie)
  await request(`${tablePath}/messages`,400,{content:''},player.cookie)
  await request(`${tablePath}/messages`,400,{content:'/roll 100d6'},player.cookie)
  await request(`${tablePath}/messages`,400,{content:'/roll 1d1'},player.cookie)
  await request(`${tablePath}/messages`,201,{content:'Olá, grupo!'},player.cookie)
  await request(`${tablePath}/messages`,201,{content:'/roll 2d6+3',roll:{total:999}},player.cookie)
  const shared = (await request(tablePath,200,undefined,owner.cookie)).data
  assert.equal(shared.tokens.find(t=>t.id===playerTokenOnBoard.id).x,160)
  assert.equal(shared.messages[0].author,'Jogador')
  const dice = shared.messages[1].roll
  assert.equal(dice.rolls.length,2); assert.ok(dice.rolls.every(n=>n>=1&&n<=6))
  assert.equal(dice.total,dice.rolls.reduce((sum,n)=>sum+n,3)); assert.notEqual(dice.total,999)
  const other = (await request('campaigns',201,{name:'Outra mesa',system:'Teste',description:''},player.cookie)).data
  await request(`campaigns/${other.id}/tabletop/tokens/${ownedToken.id}/move`,403,{x:100,y:100},player.cookie)
  assert.equal((await request(`campaigns/${other.id}/tabletop`,200,undefined,player.cookie)).data.messages.length,0)
  await request(`${tablePath}/tokens/${ownedToken.id}/remove`,201,{},owner.cookie)
  assert.equal((await request(tablePath,200,undefined,owner.cookie)).data.tokens.length,1)
  await db.query("UPDATE invitations SET expires_at=now()-interval '1 day' WHERE campaign_id=$1",[campaign.id])
  await request(`invitations/${invite.token}/accept`,404,{},player.cookie)
  await request('auth/logout',201,{},owner.cookie)
  await request('auth/me',401,undefined,owner.cookie)
  const logged = await request('auth/login',201,{email:ownerEmail.toUpperCase(),password:credentials.password})
  assert.equal((await request('campaigns',200,undefined,logged.cookie)).data[0].id,campaign.id)
  const stored = (await db.query('SELECT password_hash FROM users WHERE email=$1',[ownerEmail])).rows[0].password_hash
  assert.notEqual(stored,credentials.password)
  console.log('PASS: cadastro sem senha/sessão, SMTP real no MailHog, validade de 48h, reenvio, token inválido/expirado/reutilizado, confirmação de senha, consumo concorrente único, login, mesas/convites, acesso à mesa, permissões de tokens/grid, persistência do cenário, chat e dados no servidor.')
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{
  try {
    // Remove only records belonging to this run, preserving all actual project data.
    await db.query('DELETE FROM campaigns WHERE owner_id IN (SELECT id FROM users WHERE email=ANY($1))',[emails])
    await db.query('DELETE FROM users WHERE email=ANY($1)',[emails])
    for (const email of emails) for (const message of await emailsFor(email)) {
      await fetch(`http://127.0.0.1:8025/api/v1/messages/${encodeURIComponent(message.ID)}`,{method:'DELETE'})
    }
  } finally { await db.end(); server.kill('SIGTERM') }
})
