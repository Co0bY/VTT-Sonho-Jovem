<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, shallowRef, watch } from 'vue'
import CharacterSheetMacros from './CharacterSheetMacros.vue'
import { macroMessage, type MacroEvent, type MacroMessage } from '../tabletop/sheet-macros'
import CharacterSheetEditor from './CharacterSheetEditor.vue'
import CharacterSheetModels from './CharacterSheetModels.vue'
import { editableSheet, fieldValueError, sheetError, type CharacterSheet } from '../tabletop/character-sheet'
import CharacterTextEditor from './CharacterTextEditor.vue'
import { editorHtml } from '../tabletop/rich-text'
import type { Character, Member } from '../tabletop/types'
const props=defineProps<{open:boolean;master:boolean;character:Character|null;members:Member[];userId:string;busy:boolean;error:string;save:(id:string|null,data:FormData)=>Promise<boolean>;sendMacro:(message:MacroMessage)=>Promise<unknown>}>()
const emit=defineEmits<{close:[]}>()
const name=ref(''),owner=ref(''),color=ref('#a47ae2'),localError=ref('')
const tab=ref('card'),description=ref(''),notes=ref('')
const sheet=ref(editableSheet())
const modelBusy = ref(false)
const importedSheet = ref(false)
const sheetRevision = ref(0)
const macroEditor=ref<InstanceType<typeof CharacterSheetMacros>>()
const macroFields=computed(()=>sheet.value.pages.flatMap(page=>page.fields))
const savedMacros=computed(()=>{
  if (importedSheet.value) return []
  const saved=props.character?.sheet
  return saved?.version===2?saved.macros??[]:[]
})
const clickMacros=computed(()=>new Set(savedMacros.value.filter(rule=>rule.event==='clique').map(rule=>rule.fieldId)))
const macroStatus=ref('')
async function runMacro(fieldId:string,event:MacroEvent,value:string){
  const rule=savedMacros.value.find(rule=>rule.fieldId===fieldId&&rule.event===event)
  if(!rule)return
  macroStatus.value=''
  localError.value=''
  try{
    if(rule.action.kind==='atribuir'){
      const targetId=rule.action.targetId
      const target=macroFields.value.find(field=>field.id===targetId)
      if(!target)return
      const error=fieldValueError(target,value)
      if(error)throw new Error(error)
      sheet.value={...sheet.value,pages:sheet.value.pages.map(page=>{
        if(!page.fields.some(field=>field.id===targetId))return page
        return {...page,fields:page.fields.map(field=>field.id===targetId?{...field,value}:field)}
      })}
      return
    }
    await props.sendMacro(macroMessage(rule.action,value))
    macroStatus.value='Ação enviada ao chat da mesa.'
  }catch(error){
    localError.value=(error as Error).message
  }
}
const pageUploads=reactive(new Map<string,{file:File;url:string}>())
const pendingImages=reactive(new Map<string,string>())
function cancelPageImage(id:string){
  const url=pendingImages.get(id)
  if(url)URL.revokeObjectURL(url)
  pendingImages.delete(id)
}
function removePageUpload(id:string){
  cancelPageImage(id)
  const upload=pageUploads.get(id)
  if(upload)URL.revokeObjectURL(upload.url)
  pageUploads.delete(id)
}
function releasePages(){
  for(const id of pendingImages.keys())cancelPageImage(id)
  for(const id of pageUploads.keys())removePageUpload(id)
}
async function selectPageImage(id:string,event:Event){
  const file=readImage(event)
  if(!file)return
  cancelPageImage(id)
  const url=URL.createObjectURL(file)
  pendingImages.set(id,url)
  const image=new Image()
  image.src=url
  try{
    await image.decode()
  }catch{
    if(pendingImages.get(id)!==url)return
    cancelPageImage(id)
    localError.value='Não foi possível abrir a imagem de fundo da página.'
    return
  }
  if(pendingImages.get(id)!==url)return
  pendingImages.delete(id)
  removePageUpload(id)
  pageUploads.set(id,{file,url})
  sheet.value={...sheet.value,pages:sheet.value.pages.map(page=>{
    if(page.id!==id)return page
    const height=Math.max(300,Math.min(4000,Math.round(page.width*image.naturalHeight/image.naturalWidth)))
    return {...page,height,removeBackground:false,fields:page.fields.map(field=>{
      const fieldHeight=Math.min(height,field.height)
      const y=Math.round(Math.min(height-fieldHeight,field.y*height/page.height))
      return {...field,height:fieldHeight,y}
    })}
  })}
}
function pageBackground(id:string){
  const page=sheet.value.pages.find(page=>page.id===id)
  return pageUploads.get(id)?.url??(page?.removeBackground?null:page?.backgroundUrl)
}
function applySheetModel(model: CharacterSheet, backgrounds: Map<string, File>) {
  releasePages()
  for (const [id, file] of backgrounds) {
    pageUploads.set(id, { file, url: URL.createObjectURL(file) })
  }
  sheet.value = model
  importedSheet.value = true
  sheetRevision.value++
  macroStatus.value = ''
}
const sheetEditor=ref<InstanceType<typeof CharacterSheetEditor>>()
const sheetWindowTarget = shallowRef<HTMLElement>()
let sheetWindow: Window | undefined

function closeSheetWindow() {
  const popup = sheetWindow
  sheetWindow = undefined
  sheetWindowTarget.value = undefined
  popup?.close()
}

function openSheetWindow() {
  if (sheetWindow && !sheetWindow.closed) {
    sheetWindow.focus()
    return
  }

  const popup = window.open('', '_blank', 'popup,width=1160,height=850,resizable=yes,scrollbars=yes')
  if (!popup) {
    localError.value = 'Permita pop-ups para abrir a ficha em uma nova janela.'
    return
  }

  popup.opener = null
  const popupDocument = popup.document
  popupDocument.documentElement.lang = 'pt-BR'
  popupDocument.title = name.value.trim() || 'Ficha do personagem'
  const base = popupDocument.createElement('base')
  base.href = document.baseURI
  const viewport = popupDocument.createElement('meta')
  viewport.name = 'viewport'
  viewport.content = 'width=device-width, initial-scale=1'
  popupDocument.head.append(base, viewport)
  for (const stylesheet of document.head.querySelectorAll('style, link[rel="stylesheet"]')) {
    popupDocument.head.append(popupDocument.importNode(stylesheet, true))
  }

  localError.value = ''
  tab.value = 'sheet'
  sheetWindow = popup
  sheetWindowTarget.value = popupDocument.body
  popup.addEventListener('pagehide', () => {
    if (sheetWindow === popup) {
      sheetWindow = undefined
      sheetWindowTarget.value = undefined
    }
  }, { once: true })
}

const kinds=['appearance','token'] as const
type Kind=typeof kinds[number]
const inputs:Record<Kind,HTMLInputElement|null>={appearance:null,token:null}
const uploads=reactive<Record<Kind,File|null>>({appearance:null,token:null})
const previews=reactive<Record<Kind,string>>({appearance:'',token:''})
const removed=reactive<Record<Kind,boolean>>({appearance:false,token:false})
function release(kind:Kind){if(previews[kind].startsWith('blob:'))URL.revokeObjectURL(previews[kind]);previews[kind]=''}
watch(()=>[props.open,props.character?.id],()=>{
  closeSheetWindow()
  modelBusy.value = false
  importedSheet.value = false
  releasePages()
  macroStatus.value=''
  if(!props.open){for(const kind of kinds){release(kind);uploads[kind]=null};return}
  sheet.value=editableSheet(props.character?.sheet,props.character?.sheet_background_url)
  tab.value='card';description.value=editorHtml(props.character?.description??'',props.character?.description_format);notes.value=editorHtml(props.character?.notes??'',props.character?.notes_format)
  name.value=props.character?.name??'';owner.value=props.character?.owner_id??props.userId;color.value=props.character?.color??'#a47ae2';localError.value=''
  for(const kind of kinds){release(kind);uploads[kind]=null;removed[kind]=false}
},{immediate:true})
function preview(kind:Kind){return previews[kind]||(!removed[kind]?(kind==='appearance'?props.character?.appearance_url:props.character?.token_url):null)}
function readImage(event:Event){
  const input=event.target as HTMLInputElement,file=input.files?.[0]
  if(!file)return
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>10*1024*1024){localError.value='Escolha uma imagem PNG, JPEG ou WebP de até 10 MB.';input.value='';return}
  input.value=''
  localError.value=''
  return file
}
function selectImage(kind:Kind,event:Event){
  const file=readImage(event)
  if(!file)return
  release(kind);uploads[kind]=file;removed[kind]=false;previews[kind]=URL.createObjectURL(file)
}
function removeImage(kind:Kind){release(kind);uploads[kind]=null;removed[kind]=true;if(inputs[kind])inputs[kind]!.value=''}
async function save(){
  if (modelBusy.value) return
  localError.value=''
  if(pendingImages.size){localError.value='Aguarde o carregamento da imagem de fundo.';return}
  if(!name.value.trim()){tab.value='card';localError.value='Informe o nome do personagem.';return}
  if(description.value.length>20000||notes.value.length>20000){localError.value='Use até 20.000 caracteres em cada editor, incluindo formatação.';return}
  const invalidMacros=macroEditor.value?.validateText()
  if(invalidMacros){tab.value='settings';localError.value=invalidMacros;return}
  const invalidSheet=sheetError(sheet.value)
  if(invalidSheet){tab.value='sheet';localError.value=invalidSheet;return}
  sheetEditor.value?.finishEditing()
  const data=new FormData();data.append('sheet',JSON.stringify({...sheet.value,pages:sheet.value.pages.map(({backgroundUrl,...page})=>page)}));data.append('text_format','html');data.append('name',name.value);if(props.master)data.append('owner_id',owner.value);data.append('color',color.value);data.append('description',description.value);data.append('notes',notes.value)
  for(const kind of kinds){if(uploads[kind])data.append(kind,uploads[kind]!);if(removed[kind])data.append(`remove_${kind}`,'true')}
  sheet.value.pages.forEach((page,index)=>{const upload=pageUploads.get(page.id);if(upload)data.append(`sheet_page_${index}`,upload.file)})
  if(await props.save(props.character?.id??null,data))emit('close')
}
onBeforeUnmount(()=>{closeSheetWindow();releasePages();for(const kind of kinds)release(kind)})
</script>
<template>
  <q-dialog :model-value="open" :persistent="busy" @update:model-value="emit('close')"><q-card class="modal character-dialog"><q-card-section>
    <header class="character-dialog-header">
      <div><span class="eyebrow">PERSONAGENS DA CAMPANHA</span><h2>{{ character ? 'Editar personagem' : 'Novo personagem' }}</h2></div>
      <button type="button" class="text-button sheet-window-button" aria-label="Abrir ficha em nova janela"
        title="Abrir ficha em nova janela" @click="openSheetWindow">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M13 5h6v6m0-6-9 9m0-9H5v14h14v-5"/></svg>
      </button>
    </header>
    <q-tabs v-model="tab" class="character-tabs" align="left" no-caps outside-arrows mobile-arrows aria-label="Abas do personagem">
      <q-tab name="card" label="Cartão de visita" :disable="busy" />
      <q-tab name="sheet" label="Ficha" :disable="busy" />
      <q-tab name="notes" label="Anotações" :disable="busy" />
      <q-tab name="settings" label="Configurações da ficha" :disable="busy" />
    </q-tabs>
    <form @submit.prevent="save">
      <section v-show="tab === 'card'" role="tabpanel" aria-label="Cartão de visita">
      <div class="character-images"><fieldset v-for="kind in (['appearance','token'] as const)" :key="kind" :disabled="busy"><legend>{{ kind === 'appearance' ? 'Aparência' : 'Token' }}</legend>
        <div class="character-image-preview" :class="{ 'token-preview': kind === 'token' }"><img v-if="preview(kind)" :src="preview(kind)!" :alt="kind === 'appearance' ? 'Prévia da aparência' : 'Prévia do token'"><span v-else aria-hidden="true">{{ name.trim().slice(0,1).toUpperCase() || '✧' }}</span></div>
        <label>{{ kind === 'appearance' ? 'Imagem de aparência' : 'Imagem do token' }}<input :ref="el=>inputs[kind]=el as HTMLInputElement|null" type="file" accept="image/png,image/jpeg,image/webp" @change="selectImage(kind,$event)"></label>
        <p>{{ kind === 'appearance' ? 'Retrato exibido no painel lateral.' : 'Imagem usada ao adicionar ao mapa.' }}</p>
        <button v-if="preview(kind)" type="button" class="text-button" :aria-label="kind === 'appearance' ? 'Remover imagem de aparência' : 'Remover imagem do token'" @click="removeImage(kind)">Remover imagem</button>
      </fieldset></div>
      <p class="character-hint">Imagens opcionais, até 10 MB cada. Criar um personagem não o adiciona ao mapa.</p>
      <label>Nome do personagem<input v-model="name" maxlength="40" :disabled="busy" placeholder="Ex.: Guardião da floresta"></label>
      <template v-if="master"><label for="character-owner">Controlado por</label><select id="character-owner" v-model="owner" required :disabled="busy"><option v-for="member in members" :key="member.id" :value="member.id">{{ member.name }} ({{ member.role === 'mestre' ? 'mestre' : 'jogador' }})</option></select></template>
      <label class="character-color">Cor de identificação<input v-model="color" type="color" :disabled="busy"></label>
      <CharacterTextEditor v-model="description" label="Descrição do cartão" :disabled="busy" />
      </section>
      <Teleport :to="sheetWindowTarget" :disabled="!sheetWindowTarget">
        <section v-show="sheetWindowTarget || tab === 'sheet'" aria-label="Ficha"
          :role="sheetWindowTarget ? undefined : 'tabpanel'" :class="{ 'sheet-window': sheetWindowTarget }">
          <h1 v-if="sheetWindowTarget">{{ name.trim() || 'Ficha do personagem' }}</h1>
          <CharacterSheetModels v-if="open" :key="character?.id" :sheet="sheet" :background-for="pageBackground"
            :disabled="busy || pendingImages.size > 0" @busy="modelBusy = $event" @import="applySheetModel" />
          <CharacterSheetEditor v-if="open" :key="sheetRevision" ref="sheetEditor" v-model="sheet" :background-for="pageBackground" :click-macros="clickMacros" :disabled="busy || modelBusy" @background="selectPageImage" @remove-background="removePageUpload" @trigger="runMacro" />
          <p v-if="macroStatus" role="status">{{ macroStatus }}</p>
          <p v-if="sheetWindowTarget && (localError || error)" role="alert" class="character-error">{{ localError || error }}</p>
        </section>
      </Teleport>
      <p v-if="tab === 'sheet' && sheetWindowTarget">A ficha está aberta em outra janela.</p>
      <section v-show="tab === 'notes'" role="tabpanel" aria-label="Anotações">
        <CharacterTextEditor v-model="notes" label="Anotações" :disabled="busy" />
      </section>
      <section v-show="tab === 'settings'" role="tabpanel" aria-label="Configurações da ficha">
        <CharacterSheetMacros v-if="open" :key="sheetRevision" ref="macroEditor" :model-value="sheet.macros ?? []" :fields="macroFields" :disabled="busy || modelBusy"
          @update:model-value="sheet={...sheet,macros:$event}" />
      </section>
      <p v-if="localError || error" role="alert" class="character-error">{{ localError || error }}</p>
      <div class="modal-actions"><button type="button" class="text-button" :disabled="busy" @click="emit('close')">Cancelar</button><button class="primary" :disabled="busy || modelBusy">{{ character ? 'Salvar personagem' : 'Criar personagem' }}</button></div>
    </form>
  </q-card-section></q-card></q-dialog>
</template>
<style scoped>
.character-dialog-header { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
.sheet-window-button { display:grid; place-items:center; }
.sheet-window-button:hover { background:#ffffff12; border-radius:8px; }
.sheet-window { padding:clamp(12px,3vw,32px); }
.sheet-window h1 { font-size:24px; line-height:1.3; margin-bottom:16px; }
.sheet-window :deep(.sheet-viewport) { max-height:calc(100dvh - 190px); min-height:180px; }

.character-tabs{margin-bottom:20px;border-bottom:1px solid #59436a;color:#d8c0ed}.character-tabs :deep(.q-tab){font-size:13px;padding:0 12px}.character-tabs :deep(.q-tab--active){color:#e4c7ff}.character-editor textarea{display:block;width:100%;min-height:180px;resize:vertical;padding:12px;border:1px solid #59436a;border-radius:8px;background:#17111e;color:#eadff3;font:inherit;line-height:1.7;margin-top:8px}.character-editor textarea:focus{outline:2px solid #b48ce9;outline-offset:2px}

.modal.character-dialog{width:1160px;max-width:94vw;height:90vh;overflow:auto}.character-dialog h2{font-size:24px;margin:12px 0 22px}.character-images{display:grid;grid-template-columns:1fr 1fr;gap:16px}.character-images fieldset{min-width:0;border:1px solid #59436a;border-radius:10px;padding:12px}.character-images legend{color:#d8c0ed;font-size:14px;padding:0 7px}.character-image-preview{height:145px;background:#15101d;border-radius:8px;display:grid;place-items:center;overflow:hidden;color:#c2a2e4;font-size:44px}.character-image-preview img{width:100%;height:100%;object-fit:contain}.token-preview img{max-width:130px;max-height:130px}.character-images label{font-size:11px;margin:12px 0}.character-images input[type=file]{padding:7px;font-size:10px;max-width:100%}.character-images p,.character-hint{font-size:11px!important;color:#ad96bc;line-height:1.7}.character-images button{font-size:11px;padding:6px 0}.character-hint{margin:12px 0}.character-dialog select{width:100%;padding:12px;border:1px solid #59436a;background:#17111e;color:#eadff3;border-radius:7px}.character-color{display:flex;align-items:center;justify-content:space-between}.character-color input{width:55px;height:35px;padding:3px;margin:0}.character-error{color:#ffc0d0!important}@media(max-width:480px){.character-images{gap:8px}.character-images fieldset{padding:8px}.character-image-preview{height:110px}.character-images input[type=file]{font-size:9px}}
</style>
