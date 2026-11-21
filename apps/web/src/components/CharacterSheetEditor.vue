<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { CharacterSheet, FieldType, SheetField, SheetPage } from '../tabletop/character-sheet'
import type { MacroEvent } from '../tabletop/sheet-macros'
import { emptyPage, fieldDefaults, hasOptions, MAX_SHEET_PAGES, sheetError } from '../tabletop/character-sheet'

const props=defineProps<{modelValue:CharacterSheet;backgroundFor:(id:string)=>string|null|undefined;disabled:boolean;clickMacros:ReadonlySet<string>}>()
const emit=defineEmits<{
  'update:modelValue':[sheet:CharacterSheet];background:[id:string,event:Event];removeBackground:[id:string];trigger:[fieldId:string,event:MacroEvent,value:string]
}>()
const editing=ref(false)
const placing=ref(false)
type Rect=Pick<SheetField,'x'|'y'|'width'|'height'>
type Corner={name:string;left:boolean;top:boolean}
const corners:Corner[]=[
  {name:'superior esquerdo',left:true,top:true},
  {name:'superior direito',left:false,top:true},
  {name:'inferior esquerdo',left:true,top:false},
  {name:'inferior direito',left:false,top:false},
]
const minimumSize=12
const preview=ref<Rect>()
let draw:{pointer:number;x:number;y:number}|undefined
const pageIndex=ref(0)
const selectedId=ref('')
const editingValue=ref(false)
const valueModeButton=ref<HTMLButtonElement>()
watch(selectedId,()=>{editingValue.value=false})
const board=ref<HTMLElement>()
const viewport=ref<HTMLElement>()
const backgroundError=ref(false)
const page=computed(()=>props.modelValue.pages[pageIndex.value]!)
const background=computed(()=>props.backgroundFor(page.value.id))
const selected=computed(()=>page.value.fields.find(field=>field.id===selectedId.value))
const fieldCount=computed(()=>props.modelValue.pages.reduce((count,item)=>count+item.fields.length,0))
const validation=computed(()=>sheetError(props.modelValue))
const types:Record<FieldType,string>={text:'Texto',textarea:'Texto multilinha',number:'Número',bar:'Barra',select:'Lista (select)',radio:'Opção única (radio)',checkbox:'Caixa de seleção (checkbox)'}
const clamp=(value:number,min:number,max:number)=>Math.round(Math.max(min,Math.min(max,Number.isNaN(value)?min:value)))
let drag:{pointer:number;field:SheetField;clientX:number;clientY:number;corner?:Corner}|undefined

function replacePage(patch:Partial<SheetPage>){
  emit('update:modelValue',{...props.modelValue,pages:props.modelValue.pages.map(item=>item.id===page.value.id?{...item,...patch}:item)})
}
function updateField(id:string,patch:Partial<SheetField>){
  replacePage({fields:page.value.fields.map(field=>field.id===id?{...field,...patch}:field)})
}
function activatePage(index:number){
  cancelPlacement()
  drag=undefined
  selectedId.value=''
  backgroundError.value=false
  pageIndex.value=index
  viewport.value?.scrollTo(0,0)
}
function addPage(){
  const pages=props.modelValue.pages
  if(pages.length>=MAX_SHEET_PAGES)return
  emit('update:modelValue',{...props.modelValue,pages:[...pages,emptyPage(crypto.randomUUID())]})
  activatePage(pages.length)
}
function addField(rect:Rect){
  if(fieldCount.value>=100)return
  const references=new Set(props.modelValue.pages.flatMap(item=>item.fields.map(field=>field.reference)))
  let index=1
  while(references.has(`campo_${index}`))index++
  const field:SheetField={
    ...fieldDefaults(),id:crypto.randomUUID(),label:`Campo ${index}`,reference:`campo_${index}`,
    ...rect,type:'text',hideLabel:!!background.value,value:'',
  }
  selectedId.value=field.id
  replacePage({fields:[...page.value.fields,field]})
}
async function startPlacement(){
  editingValue.value=false
  placing.value=true
  await nextTick()
  viewport.value?.focus({preventScroll:true})
}
function cancelPlacement(){
  placing.value=false
  preview.value=undefined
  draw=undefined
}
function boardPoint(event:PointerEvent){
  const bounds=board.value!.getBoundingClientRect()
  return {
    x:clamp((event.clientX-bounds.left)*page.value.width/bounds.width,0,page.value.width),
    y:clamp((event.clientY-bounds.top)*page.value.height/bounds.height,0,page.value.height),
  }
}
function fieldRect(x:number,y:number,width:number,height:number):Rect{
  x=clamp(x,0,page.value.width-minimumSize)
  y=clamp(y,0,page.value.height-minimumSize)
  return {x,y,width:clamp(width,minimumSize,page.value.width-x),height:clamp(height,minimumSize,page.value.height-y)}
}
function startDraw(event:PointerEvent){
  if(!placing.value||props.disabled||event.button!==0||draw)return
  event.preventDefault()
  const {x,y}=boardPoint(event)
  draw={pointer:event.pointerId,x,y}
  preview.value=fieldRect(x,y,minimumSize,minimumSize)
  board.value!.setPointerCapture(event.pointerId)
}
function drawMove(event:PointerEvent){
  if(!draw||draw.pointer!==event.pointerId)return
  const {x,y}=boardPoint(event)
  preview.value=fieldRect(Math.min(x,draw.x),Math.min(y,draw.y),Math.abs(x-draw.x),Math.abs(y-draw.y))
}
function finishDraw(event:PointerEvent){
  if(!draw||draw.pointer!==event.pointerId)return
  if(event.type==='pointerup'&&!props.disabled){
    const point=boardPoint(event)
    drawMove(event)
    const clicked=Math.abs(point.x-draw.x)<4&&Math.abs(point.y-draw.y)<4
    addField(clicked?fieldRect(draw.x,draw.y,120,24):preview.value!)
  }
  cancelPlacement()
}
function placementKey(event:KeyboardEvent){
  if(!placing.value)return
  if(event.key==='Escape'){
    event.preventDefault()
    event.stopPropagation()
    cancelPlacement()
  }
  if(event.key==='Enter'){
    event.preventDefault()
    if(props.disabled)return
    addField(fieldRect((viewport.value?.scrollLeft??0)+24,(viewport.value?.scrollTop??0)+24,120,24))
    cancelPlacement()
  }
}
function selectField(id:string){
  selectedId.value=id
  board.value?.querySelector<HTMLElement>(`[data-sheet-field="${id}"]`)?.scrollIntoView({block:'nearest',inline:'nearest'})
}
function removeField(){
  emit('update:modelValue',{
    ...props.modelValue,
    pages:props.modelValue.pages.map(item=>item.id===page.value.id?{...item,fields:item.fields.filter(field=>field.id!==selectedId.value)}:item),
    macros:props.modelValue.macros?.filter(rule=>rule.fieldId!==selectedId.value&&(rule.action.kind!=='atribuir'||rule.action.targetId!==selectedId.value)),
  })
  selectedId.value=''
}
function removeBackground(){
  emit('removeBackground',page.value.id)
  replacePage({removeBackground:true})
  backgroundError.value=false
}
function changeType(field:SheetField,type:FieldType){
  const options=hasOptions(type)&&!field.options.length?['Opção 1','Opção 2']:field.options
  const previousText=field.type==='text'||field.type==='textarea'||field.type==='number'?field.value:''
  const value=type==='checkbox'?'false':type==='bar'?'0':hasOptions(type)?'':previousText
  updateField(field.id,{type,value,options})
}
function changeOptions(field:SheetField,text:string){
  const options=text.split('\n').map(option=>option.trim()).filter(Boolean)
  updateField(field.id,{options,value:options.includes(field.value)?field.value:''})
}
function changeBar(field:SheetField,raw:string,changeMaximum=false){
  const maximum=changeMaximum?clamp(Number(raw)||1,1,1000000):field.maximum
  const value=clamp(Number(changeMaximum?field.value:raw)||0,0,maximum)
  updateField(field.id,{maximum,value:String(value)})
}
function resize(field:SheetField,dx:number,dy:number,corner:Corner){
  const right=field.x+field.width
  const bottom=field.y+field.height
  const x=corner.left?clamp(field.x+dx,0,right-minimumSize):field.x
  const y=corner.top?clamp(field.y+dy,0,bottom-minimumSize):field.y
  const width=corner.left?right-x:clamp(field.width+dx,minimumSize,page.value.width-x)
  const height=corner.top?bottom-y:clamp(field.height+dy,minimumSize,page.value.height-y)
  updateField(field.id,{x,y,width,height})
}
function position(field:SheetField,x:number,y:number){
  updateField(field.id,{x:clamp(x,0,page.value.width-field.width),y:clamp(y,0,page.value.height-field.height)})
}
function down(event:PointerEvent,field:SheetField,corner?:Corner){
  if(!editing.value||placing.value||props.disabled||event.button!==0||drag)return
  selectedId.value=field.id
  const target=event.currentTarget as HTMLElement
  target.setPointerCapture(event.pointerId)
  drag={pointer:event.pointerId,field,clientX:event.clientX,clientY:event.clientY,corner}
}
function move(event:PointerEvent){
  if(!drag||drag.pointer!==event.pointerId||!board.value||props.disabled)return
  const bounds=board.value.getBoundingClientRect()
  const dx=(event.clientX-drag.clientX)*page.value.width/bounds.width
  const dy=(event.clientY-drag.clientY)*page.value.height/bounds.height
  const field=drag.field
  if(drag.corner)resize(field,dx,dy,drag.corner)
  else position(field,field.x+dx,field.y+dy)
}
function endDrag(event:PointerEvent){
  if(!drag||drag.pointer!==event.pointerId)return
  if(event.type==='pointercancel'){
    const {id,x,y,width,height}=drag.field
    updateField(id,{x,y,width,height})
  }
  drag=undefined
}
function keyboard(event:KeyboardEvent,field:SheetField,corner?:Corner){
  const directions:Record<string,[number,number]>={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}
  const delta=directions[event.key]
  if(!delta)return
  event.preventDefault()
  event.stopPropagation()
  selectedId.value=field.id
  const step=event.shiftKey?10:1
  if(corner)resize(field,delta[0]*step,delta[1]*step,corner)
  else position(field,field.x+delta[0]*step,field.y+delta[1]*step)
}
async function toggleValueEditing(){
  editingValue.value=!editingValue.value
  if(!editingValue.value)return
  selectField(selectedId.value)
  await nextTick()
  board.value?.querySelector<HTMLElement>('.sheet-field.selected .field-content :is(input,select)')?.focus({preventScroll:true})
}
function stopValueEditing(event:KeyboardEvent){
  if(!editing.value||!editingValue.value)return
  event.stopPropagation()
  editingValue.value=false
  valueModeButton.value?.focus()
}
function trigger(field:SheetField,event:Event,kind:MacroEvent){
  const target=event.target
  if(!(target instanceof HTMLInputElement||target instanceof HTMLSelectElement||target instanceof HTMLTextAreaElement))return
  if(event instanceof KeyboardEvent){
    if(event.isComposing)return
    if(target instanceof HTMLInputElement&&target.type==='text')event.preventDefault()
    if(event.repeat)return
  }
  if(editing.value||props.disabled)return
  const value=target instanceof HTMLInputElement&&target.type==='checkbox'?String(target.checked):target.value
  emit('trigger',field.id,kind,value)
}
function finishEditing(){editing.value=false;editingValue.value=false;drag=undefined;cancelPlacement()}
defineExpose({finishEditing})
</script>

<template>
  <div class="sheet-editor">
    <div class="sheet-toolbar">
      <button type="button" :disabled="disabled" :aria-pressed="editing" @click="editing ? finishEditing() : editing=true">
        {{ editing ? 'Concluir edição' : 'Editar ficha' }}
      </button>
      <nav aria-label="Páginas da ficha">
        <button v-for="(item,index) in modelValue.pages" :key="item.id" type="button"
          :aria-current="index===pageIndex ? 'page' : undefined" :disabled="disabled" @click="activatePage(index)">
          Página {{ index+1 }}
        </button>
      </nav>
      <button v-if="editing" type="button" :disabled="disabled || modelValue.pages.length>=MAX_SHEET_PAGES" @click="addPage">+ Adicionar página</button>
    </div>
    <div v-if="editing" class="sheet-tools">
      <label>Imagem de fundo da ficha
        <input :key="page.id" type="file" accept="image/png,image/jpeg,image/webp" :disabled="disabled"
          @change="backgroundError=false;emit('background',page.id,$event)">
      </label>
      <button v-if="background" type="button" :disabled="disabled" @click="removeBackground">Remover fundo da ficha</button>
      <button type="button" :disabled="disabled || fieldCount>=100" :aria-pressed="placing" @click="placing ? cancelPlacement() : startPlacement()">{{ placing ? 'Cancelar adição' : '+ Adicionar campo' }}</button>
    </div>
    <p v-if="editing" class="sheet-instruction" aria-live="polite">{{ placing
      ? 'Clique ou arraste sobre a ficha para marcar a área do novo campo. Enter insere com o tamanho padrão.'
      : editingValue ? 'Altere o valor no campo destacado. Volte a Mover campo para ajustar a posição.'
      : 'Selecione um campo para editar. Arraste pelo centro para mover ou pelos cantos para redimensionar.' }}</p>
    <p v-if="validation" role="alert" class="sheet-error">{{ validation }}</p>
    <p v-if="backgroundError" role="alert" class="sheet-error">Não foi possível carregar o fundo da ficha.</p>
    <div class="sheet-workspace" :class="{ 'show-settings':editing }">
      <div ref="viewport" class="sheet-viewport" tabindex="0" aria-label="Área da ficha" @keydown="placementKey">
        <div :key="page.id" ref="board" class="sheet-board" :class="{'is-editing':editing,'is-placing':placing}"
          @pointerdown="startDraw" @pointermove="drawMove" @pointerup="finishDraw" @pointercancel="finishDraw" @lostpointercapture="finishDraw"
          :style="{width:`${page.width}px`,height:`${page.height}px`}">
          <img v-if="background" :key="background" class="sheet-background" :src="background" alt="Fundo da ficha"
            draggable="false" @load="backgroundError=false" @error="backgroundError=true">
          <p v-if="!page.fields.length && !background" class="sheet-empty">Edite a ficha para adicionar um fundo ou campos a esta página.</p>
          <div v-if="preview" class="draw-preview" :style="{left:`${preview.x}px`,top:`${preview.y}px`,width:`${preview.width}px`,height:`${preview.height}px`}"></div>
          <div v-for="field in page.fields" :key="field.id" class="sheet-field"
            :class="{selected:editing && selectedId===field.id,highlight:field.highlight}"
            :data-sheet-field="field.id" :title="editing ? field.label : undefined" :style="{left:`${field.x}px`,top:`${field.y}px`,width:`${field.width}px`,height:`${field.height}px`,'--field-font':`${clamp(field.height-3,9,14)}px`}">
            <div class="field-content" :inert="editing && !(editingValue && selectedId===field.id)" @keydown.esc="stopValueEditing"
              @keydown.enter="trigger(field,$event,'enter')" @change="trigger(field,$event,'mudanca')">
              <span v-if="!field.hideLabel && field.type==='radio'" class="field-label">{{ field.label }}</span>
              <label v-else-if="!field.hideLabel" class="field-label" :for="`sheet-value-${field.id}`">{{ field.label }}</label>
              <input v-if="field.type==='text'||field.type==='number'" :id="`sheet-value-${field.id}`" class="plain-control" :class="{ 'number-control':field.type==='number' }"
                :aria-label="field.label" :value="field.value" :disabled="disabled" :readonly="field.readOnly" :inputmode="field.type==='number'?'decimal':'text'"
                :data-reference="field.reference" maxlength="1000" @input="updateField(field.id,{value:($event.target as HTMLInputElement).value})">
              <textarea v-else-if="field.type==='textarea'" :id="`sheet-value-${field.id}`" class="plain-control"
                :aria-label="field.label" :value="field.value" :disabled="disabled" :readonly="field.readOnly"
                :data-reference="field.reference" maxlength="1000" @input="updateField(field.id,{value:($event.target as HTMLTextAreaElement).value})" />
              <div v-else-if="field.type==='bar'" class="bar-control">
                <input :id="`sheet-value-${field.id}`" type="range" min="0" :max="field.maximum" :value="field.value"
                  :style="{'--fill':`${Number(field.value)/field.maximum*100}%`}"
                  :aria-label="field.label" :aria-valuetext="`${field.value} de ${field.maximum}`" :disabled="disabled || field.readOnly" @input="changeBar(field,($event.target as HTMLInputElement).value)">
                <span>{{ field.value }} / {{ field.maximum }}</span>
              </div>
              <select v-else-if="field.type==='select'" :id="`sheet-value-${field.id}`" class="plain-control"
                :aria-label="field.label" :value="field.value" :disabled="disabled || field.readOnly" @change="updateField(field.id,{value:($event.target as HTMLSelectElement).value})">
                <option value="">Selecione</option>
                <option v-for="(option,index) in field.options" :key="index" :value="option">{{ option }}</option>
              </select>
              <div v-else-if="field.type==='radio'" class="radio-options" role="radiogroup" :aria-label="field.label">
                <label v-for="(option,index) in field.options" :key="index">
                  <input type="radio" :name="`sheet-radio-${field.id}`" :value="option" :checked="field.value===option"
                    :disabled="disabled || field.readOnly" @change="updateField(field.id,{value:option})"> {{ option }}
                </label>
              </div>
              <input v-else :id="`sheet-value-${field.id}`" type="checkbox" :aria-label="field.label" :checked="field.value==='true'"
                :disabled="disabled || field.readOnly" @change="updateField(field.id,{value:String(($event.target as HTMLInputElement).checked)})">
            </div>
            <button v-if="!editing && clickMacros.has(field.id)" type="button" class="macro-trigger"
              :class="{ 'macro-trigger-left':field.x>=28 && field.x+field.width+28>page.width }"
              :disabled="disabled" :aria-label="`Executar macro de ${field.label}`" :title="`Executar macro de ${field.label}`"
              @click="emit('trigger',field.id,'clique',field.value)"><span aria-hidden="true">▶</span></button>
            <template v-if="editing">
              <button v-if="!(editingValue && selectedId===field.id)" type="button" class="move-handle" :disabled="disabled || placing" :aria-label="`Mover campo ${field.label}`"
                @focus="selectedId=field.id" @click="selectedId=field.id" @keydown="keyboard($event,field)"
                @pointerdown="down($event,field)" @pointermove="move" @pointerup="endDrag" @pointercancel="endDrag" @lostpointercapture="endDrag">
              </button>
              <template v-if="selectedId===field.id && !placing">
                <button v-for="corner in corners" :key="corner.name" type="button" class="resize-handle"
                  :disabled="disabled" :class="{left:corner.left,top:corner.top}"
                  :aria-label="`Redimensionar campo ${field.label} pelo canto ${corner.name}`"
                  @keydown="keyboard($event,field,corner)" @pointerdown="down($event,field,corner)"
                  @pointermove="move" @pointerup="endDrag" @pointercancel="endDrag" @lostpointercapture="endDrag"></button>
              </template>
            </template>
          </div>
        </div>
      </div>
      <fieldset v-if="editing" class="field-settings" :disabled="disabled || placing">
        <legend>Propriedades do campo</legend>
        <label v-if="page.fields.length">Campo selecionado
          <select :value="selectedId" @change="selectField(($event.target as HTMLSelectElement).value)">
            <option value="">Selecione um campo</option>
            <option v-for="field in page.fields" :key="field.id" :value="field.id">{{ field.label }} ({{ field.reference }})</option>
          </select>
        </label>
        <template v-if="selected">
          <button ref="valueModeButton" type="button" :disabled="selected.readOnly" :aria-pressed="editingValue" @click="toggleValueEditing">
            {{ editingValue ? 'Mover campo' : 'Editar valor no campo' }}
          </button>
          <label>Rótulo do campo
            <input :value="selected.label" maxlength="60" @input="updateField(selected.id,{label:($event.target as HTMLInputElement).value})">
          </label>
          <label>Referência do campo
            <input :value="selected.reference" maxlength="64" placeholder="Ex. for" autocapitalize="none" spellcheck="false"
              @input="updateField(selected.id,{reference:($event.target as HTMLInputElement).value})">
          </label>
          <label>Tipo do campo
            <select aria-label="Tipo do campo" :value="selected.type" @change="changeType(selected,($event.target as HTMLSelectElement).value as FieldType)">
              <option v-for="(label,type) in types" :key="type" :value="type">{{ label }}</option>
            </select>
          </label>
          <label v-if="selected.type==='bar'">Máximo da barra
            <input inputmode="numeric" :value="selected.maximum" @change="changeBar(selected,($event.target as HTMLInputElement).value,true)">
          </label>
          <label v-if="hasOptions(selected.type)" class="option-settings">Opções (uma por linha)
            <textarea :key="selected.id" :value="selected.options.join('\n')" rows="3" maxlength="1220"
              @change="changeOptions(selected,($event.target as HTMLTextAreaElement).value)"></textarea>
          </label>
          <label>Largura do campo
            <input inputmode="numeric" :value="selected.width" @change="updateField(selected.id,fieldRect(selected.x,selected.y,Number(($event.target as HTMLInputElement).value),selected.height))">
          </label>
          <label>Altura do campo
            <input inputmode="numeric" :value="selected.height" @change="updateField(selected.id,fieldRect(selected.x,selected.y,selected.width,Number(($event.target as HTMLInputElement).value)))">
          </label>
          <div class="field-flags">
            <label><input type="checkbox" :checked="selected.highlight" @change="updateField(selected.id,{highlight:($event.target as HTMLInputElement).checked})"> Destacar campo</label>
            <label><input type="checkbox" :checked="selected.hideLabel" @change="updateField(selected.id,{hideLabel:($event.target as HTMLInputElement).checked})"> Ocultar rótulo</label>
            <label><input type="checkbox" :checked="selected.readOnly"
              @change="editingValue=false;updateField(selected.id,{readOnly:($event.target as HTMLInputElement).checked})"> Somente leitura</label>
            <label><input type="checkbox" :checked="selected.tokenShortcut === true"
              @change="updateField(selected.id,{tokenShortcut:($event.target as HTMLInputElement).checked})"> Possui atalho no token</label>
          </div>
          <button type="button" @click="removeField">Excluir campo</button>
        </template>
      </fieldset>
    </div>
  </div>
</template>

<style scoped>
.sheet-editor { min-width:0; }
.sheet-toolbar, .sheet-toolbar nav, .sheet-tools, .field-flags { display:flex; flex-wrap:wrap; align-items:center; gap:8px; }
.sheet-toolbar, .sheet-tools { margin-bottom:12px; }
.sheet-editor button { border:1px solid #79548d; border-radius:6px; background:#3b2849; color:#eadff3; padding:7px 10px; font-size:12px; cursor:pointer; }
.sheet-editor button[aria-current="page"] { background:#65447c; border-color:#c49de5; }
.sheet-editor button:disabled { opacity:.55; cursor:default; }
.sheet-instruction { margin:0 0 8px; font-size:12px; color:#dfcaee; }
.sheet-tools label { margin:0; font-size:12px; min-width:0; }
.sheet-tools input { max-width:100%; }
.field-settings { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,145px),1fr)); align-items:end; gap:8px 12px; padding:10px; min-width:0; border:1px solid #59436a; border-radius:8px; }
.field-settings legend { padding:0 6px; color:#dfcaee; }
.field-settings label { margin:0; font-size:12px; }
.field-settings input, .field-settings select, .field-settings textarea { width:100%; padding:6px; margin:3px 0 0; }
.field-settings textarea { background:#17111e; color:#eadff3; border:1px solid #59436a; border-radius:6px; resize:vertical; }
.field-flags { grid-column:1/-1; }
.field-flags label { display:flex; align-items:center; gap:4px; }
.field-flags input[type=checkbox] { width:auto; margin:0; }
.sheet-workspace { display:grid; gap:12px; min-width:0; }
@media (min-width:900px) {
  .sheet-workspace.show-settings { grid-template-columns:minmax(0,1fr) 210px; align-items:start; }
  .sheet-workspace .field-settings { grid-template-columns:1fr; }
}
.sheet-viewport { width:100%; min-width:0; max-height:65vh; overflow:auto; border:1px solid #765a88; border-radius:6px; background:#15101d; overscroll-behavior:contain; }
.sheet-board { position:relative; background:#f4f0e9; isolation:isolate; }
.sheet-background { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; z-index:-1; }
.sheet-empty { margin:0; padding:24px; color:#634c70; }
.sheet-field { position:absolute; border-radius:4px; color:#211729; }
.sheet-field.highlight { background:#ffffffe8; box-shadow:inset 0 0 0 1px #8f8298; }
.is-editing .sheet-field { outline:1px dashed #79548d; }
.is-editing .sheet-field.selected { outline:2px solid #6e349e; background:#d5a3ff65; box-shadow:inset 0 0 0 1px #fff; z-index:1; }
.is-placing { cursor:crosshair; touch-action:none; }
.is-placing .sheet-field, .sheet-empty { pointer-events:none; }
.draw-preview { position:absolute; z-index:2; pointer-events:none; border:2px solid #6e349e; background:#d5a3ff65; }
.field-content { height:100%; display:flex; flex-direction:column; gap:0; padding:0 2px; overflow:hidden; }
.field-content label { margin:0; color:inherit; font-size:12px; }
.field-label { font-size:12px; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:none; }
.field-content .plain-control { width:100%; min-height:0; flex:1; margin:0; padding:0 1px; font-size:var(--field-font,14px); line-height:1; border:1px solid transparent; background:transparent; color:inherit; }
.field-content .number-control { text-align:center; }
.field-content textarea.plain-control { resize:none; line-height:1.2; }
.field-content .plain-control:focus { outline:1px solid #68408c; border-color:#68408c; }
.field-content select option { background:#fff; color:#211729; }
.field-content input[type=checkbox], .field-content input[type=radio] { width:auto; align-self:start; margin:2px; accent-color:#68408c; }
.bar-control, .radio-options { display:flex; flex-wrap:wrap; gap:2px 6px; align-items:center; font-size:12px; }
.bar-control input[type=range] { flex:1 1 42px; min-width:0; height:16px; margin:0; padding:0; border:0; background:transparent; appearance:none; cursor:pointer; }
.bar-control input[type=range]::-webkit-slider-runnable-track { height:8px; border-radius:8px; background:linear-gradient(to right,#68408c var(--fill),#cfc1da var(--fill)); }
.bar-control input[type=range]::-moz-range-track { height:8px; border-radius:8px; background:linear-gradient(to right,#68408c var(--fill),#cfc1da var(--fill)); }
.bar-control input[type=range]::-webkit-slider-thumb { appearance:none; width:14px; height:14px; margin-top:-3px; border:2px solid #f1e6fc; border-radius:50%; background:#68408c; }
.bar-control input[type=range]::-moz-range-thumb { width:10px; height:10px; border:2px solid #f1e6fc; border-radius:50%; background:#68408c; }
.radio-options { overflow:auto; scrollbar-width:thin; }
.radio-options label { display:flex; align-items:center; }
.sheet-field .macro-trigger {
  position:absolute; top:50%; left:calc(100% + 4px); z-index:2; transform:translateY(-50%);
  width:24px; height:24px; display:grid; place-items:center; padding:0; font-size:11px; line-height:1;
  background:#4e3166; border-color:#d1a7f4; color:#fff;
}
.sheet-field .macro-trigger-left { left:auto; right:calc(100% + 4px); }
.sheet-field .macro-trigger:focus-visible { outline:2px solid #301846; outline-offset:2px; }
.sheet-field .move-handle { position:absolute; inset:0; width:100%; border:0; padding:0 6px; background:transparent; color:#382449; cursor:grab; touch-action:none; text-align:left; }

.sheet-field .move-handle:active { cursor:grabbing; }
.sheet-field .resize-handle { position:absolute; right:0; bottom:0; width:12px; height:12px; padding:0; border:2px solid #6e349e; border-radius:2px; background:#fff; cursor:nwse-resize; touch-action:none; transform:translate(50%,50%); }
.sheet-field .resize-handle.left { left:0; right:auto; translate:-12px 0; cursor:nesw-resize; }
.sheet-field .resize-handle.top { top:0; bottom:auto; translate:0 -12px; cursor:nesw-resize; }
.sheet-field .resize-handle.left.top { translate:-12px -12px; cursor:nwse-resize; }
.sheet-error { color:#ffc0d0; }
</style>
