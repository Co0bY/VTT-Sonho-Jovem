// Runs against an isolated API process and the project's real local PostgreSQL.
const assert = require('node:assert/strict')
const { spawn } = require('node:child_process')
const { Pool } = require('pg')
const { randomUUID } = require('node:crypto')
const server = spawn(process.execPath, ['dist/main.js'], { env: { ...process.env, PORT: '3102', SMTP_HOST: '127.0.0.1', SMTP_PORT: '1025', SMTP_SECURE: 'false', SMTP_USER: '' }, stdio: ['ignore', 'pipe', 'pipe'] })
let serverLogs = ''
server.stdout.on('data', b => serverLogs += b)
server.stderr.on('data', b => serverLogs += b)
const db = new Pool({ host:'127.0.0.1', port:5432, user:'vtt', database:'vtt', password:process.env.POSTGRES_PASSWORD })
const emails = []
async function request(path, status, body, cookie, origin) {
  const response = await fetch(`http://127.0.0.1:3102/${path}`, { method:body ? 'POST':'GET', headers:{ ...(body ? {'Content-Type':'application/json'}:{}), ...(cookie ? {Cookie:cookie}:{}), ...(origin ? {Origin:origin}:{}) }, body:body ? JSON.stringify(body):undefined })
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
  return new URLSearchParams(url.hash.slice(1)).get('redefinir-senha') || new URLSearchParams(url.hash.slice(1)).get('primeiro-acesso')
}
async function validateEmailPreview(email, reset = false) {
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
  assert.ok(html.includes(reset ? 'Redefina sua senha com segurança.' : 'Boas-vindas à sua próxima aventura.'))
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
  const email = `reset-${randomUUID()}@example.test`
  const pendingEmail = `pending-${randomUUID()}@example.test`
  const unknownEmail = `unknown-${randomUUID()}@example.test`
  emails.push(email, pendingEmail, unknownEmail)
  const oldPassword = 'Senha-anterior-12345', password = 'Nova-senha-12345'
  await request('auth/register',201,{name:'Conta pendente',email:pendingEmail})
  const setupToken = await activationToken(pendingEmail)
  const pendingResponse = await request('auth/forgot-password',201,{email:pendingEmail})
  assert.equal((await emailsFor(pendingEmail)).length,1, 'Conta pendente não recebe e-mail de recuperação')
  assert.equal(await activationToken(pendingEmail),setupToken)
  const unknownResponse = await request('auth/forgot-password',201,{email:unknownEmail})
  assert.deepEqual(pendingResponse.data,unknownResponse.data)
  assert.equal((await emailsFor(unknownEmail)).length,0)
  assert.equal((await db.query('SELECT id FROM users WHERE email=$1',[unknownEmail])).rowCount,0)
  await request('auth/register',201,{name:'Conta ativada',email})
  const firstAccessToken = await activationToken(email)
  await request('auth/first-access',201,{token:firstAccessToken,password:oldPassword,confirmation:oldPassword})
  const session = await request('auth/login',201,{email,password:oldPassword})
  const activeResponse = await request('auth/forgot-password',201,{email:email.toUpperCase()})
  assert.deepEqual(activeResponse.data,unknownResponse.data)
  await validateEmailPreview(email,true)
  const first = await activationToken(email)
  const stored = (await db.query('SELECT token_hash,expires_at FROM password_reset_tokens WHERE user_id=(SELECT id FROM users WHERE email=$1)',[email])).rows[0]
  assert.notEqual(stored.token_hash,first)
  assert.ok(Math.abs(new Date(stored.expires_at).getTime()-Date.now()-3600000)<60000)
  await request('auth/me',200,undefined,session.cookie)
  await request('auth/forgot-password',201,{email})
  const second = await activationToken(email)
  assert.notEqual(second,first)
  const reset = token => ({token,password,confirmation:password})
  await request('auth/reset-password',400,reset(first))
  await request('auth/reset-password',400,reset('0'.repeat(64)))
  await request('auth/reset-password',400,{token:second,password:'curta',confirmation:'curta'})
  await request('auth/reset-password',400,{token:second,password,confirmation:oldPassword})
  await request('auth/first-access',400,reset(second))
  await request('auth/reset-password',400,reset(firstAccessToken))
  await db.query("UPDATE password_reset_tokens SET expires_at=now()-interval '1 second' WHERE user_id=(SELECT id FROM users WHERE email=$1)",[email])
  await request('auth/reset-password',400,reset(second))
  await request('auth/forgot-password',201,{email})
  const third = await activationToken(email)
  const attempts = await Promise.all([1,2].map(()=>fetch('http://127.0.0.1:3102/auth/reset-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(reset(third))})))
  assert.deepEqual(attempts.map(r=>r.status).sort(),[201,400])
  await request('auth/reset-password',400,reset(third))
  await request('auth/me',401,undefined,session.cookie)
  await request('auth/login',401,{email,password:oldPassword})
  const login = await request('auth/login',201,{email,password})
  assert.ok(login.cookie)
  await request('auth/reset-password',400,reset(setupToken))
  await request('auth/forgot-password',400,{email:'invalido'})
  await request('auth/forgot-password',403,{email},undefined,'https://evil.example')
  assert.equal((await db.query('SELECT * FROM password_reset_tokens WHERE user_id=(SELECT id FROM users WHERE email=$1)',[email])).rowCount,0)
  console.log('PASS: recuperação de conta ativada após login, resposta genérica, conta pendente preservada, SMTP/HTML/CID, validade 1h, reenvio, links separados, confirmação, expiração, consumo concorrente único, sessões encerradas e login com nova senha.')
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
