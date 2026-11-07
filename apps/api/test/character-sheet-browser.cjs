// Focused regression against the application actually served by Docker/WSL.
const {chromium}=require('../../web/node_modules/@playwright/test')
const {Pool}=require('pg')
const {randomUUID,randomBytes,createHash}=require('node:crypto')
const {rm,mkdir}=require('node:fs/promises')
const path=require('node:path')
const assert=require('node:assert/strict')
const image=require('./fixtures/image.cjs')
const origin=process.env.VTT_TEST_ORIGIN||'http://127.0.0.1:9000'
const owner=randomUUID(),campaign=randomUUID(),session=randomBytes(32).toString('hex')
const db=new Pool({host:'127.0.0.1',port:5432,user:'vtt',database:'vtt',password:process.env.POSTGRES_PASSWORD})
let browser
async function request(suffix,body){
 const response=await fetch(`${origin}/api/campaigns/${campaign}/tabletop${suffix}`,{method:body?'POST':'GET',headers:{Cookie:`vtt_session=${session}`},body})
 const data=await response.json();assert.equal(response.status,body?201:200,JSON.stringify(data));return data
}
async function main(){
 for(const category of ['cenarios','tokens','outros'])await mkdir(path.resolve(__dirname,'../../../storage',owner,campaign,category),{recursive:true})
 const health=await fetch(`${origin}/api/health`);assert.equal(health.status,200)
 await db.query('INSERT INTO users(id,name,email) VALUES($1,$2,$3)',[owner,'Teste ficha publicada',`sheet-save-${owner}@example.test`])
 await db.query("INSERT INTO sessions VALUES($1,$2,now()+interval '1 hour')",[createHash('sha256').update(session).digest('hex'),owner])
 await db.query("INSERT INTO campaigns(id,owner_id,name,system) VALUES($1,$2,'Teste salvamento da ficha','Teste')",[campaign,owner])
 const form=new FormData();form.append('name','Força de teste');form.append('owner_id',owner);form.append('color','#a47ae2')
 const character=await request('/characters',form)
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']})
 const context=await browser.newContext({viewport:{width:1440,height:960}})
 await context.addCookies([{name:'vtt_session',value:session,domain:new URL(origin).hostname,path:'/',httpOnly:true,sameSite:'Lax'}])
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message))
 await page.goto(`${origin}/mesas/${campaign}`)
 await page.getByRole('button',{name:'Personagens',exact:true}).click()
 await page.getByRole('button',{name:'Editar personagem Força de teste',exact:true}).click()
 await page.getByRole('tab',{name:'Ficha',exact:true}).click()
 await page.getByRole('button',{name:'Editar ficha',exact:true}).click()
 await page.getByLabel('Imagem de fundo da ficha',{exact:true}).setInputFiles({name:'ficha.png',mimeType:'image/png',buffer:image(80,110)})
 await page.getByRole('button',{name:'+ Adicionar campo',exact:true}).click()
 await page.getByLabel('Rótulo do campo',{exact:true}).fill('Força')
 await page.getByLabel('Referência do campo',{exact:true}).fill('for')
 let fail=true
 await page.route(`**/api/campaigns/${campaign}/tabletop/characters/${character.id}/settings`,async route=>{
  if(fail){fail=false;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Falha simulada; tente novamente.'})})}
  else await route.continue()
 })
 await page.getByRole('button',{name:'Salvar personagem',exact:true}).click()
 await page.getByText('Falha simulada; tente novamente.',{exact:true}).first().waitFor()
 await page.getByRole('button',{name:'Editar ficha',exact:true}).waitFor()
 assert.equal(await page.getByRole('button',{name:'Concluir edição',exact:true}).count(),0,'Salvar encerra o modo de edição, mesmo se a requisição falhar')
 assert.equal(await page.getByRole('img',{name:'Fundo da ficha',exact:true}).count(),1,'Falha preserva o fundo local')
 await page.getByLabel('Força',{exact:true}).fill('15')
 await page.getByRole('button',{name:'Editar ficha',exact:true}).click()
 assert.equal(await page.getByLabel('Referência do campo',{exact:true}).inputValue(),'for')
 const savedResponse=page.waitForResponse(r=>r.url().endsWith(`/characters/${character.id}/settings`)&&r.request().method()==='POST')
 await page.getByRole('button',{name:'Salvar personagem',exact:true}).click()
 const response=await savedResponse;assert.equal(response.status(),201,await response.text())
 await page.getByRole('heading',{name:'Editar personagem',exact:true}).waitFor({state:'hidden'})
 const saved=(await request('')).characters.find(c=>c.id===character.id)
 assert.ok(saved.sheet_background_url);assert.equal(saved.sheet.fields[0].label,'Força');assert.equal(saved.sheet.fields[0].reference,'for');assert.equal(saved.sheet.fields[0].value,'15')
 const asset=await fetch(`${origin}${saved.sheet_background_url}`,{headers:{Cookie:`vtt_session=${session}`}})
 assert.equal(asset.status,200)
 await page.getByRole('button',{name:'Editar personagem Força de teste',exact:true}).click()
 await page.getByRole('tab',{name:'Ficha',exact:true}).click()
 await page.getByRole('button',{name:'Editar ficha',exact:true}).waitFor()
 assert.equal(await page.getByLabel('Força',{exact:true}).inputValue(),'15')
 assert.deepEqual(errors,[])
 console.log('PASS ficha na aplicação publicada: salvar durante edição encerra modo, preserva dados após falha, reenvia fundo/campo/valor e recupera após reabrir; upload sheet aceito pela API real.')
}
main().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{
 if(browser)await browser.close()
 try{await db.query('DELETE FROM campaigns WHERE id=$1',[campaign]);await db.query('DELETE FROM users WHERE id=$1',[owner])}
 finally{await db.end();await rm(path.resolve(__dirname,'../../../storage',owner),{recursive:true,force:true})}
})
