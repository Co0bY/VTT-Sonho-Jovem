<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { Application, Container, Graphics, Text, Texture, Sprite } from 'pixi.js'
import type { Scene, Token, Tool, Layer, SceneObject, Rect } from '../tabletop/types'
import { minimumTokenSize, rotationAngle, tokenBounds, hexGridSegments, imagePoint, imageContains, resizeImage, toWorld, zoomAt, tokenPosition, distance, type Camera, type Point } from '../tabletop/geometry'
const props = defineProps<{ scene: Scene; tokens: Token[]; objects: SceneObject[]; layer: Layer; userId: string; master: boolean; tool: Tool; selected: string; locked: boolean }>()
const emit = defineEmits<{ move: [id: string, point: Point]; select: [id: string]; zoom: [percent: number]; transform: [id:string,rect:Rect]; edit: [id:string,rect:Rect]; remove: [id:string]; place:[id:string,point:Point]; resize:[id:string,rect:Rect]; rotate:[id:string,rotation:number,free:boolean] }>()
const host = ref<HTMLDivElement>(), failure = ref(''), backgroundError = ref(''), backgroundLoading = ref(false)
let backgroundTexture: Texture | undefined, backgroundAbort: AbortController | undefined, backgroundVersion = 0
let app: Application | undefined, world: Container, observer: ResizeObserver | undefined, disposed = false
const tokenTextures=new Map<string,Texture>(),tokenImageError=ref('')
let tokenAbort:AbortController|undefined,tokenVersion=0
const objectTextures = new Map<string,Texture>()
let objectAbort: AbortController | undefined, objectVersion=0
let camera: Camera = { x: 0, y: 0, scale: 0.6 }
let drag: { pointer: number; mode: 'token' | 'pan' | 'measure' | 'object' | 'background'; start: Point; camera: Camera; token?: Token; object?: SceneObject; rect?:Rect; offset?: Point; position?: Point; size?:{width:number;height:number}; moved?:boolean } | undefined
let manipulation: {pointer:number;id:string;rect:Rect;preview:Rect;handle:number;free:boolean;at:Point;startAngle:number} | undefined
let ruler: { start: Point; end: Point } | undefined
const canMove = (t: Token) => props.master || (t.layer === 'geral' && t.owner_id === props.userId)
function clear(container=world) {
  const children=container.removeChildren()
  // Release mask relationships before destroying graphics referenced as masks.
  for(const child of children)child.mask=null
  for(const child of children)child.destroy({children:true})
}
function paint() {
  if (!app || !world || disposed) return
  clear()
  world.position.set(camera.x, camera.y); world.scale.set(camera.scale)
  const { width, height, cell_size: cell } = props.scene
  const base = new Graphics().roundRect(0, 0, width, height, 8).fill(0x25272d).stroke({ color: 0x55505f, width: 2 })
  // Neutral scene keeps maps/geometry independent of the application UI.
  world.addChild(base)
  if (backgroundTexture) {
    const sprite = new Sprite(backgroundTexture)
    const rect = manipulation?.id==='background'?manipulation.preview:drag?.mode === 'background' && drag.rect ? {...drag.rect,...drag.position} : backgroundBounds()!
    sprite.width=rect.width;sprite.height=rect.height;sprite.anchor.set(0.5);sprite.x=rect.x+rect.width/2;sprite.y=rect.y+rect.height/2;sprite.angle=rect.rotation??0
    world.addChild(sprite)
  }
  const compass = new Graphics().circle(width / 2, height / 2, 230).stroke({ color: 0x80768e, width: 2, alpha: 0.12 })
  compass.moveTo(width / 2, height / 2 - 300).lineTo(width / 2, height / 2 + 300).moveTo(width / 2 - 300, height / 2).lineTo(width / 2 + 300, height / 2).stroke({ color: 0x80768e, width: 2, alpha: 0.12 })
  if (!backgroundTexture) world.addChild(compass); else compass.destroy()
  function drawObjects(layer:Layer){
    for(const object of props.objects.filter(object=>object.layer===layer)){
      const rect=manipulation?.id===object.id?manipulation.preview:drag?.object?.id===object.id&&drag.position?{...object,...drag.position}:object
      const texture=objectTextures.get(object.id)
      const item=new Container();item.position.set(rect.x+rect.width/2,rect.y+rect.height/2);item.pivot.set(rect.width/2,rect.height/2);item.angle=rect.rotation??0
      if(texture){const sprite=new Sprite(texture);sprite.width=rect.width;sprite.height=rect.height;item.addChild(sprite)}
      else item.addChild(new Graphics().rect(0,0,rect.width,rect.height).fill({color:0x69517e,alpha:0.4}))
      if(props.selected===`object:${object.id}`)item.addChild(new Graphics().rect(0,0,rect.width,rect.height).stroke({color:0xd6b0ff,width:2/camera.scale}))
      item.alpha=layer==='mestre'&&props.layer!=='mestre'?0.45:1;world.addChild(item)
    }
  }
  function drawTokens(layer:Layer){
  for (const token of props.tokens.filter(token=>token.layer===layer)) {
    const point = drag?.mode === 'token' && drag.token?.id === token.id && drag.position ? drag.position : token
    const texture=token.token_url?tokenTextures.get(token.token_url):undefined
    const rect=manipulation?.id===`token:${token.id}`?manipulation.preview:tokenBounds({...token,...point,...(drag?.mode==='token'&&drag.token?.id===token.id?drag.size:{})},cell,texture)
    const item = new Container(); item.position.set(rect.x+rect.width/2,rect.y+rect.height/2)
    const visual=new Container();visual.angle=rect.rotation??0;item.addChild(visual)
    if(texture){
      const image=new Sprite(texture);image.anchor.set(0.5);image.width=rect.width;image.height=rect.height;visual.addChild(image)
    }else{
      visual.addChild(new Graphics().ellipse(0,0,rect.width/2,rect.height/2).fill(token.token_url?0x302538:token.color).stroke({color:0xe7d7ff,width:1/camera.scale}))
      const initials = new Text({ text: token.name.trim().slice(0,1).toUpperCase(), style: { fontFamily: 'Arial', fontSize: Math.min(rect.width,rect.height)*0.35, fill: '#ffffff', fontWeight: 'bold' } })
      initials.anchor.set(0.5); visual.addChild(initials)
    }
    if(props.selected===token.id)visual.addChild(new Graphics().rect(-rect.width/2,-rect.height/2,rect.width,rect.height).stroke({color:0xe0caff,width:2/camera.scale}))
    const label = new Text({ text: token.name, style: { fontFamily: 'Arial', fontSize: 13, fill: token.color, stroke: { color: '#17131e', width: 4 } } })
    label.anchor.set(0.5, 0); label.scale.set(1 / camera.scale); label.y = (Math.abs(Math.sin((rect.rotation??0)*Math.PI/180))*rect.width+Math.abs(Math.cos((rect.rotation??0)*Math.PI/180))*rect.height)/2 + 8 / camera.scale; item.addChild(label); item.alpha=layer==='mestre' && props.layer!=='mestre'?0.5:1;world.addChild(item)
  }
  }
  drawObjects('fundo');drawTokens('fundo')
  if (props.scene.grid_type!=='none') {
    const grid = new Graphics()
    if(props.scene.grid_type==='hex'){
      const topLeft=toWorld({x:0,y:0},camera),bottomRight=toWorld({x:app.screen.width,y:app.screen.height},camera)
      for(const [a,b] of hexGridSegments(cell,width,height,{left:topLeft.x,top:topLeft.y,right:bottomRight.x,bottom:bottomRight.y}))grid.moveTo(a.x,a.y).lineTo(b.x,b.y)
      const mask=new Graphics().rect(0,0,width,height).fill(0xffffff);world.addChild(mask);grid.mask=mask
    }else{
    for (let x = 0; x <= width; x += cell) grid.moveTo(x, 0).lineTo(x, height)
    for (let y = 0; y <= height; y += cell) grid.moveTo(0, y).lineTo(width, y)
    }
    grid.stroke({ color: props.scene.grid_color, width: 1, alpha: props.scene.grid_opacity }); world.addChild(grid)
  }
  drawObjects('geral');drawTokens('geral');drawObjects('mestre');drawTokens('mestre')
  drawHandles()
  if (ruler) {
    world.addChild(new Graphics().moveTo(ruler.start.x, ruler.start.y).lineTo(ruler.end.x, ruler.end.y).stroke({ color: 0xe5be75, width: 3 / camera.scale }).circle(ruler.start.x, ruler.start.y, 4 / camera.scale).fill(0xe5be75).circle(ruler.end.x, ruler.end.y, 4 / camera.scale).fill(0xe5be75))
    const text = new Text({ text: `${distance(ruler.start, ruler.end, cell, props.scene.distance_per_cell).toLocaleString('pt-BR', {maximumFractionDigits: 6})} ${props.scene.distance_unit}`, style: { fontFamily: 'Arial', fontSize: 15, fill: '#ffe0a1', stroke: { color: '#17131e', width: 5 } } })
    text.scale.set(1 / camera.scale);text.position.set(ruler.end.x + 12 / camera.scale, ruler.end.y - 25 / camera.scale); world.addChild(text)
  }
  app.render()
}
function backgroundBounds():Rect|undefined{
  if(props.scene.background_transform)return props.scene.background_transform
  if(!backgroundTexture)return
  const scale=Math.min(props.scene.width/backgroundTexture.width,props.scene.height/backgroundTexture.height)
  const width=backgroundTexture.width*scale,height=backgroundTexture.height*scale
  return {x:(props.scene.width-width)/2,y:(props.scene.height-height)/2,width,height}
}
async function loadTokenImages(){
  const version=++tokenVersion;tokenAbort?.abort();tokenAbort=new AbortController();tokenImageError.value=''
  const urls=new Set(props.tokens.map(token=>token.token_url).filter((url):url is string=>!!url))
  for(const [url,texture] of tokenTextures)if(!urls.has(url)){tokenTextures.delete(url);texture.destroy(true)}
  await Promise.all([...urls].filter(url=>!tokenTextures.has(url)).map(async url=>{
    try{
      const response=await fetch(url,{credentials:'same-origin',signal:tokenAbort!.signal})
      if(!response.ok)throw new Error('Falha na imagem do token.')
      const image=await createImageBitmap(await response.blob())
      if(disposed||version!==tokenVersion){image.close();return}
      tokenTextures.set(url,Texture.from(image));paint()
    }catch{if(!disposed&&version===tokenVersion)tokenImageError.value='Não foi possível carregar uma imagem de token. As iniciais continuam disponíveis.'}
  }));paint()
}
watch(()=>props.tokens.map(token=>token.token_url??'').sort().join('|'),loadTokenImages)
async function loadObjects(){
  const version=++objectVersion;objectAbort?.abort();objectAbort=new AbortController()
  for(const [id,texture] of objectTextures)if(!props.objects.some(object=>object.id===id)){objectTextures.delete(id);texture.destroy(true)}
  await Promise.all(props.objects.filter(object=>!objectTextures.has(object.id)).map(async object=>{
    try{const response=await fetch(object.image_url,{credentials:'same-origin',signal:objectAbort!.signal});if(!response.ok)throw new Error('Falha ao carregar objeto do cenário.')
      const image=await createImageBitmap(await response.blob());if(disposed||version!==objectVersion){image.close();return}objectTextures.set(object.id,Texture.from(image));paint()
    }catch(error){if(!disposed&&version===objectVersion)backgroundError.value=error instanceof Error?error.message:'Falha ao carregar imagem.'}
  }));paint()
}
watch(()=>props.objects.map(object=>object.id+object.image_url).join('|'),loadObjects)
const contains=(p:Point,r:Rect)=>imageContains(r,p)
function selectedImage(){
  if(!props.master||props.tool!=='select')return
  const token=props.tokens.find(t=>t.id===props.selected&&t.layer===props.layer)
  if(token)return {id:`token:${token.id}`,rect:tokenBounds(token,props.scene.cell_size,token.token_url?tokenTextures.get(token.token_url):undefined),kind:'token' as const}
  if(props.selected==='background'&&props.layer==='fundo'){const rect=backgroundBounds();if(rect)return {id:'background',rect,kind:'image' as const}}
  const object=props.objects.find(o=>`object:${o.id}`===props.selected&&o.layer===props.layer)
  if(object)return {id:object.id,rect:object,kind:'image' as const}
}
function handles(rect:Rect,rotate=true){return [[0,0],[rect.width,0],[rect.width,rect.height],[0,rect.height],...(rotate?[[rect.width/2,-30/camera.scale]]:[])].map(([x,y])=>imagePoint(rect,x!,y!))}
function drawHandles(){
  const selected=selectedImage();if(!selected)return
  const rect=manipulation?.preview||(drag?.rect?{...drag.rect,...drag.position}:selected.rect)
  const points=handles(rect),g=new Graphics(),size=(selected.kind==='token'?3:5)/camera.scale
  g.poly(points.slice(0,4).flatMap(p=>[p.x,p.y])).closePath().stroke({color:0xd6b0ff,width:2/camera.scale})
  if(points[4]){const top=imagePoint(rect,rect.width/2,0);g.moveTo(top.x,top.y).lineTo(points[4].x,points[4].y).stroke({color:0xd6b0ff,width:2/camera.scale})}
  points.forEach((p,i)=>{if(i===4)g.circle(p.x,p.y,size+1/camera.scale);else g.rect(p.x-size,p.y-size,size*2,size*2);g.fill(0xffffff).stroke({color:0x8052ae,width:1/camera.scale})})
  world.addChild(g)
}
function hitToken(at:Point){return [...props.tokens].reverse().find(token=>token.layer===props.layer&&contains(at,tokenBounds(token,props.scene.cell_size,token.token_url?tokenTextures.get(token.token_url):undefined)))}
function handleAt(selected:NonNullable<ReturnType<typeof selectedImage>>,at:Point){
  const radius=selected.kind==='token'?Math.min(10,Math.max(3,Math.min(selected.rect.width,selected.rect.height)*camera.scale/3)):11
  return handles(selected.rect).findIndex(p=>Math.hypot(p.x-at.x,p.y-at.y)<=radius/camera.scale)
}
function doubleClick(event:MouseEvent){
  if(!props.master||props.tool!=='select'||props.locked)return
  const at=toWorld(point(event),camera)
  if(hitToken(at))return
  const object=[...props.objects].reverse().find(object=>object.layer===props.layer&&contains(at,object))
  if(object){emit('edit',object.id,{x:object.x,y:object.y,width:object.width,height:object.height,rotation:object.rotation??0});return}
  const rect=backgroundBounds();if(props.layer==='fundo'&&rect&&contains(at,rect))emit('edit','background',rect)
}
async function loadBackground() {
  const version = ++backgroundVersion
  backgroundAbort?.abort(); backgroundAbort = new AbortController()
  backgroundError.value = ''; backgroundLoading.value = false
  const previous = backgroundTexture; backgroundTexture = undefined; paint(); previous?.destroy(true)
  if (!props.scene.background_url || !app) return
  backgroundLoading.value = true
  try {
    const response = await fetch(props.scene.background_url, {credentials:'same-origin',signal:backgroundAbort.signal})
    if (!response.ok) throw new Error('Não foi possível carregar a imagem do cenário.')
    const image = await createImageBitmap(await response.blob())
    if (disposed || version !== backgroundVersion) { image.close(); return }
    backgroundTexture = Texture.from(image); paint()
  } catch (error) { if (!disposed && version === backgroundVersion) backgroundError.value = error instanceof Error ? error.message : 'Falha ao carregar a imagem.' }
  finally { if (version === backgroundVersion) backgroundLoading.value = false }
}
watch(() => props.scene.background_url, loadBackground)
function point(event: PointerEvent | WheelEvent | MouseEvent): Point { const bounds = host.value!.getBoundingClientRect(); return { x: event.clientX - bounds.left, y: event.clientY - bounds.top } }
function placementPoint():Point{
  const at=host.value?toWorld({x:host.value.clientWidth/2,y:host.value.clientHeight/2},camera):{x:props.scene.width/2,y:props.scene.height/2}
  return tokenPosition(at,props.scene.cell_size,props.scene.snap,props.scene.width,props.scene.height,props.scene.grid_type)
}
function dragOver(event:DragEvent){
  if(props.master&&!props.locked&&event.dataTransfer?.types.includes('application/x-vtt-character')){event.preventDefault();event.dataTransfer.dropEffect='copy'}
}
function dropCharacter(event:DragEvent){
  if(!props.master||props.locked)return
  const id=event.dataTransfer?.getData('application/x-vtt-character')
  if(!id)return
  event.preventDefault()
  const at=toWorld(point(event),camera)
  if(at.x<0||at.y<0||at.x>props.scene.width||at.y>props.scene.height)return
  emit('place',id,tokenPosition(at,props.scene.cell_size,props.scene.snap,props.scene.width,props.scene.height,props.scene.grid_type))
}
function down(event: PointerEvent) {
  if (drag || manipulation || !app || !host.value) return
  if (![0, 1, 2].includes(event.button)) return
  event.preventDefault(); host.value.focus(); host.value.setPointerCapture(event.pointerId)
  const screen = point(event), at = toWorld(screen, camera)
  const selected=selectedImage()
  if(selected&&!props.locked&&event.button===0){
    const handle=handleAt(selected,at)
    if(handle>=0){manipulation={pointer:event.pointerId,id:selected.id,rect:{...selected.rect},preview:{...selected.rect},handle,free:event.altKey,at,startAngle:Math.atan2(at.y-selected.rect.y-selected.rect.height/2,at.x-selected.rect.x-selected.rect.width/2)};return}
  }
  if (props.tool === 'measure' && event.button === 0) {
    ruler = { start: at, end: at }; drag = { pointer: event.pointerId, mode: 'measure', start: at, camera: { ...camera } }
  } else {
    const hit = props.tool === 'select' && event.button === 0 ? hitToken(at) : undefined
    if (hit) {
      emit('select', hit.id)
      if (!props.locked && canMove(hit)) drag = { pointer: event.pointerId, mode: 'token', token: hit, start: at, offset: { x: at.x - hit.x, y: at.y - hit.y }, camera: { ...camera }, position: { x: hit.x, y: hit.y } }
    } else {
      const object=props.master&&props.tool==='select'&&event.button===0?[...props.objects].reverse().find(object=>object.layer===props.layer&&contains(at,object)):undefined
      const background=props.master&&props.tool==='select'&&props.layer==='fundo'&&event.button===0?backgroundBounds():undefined
      const rect=object||background
      if(rect && (object||contains(at,rect)) && !props.locked){
        emit('select',object?`object:${object.id}`:'background')
        drag={pointer:event.pointerId,mode:object?'object':'background',object,rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height,rotation:rect.rotation??0},start:at,camera:{...camera},offset:{x:at.x-rect.x,y:at.y-rect.y},position:{x:rect.x,y:rect.y}}
      }else{if(props.tool==='select')emit('select','');drag={pointer:event.pointerId,mode:'pan',start:screen,camera:{...camera}}}
    }
  }
  paint()
}
function move(event: PointerEvent) {
  if(host.value&&!drag&&!manipulation){
    const selected=selectedImage(),at=toWorld(point(event),camera)
    const handle=selected&&!props.locked?handleAt(selected,at):-1
    host.value.style.cursor=handle===4?'grab':handle>=0?'crosshair':''
  }
  if(manipulation){
    if(manipulation.pointer!==event.pointerId)return
    manipulation.at=toWorld(point(event),camera)
    updateManipulation(event.altKey);return
  }
  if (!drag || drag.pointer !== event.pointerId) return
  const at = point(event)
  if (drag.mode === 'pan') { camera.x = drag.camera.x + at.x - drag.start.x; camera.y = drag.camera.y + at.y - drag.start.y }
  if (drag.mode === 'measure') ruler = { start: drag.start, end: toWorld(at, camera) }
  if(drag.mode==='object'||drag.mode==='background'){const atWorld=toWorld(at,camera);drag.position={x:Math.max(0,Math.min(props.scene.width-drag.rect!.width,atWorld.x-drag.offset!.x)),y:Math.max(0,Math.min(props.scene.height-drag.rect!.height,atWorld.y-drag.offset!.y))}}
  if (drag.mode === 'token') {
    const worldPoint = toWorld(at, camera),token=drag.token!
    if(Math.hypot(worldPoint.x-drag.start.x,worldPoint.y-drag.start.y)*camera.scale>=3)drag.moved=true
    if(drag.moved)drag.size=minimumTokenSize(tokenBounds(token,props.scene.cell_size,token.token_url?tokenTextures.get(token.token_url):undefined),props.scene.cell_size,props.scene.grid_type)
    drag.position = tokenPosition({ x: worldPoint.x - drag.offset!.x, y: worldPoint.y - drag.offset!.y }, props.scene.cell_size, props.scene.snap, props.scene.width, props.scene.height, props.scene.grid_type,drag.size??token)
  }
  paint()
}
function updateManipulation(free:boolean){
  if(!manipulation)return
  const m=manipulation,r=m.rect,at=m.at;m.free=free
  const next=m.handle===4?{...r,rotation:rotationAngle((r.rotation??0)+(Math.atan2(at.y-r.y-r.height/2,at.x-r.x-r.width/2)-m.startAngle)*180/Math.PI,free)}:resizeImage(r,at,m.handle,{proportional:!free,cell:props.scene.grid_type==='none'?1:props.scene.cell_size})
  if(next.x>=-1e-8&&next.y>=-1e-8&&next.x+next.width<=props.scene.width+1e-8&&next.y+next.height<=props.scene.height+1e-8)m.preview={...next,x:Math.max(0,next.x),y:Math.max(0,next.y)}
  paint()
}
function up(event: PointerEvent) {
  if(manipulation){if(manipulation.pointer!==event.pointerId)return;const m=manipulation;manipulation=undefined;if(host.value?.hasPointerCapture(event.pointerId))host.value.releasePointerCapture(event.pointerId);if(event.type!=='pointercancel'){if(m.id.startsWith('token:')){if(m.handle===4)emit('rotate',m.id.slice(6),m.preview.rotation??0,m.free);else emit('resize',m.id.slice(6),m.preview)}else emit('transform',m.id,m.preview)};paint();return}
  if (!drag || drag.pointer !== event.pointerId) return
  const finished = drag; drag = undefined
  if (host.value?.hasPointerCapture(event.pointerId)) host.value.releasePointerCapture(event.pointerId)
  if (event.type !== 'pointercancel' && finished.mode === 'token' && finished.position && (finished.position.x!==finished.token!.x || finished.position.y!==finished.token!.y || (finished.moved&&finished.size&&(finished.size.width!==finished.token!.width||finished.size.height!==finished.token!.height)))) emit('move', finished.token!.id, finished.position)
  if(event.type!=='pointercancel'&&(finished.mode==='object'||finished.mode==='background')&&finished.rect&&finished.position&&(Math.abs(finished.rect.x-finished.position.x)>0.5||Math.abs(finished.rect.y-finished.position.y)>0.5))emit('transform',finished.object?.id||'background',{...finished.rect,...finished.position})
  paint()
}
function wheel(event: WheelEvent) { event.preventDefault(); if (!drag && !manipulation) { camera = zoomAt(camera, point(event), camera.scale * Math.exp(-event.deltaY * 0.001)); emit('zoom', Math.round(camera.scale * 100)); paint() } }
function zoomBy(factor: number) { if (!host.value) return; camera = zoomAt(camera, { x: host.value.clientWidth / 2, y: host.value.clientHeight / 2 }, camera.scale * factor); emit('zoom', Math.round(camera.scale * 100)); paint() }
function center() {
  if (!host.value) return
  camera.scale = Math.max(0.02, Math.min(1, Math.min((host.value.clientWidth - 140) / props.scene.width, (host.value.clientHeight - 140) / props.scene.height)))
  camera.x = (host.value.clientWidth - props.scene.width * camera.scale) / 2; camera.y = (host.value.clientHeight - props.scene.height * camera.scale) / 2
  emit('zoom', Math.round(camera.scale * 100)); ruler = undefined; paint()
}
function keyboard(event: KeyboardEvent) {
  if((event.target as HTMLElement).closest('input,textarea,select,[contenteditable="true"]'))return
  if(event.key==='Alt'&&manipulation){event.preventDefault();updateManipulation(event.altKey);return}
  if(event.type==='keyup')return
  if(event.key==='Delete'){
    if(event.repeat||event.ctrlKey||event.metaKey||event.altKey||!props.master||props.locked||drag||manipulation||props.tool!=='select')return
    const token=props.tokens.find(t=>t.id===props.selected&&t.layer===props.layer)
    const object=props.objects.find(o=>`object:${o.id}`===props.selected&&o.layer===props.layer)
    if(token||object){event.preventDefault();emit('remove',props.selected)}
    return
  }
  if (event.key === 'Escape') { manipulation=undefined;drag=undefined;ruler = undefined; emit('select', ''); paint(); return }
  const token = props.tokens.find(t => t.id === props.selected)
  const directions: Record<string, Point> = { ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 } }
  const direction = directions[event.key]
  if (!token || token.layer!==props.layer || !direction || !canMove(token) || props.locked) return
  event.preventDefault(); emit('move', token.id, tokenPosition({ x: token.x + direction.x * props.scene.cell_size, y: token.y + direction.y * props.scene.cell_size }, props.scene.cell_size, props.scene.snap, props.scene.width, props.scene.height, props.scene.grid_type,token))
}
// Recreate the render tree when changing grid topology. Keep camera and loaded
// textures, but discard the previous shape's graphics and mask/render state.
watch(() => props.scene.grid_type, () => {
  if(!app||!world||disposed)return
  drag=undefined;manipulation=undefined
  const previous=world
  world=new Container()
  app.stage.removeChild(previous)
  clear(previous)
  previous.destroy()
  app.stage.addChild(world)
  paint()
}, {flush:'post'})
watch(() => [props.tokens, props.objects, props.scene, props.selected,props.layer], paint, { deep: true })
watch([()=>props.scene.width,()=>props.scene.height],()=>{manipulation=undefined;drag=undefined;center()})
watch(() => [props.tool,props.layer], () => { manipulation=undefined;drag = undefined; paint() })
onMounted(async () => {
  const instance = new Application()
  try {
    await instance.init({ width: host.value?.clientWidth || 800, height: host.value?.clientHeight || 600, background: '#15141c', antialias: true, autoDensity: true, resolution: Math.min(devicePixelRatio, 2), autoStart: false })
    if (disposed) { instance.destroy(true, { children: true }); return }
    app = instance; world = new Container(); app.stage.addChild(world); host.value!.appendChild(app.canvas)
    observer = new ResizeObserver(() => {
      if (!app || !host.value) return
      const centerPoint = toWorld({ x: app.screen.width / 2, y: app.screen.height / 2 }, camera)
      const width = host.value.clientWidth, height = host.value.clientHeight
      app.renderer.resize(width, height)
      camera.x = width / 2 - centerPoint.x * camera.scale; camera.y = height / 2 - centerPoint.y * camera.scale
      paint()
    }); observer.observe(host.value!)
    host.value!.addEventListener('wheel', wheel, { passive: false }); center(); void loadBackground();void loadObjects();void loadTokenImages()
  } catch { failure.value = 'Não foi possível iniciar o cenário. Verifique se a aceleração gráfica do navegador está habilitada e recarregue a página.' }
})
onBeforeUnmount(() => { disposed = true;tokenVersion++;tokenAbort?.abort(); backgroundVersion++; backgroundAbort?.abort();objectVersion++;objectAbort?.abort(); observer?.disconnect(); host.value?.removeEventListener('wheel', wheel); if (app) app.destroy(true, { children: true }); backgroundTexture?.destroy(true);for(const texture of objectTextures.values())texture.destroy(true);for(const texture of tokenTextures.values())texture.destroy(true) })
defineExpose({ zoomBy, center, placementPoint, focus:()=>host.value?.focus() })
</script>
<template><div ref="host" class="pixi-board" :class="`tool-${tool}`" tabindex="0" role="application" aria-label="Cenário da mesa. Arraste para navegar, use a roda para zoom. Selecione um token e use as setas para movê-lo ou Delete para excluir. Imagens: cantos mantêm proporção no grid; Alt permite tamanho livre." @dragover="dragOver" @drop="dropCharacter" @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up" @contextmenu.prevent @dblclick="doubleClick" @keydown="keyboard" @keyup="keyboard"><p v-if="failure" role="alert" class="board-failure">{{ failure }}</p><p v-if="backgroundLoading" class="background-status" role="status">Carregando imagem…</p><p v-if="tokenImageError" class="background-status" role="alert">{{ tokenImageError }}</p><p v-if="backgroundError" class="background-status" role="alert">{{ backgroundError }}</p></div></template>
<style scoped>.pixi-board{width:100%;height:100%;overflow:hidden;touch-action:none;outline:none;position:relative}.pixi-board:focus-visible{box-shadow:inset 0 0 0 2px #b48ce9}.pixi-board :deep(canvas){display:block}.tool-pan{cursor:grab}.tool-measure{cursor:crosshair}.board-failure{padding:40px;color:#ffd1d8;max-width:500px}.background-status{position:absolute;bottom:65px;left:20px;background:#2d203c;color:#e0caef;font-size:11px;padding:10px;border-radius:6px;z-index:2}</style>
