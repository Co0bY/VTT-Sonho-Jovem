<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { CharacterSheet, SheetField } from '../tabletop/character-sheet'
import { sheetError } from '../tabletop/character-sheet'
const props=defineProps<{modelValue:CharacterSheet;background:string|null|undefined;disabled:boolean}>()
const emit=defineEmits<{'update:modelValue':[sheet:CharacterSheet];background:[event:Event];removeBackground:[]}>()
const editing=ref(false),selectedId=ref(''),backgroundError=ref('')
const selected=computed(()=>props.modelValue.fields.find(field=>field.id===selectedId.value))
const validation=computed(()=>sheetError(props.modelValue))
const board=ref<HTMLElement>(),backgroundInput=ref<HTMLInputElement>()
let fitNextImage=false
let drag:{pointer:number;id:string;x:number;y:number;clientX:number;clientY:number}|undefined
function updateField(id:string,patch:Partial<SheetField>){
  emit('update:modelValue',{...props.modelValue,fields:props.modelValue.fields.map(field=>field.id===id?{...field,...patch}:field)})
}
function addField(){
  if(props.disabled||props.modelValue.fields.length>=100)return
  let index=1
  while(props.modelValue.fields.some(field=>field.reference===`campo_${index}`))index++
  const field:SheetField={id:crypto.randomUUID(),label:`Campo ${index}`,reference:`campo_${index}`,type:'text',x:24,y:24,width:200,value:''}
  selectedId.value=field.id
  emit('update:modelValue',{...props.modelValue,fields:[...props.modelValue.fields,field]})
}
function removeField(){
  if(!selected.value||props.disabled)return
  emit('update:modelValue',{...props.modelValue,fields:props.modelValue.fields.filter(field=>field.id!==selectedId.value)})
  selectedId.value=''
}
function changeWidth(event:Event){
  if(!selected.value)return
  const width=Math.max(80,Math.min(600,Number((event.target as HTMLInputElement).value)||200))
  updateField(selected.value.id,{width,x:Math.min(selected.value.x,props.modelValue.width-width)})
}
function changeType(event:Event){
  if(!selected.value)return
  updateField(selected.value.id,{type:(event.target as HTMLSelectElement).value as SheetField['type']})
}
function down(event:PointerEvent,field:SheetField){
  if(!editing.value||props.disabled||event.button!==0)return
  selectedId.value=field.id
  if((event.target as HTMLElement).closest('input'))return
  event.preventDefault()
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  drag={pointer:event.pointerId,id:field.id,x:field.x,y:field.y,clientX:event.clientX,clientY:event.clientY}
}
function move(event:PointerEvent){
  if(!drag||drag.pointer!==event.pointerId||!board.value||props.disabled)return
  const field=props.modelValue.fields.find(field=>field.id===drag!.id)
  if(!field)return
  const bounds=board.value.getBoundingClientRect()
  const x=drag.x+(event.clientX-drag.clientX)*props.modelValue.width/bounds.width
  const y=drag.y+(event.clientY-drag.clientY)*props.modelValue.height/bounds.height
  updateField(field.id,{x:Math.round(Math.max(0,Math.min(props.modelValue.width-field.width,x))),y:Math.round(Math.max(0,Math.min(props.modelValue.height-64,y)))})
}
function up(event:PointerEvent){
  if(!drag||drag.pointer!==event.pointerId)return
  if(event.type==='pointercancel')updateField(drag.id,{x:drag.x,y:drag.y})
  drag=undefined
  const element=event.currentTarget as HTMLElement
  if(element.hasPointerCapture(event.pointerId))element.releasePointerCapture(event.pointerId)
}
function keyboard(event:KeyboardEvent,field:SheetField){
  if(!editing.value||props.disabled)return
  const directions:Record<string,[number,number]>={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}
  const delta=directions[event.key]
  if(!delta)return
  event.preventDefault();event.stopPropagation()
  const step=event.shiftKey?10:1
  updateField(field.id,{x:Math.max(0,Math.min(props.modelValue.width-field.width,field.x+delta[0]*step)),y:Math.max(0,Math.min(props.modelValue.height-64,field.y+delta[1]*step))})
}
function removeBackground(){fitNextImage=false;if(backgroundInput.value)backgroundInput.value.value='';emit('removeBackground')}
function selectBackground(event:Event){fitNextImage=true;backgroundError.value='';emit('background',event)}
function imageLoaded(event:Event){
  backgroundError.value=''
  if(!fitNextImage)return
  fitNextImage=false
  const img=event.target as HTMLImageElement,sheet=props.modelValue
  const height=Math.max(300,Math.min(4000,Math.round(sheet.width*img.naturalHeight/img.naturalWidth)))
  emit('update:modelValue',{...sheet,height,fields:sheet.fields.map(field=>({...field,y:Math.round(Math.min(height-64,field.y*height/sheet.height))}))})
}
function finishEditing(){editing.value=false;drag=undefined}
defineExpose({finishEditing})
watch(()=>props.background,()=>{backgroundError.value=''})
</script>
<template>
  <div class="sheet-editor">
    <div class="sheet-toolbar"><button type="button" class="sheet-mode" :disabled="disabled" :aria-pressed="editing" @click="editing=!editing;drag=undefined">{{ editing ? 'Concluir edição' : 'Editar ficha' }}</button><span>{{ editing ? 'Arraste os campos pela alça. Selecione um campo para alterar rótulo e referência.' : 'Preencha os campos da ficha. Para mudar o layout, use Editar ficha.' }}</span></div>
    <div v-if="editing" class="sheet-layout-tools">
      <label>Imagem de fundo da ficha<input ref="backgroundInput" type="file" accept="image/png,image/jpeg,image/webp" :disabled="disabled" @change="selectBackground"></label>
      <button v-if="background" type="button" :disabled="disabled" @click="removeBackground">Remover fundo da ficha</button>
      <button type="button" :disabled="disabled || modelValue.fields.length>=100" @click="addField">+ Adicionar campo</button>
      <small>PNG, JPEG ou WebP de até 10 MB. Até 100 campos por ficha.</small>
    </div>
    <fieldset v-if="editing && selected" class="sheet-field-settings" :disabled="disabled"><legend>Editar campo</legend>
      <label>Rótulo do campo<input :value="selected.label" maxlength="60" @input="updateField(selected.id,{label:($event.target as HTMLInputElement).value})"></label>
      <label>Referência do campo<input :value="selected.reference" maxlength="64" placeholder="Ex.: for" autocapitalize="none" spellcheck="false" @input="updateField(selected.id,{reference:($event.target as HTMLInputElement).value})"></label>
      <label>Tipo do campo<select aria-label="Tipo do campo" :value="selected.type" @change="changeType"><option value="text">Texto</option><option value="number">Número</option></select></label>
      <label>Largura do campo<input type="number" :value="selected.width" min="80" max="600" @change="changeWidth"></label>
      <button type="button" @click="removeField">Excluir campo</button>
      <small>Use uma referência única para identificar o campo. Ex.: Força → for.</small>
    </fieldset>
    <p v-if="validation" role="alert" class="sheet-error">{{ validation }}</p>
    <p v-if="backgroundError" role="alert" class="sheet-error">{{ backgroundError }}</p>
    <div class="sheet-viewport" tabindex="0" aria-label="Área da ficha; role para ver toda a página">
      <div ref="board" class="sheet-board" :class="{'is-editing':editing}" :style="{width:`${modelValue.width}px`,height:`${modelValue.height}px`}">
        <img v-if="background" class="sheet-background" :src="background" alt="Fundo da ficha" draggable="false" @load="imageLoaded" @error="backgroundError='Não foi possível carregar o fundo da ficha.'">
        <p v-if="!modelValue.fields.length && !background" class="sheet-empty">Use Editar ficha para adicionar uma imagem de fundo e seus primeiros campos.</p>
        <div v-for="field in modelValue.fields" :key="field.id" class="sheet-field" :class="{selected:editing && selectedId===field.id}" :data-sheet-field="field.id" :style="{left:`${field.x}px`,top:`${field.y}px`,width:`${field.width}px`}" @pointerdown="down($event,field)" @pointermove="move" @pointerup="up" @pointercancel="up">
          <div class="sheet-field-label"><label :for="`sheet-value-${field.id}`">{{ field.label }}</label><button v-if="editing" type="button" class="sheet-drag" :disabled="disabled" :aria-label="`Mover campo ${field.label}`" @keydown="keyboard($event,field)">⠿</button></div>
          <input :id="`sheet-value-${field.id}`" :value="field.value" :readonly="editing" :disabled="disabled" :inputmode="field.type==='number'?'decimal':'text'" maxlength="1000" :data-reference="field.reference" @input="updateField(field.id,{value:($event.target as HTMLInputElement).value})">
        </div>
      </div>
    </div>
    <small class="sheet-save-hint">Use Salvar personagem para guardar o fundo, os campos e seus valores. Cancelar descarta as alterações.</small>
  </div>
</template>
<style scoped>
.sheet-editor{min-width:0}.sheet-toolbar{display:flex;align-items:center;gap:12px;margin-bottom:14px}.sheet-toolbar span,.sheet-save-hint,.sheet-layout-tools small,.sheet-field-settings small{font-size:11px;color:#bba3cb;line-height:1.6}.sheet-editor button{border:1px solid #79548d;border-radius:6px;background:#3b2849;color:#eadff3;padding:8px 12px;font-size:12px;cursor:pointer}.sheet-toolbar .sheet-mode{flex-shrink:0}.sheet-layout-tools{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-bottom:16px}.sheet-layout-tools label{margin:0;font-size:12px;flex:1;min-width:180px}.sheet-layout-tools input{font-size:11px;max-width:100%}.sheet-layout-tools small{flex-basis:100%}.sheet-field-settings{border:1px solid #59436a;border-radius:8px;display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;padding:14px;margin-bottom:16px;min-width:0}.sheet-field-settings legend{font-size:12px;padding:0 8px;color:#d8c0ed}.sheet-field-settings label{margin:0;font-size:12px;min-width:0}.sheet-field-settings input,.sheet-field-settings select{width:100%;margin:6px 0 0;padding:9px}.sheet-field-settings button{justify-self:start}.sheet-field-settings small{grid-column:1/-1}.sheet-viewport{width:100%;max-height:65vh;overflow:auto;border:1px solid #765a88;border-radius:6px;background:#15101d;position:relative;overscroll-behavior:contain}.sheet-board{position:relative;background:#f4f0e9;isolation:isolate}.sheet-board.is-editing{background-image:linear-gradient(#56387615 1px,transparent 1px),linear-gradient(90deg,#56387615 1px,transparent 1px);background-size:20px 20px}.sheet-background{position:absolute;inset:0;width:100%;height:100%;object-fit:fill;pointer-events:none;z-index:-1}.sheet-empty{margin:0!important;padding:30px;color:#634c70!important;max-width:500px;line-height:1.8}.sheet-field{position:absolute;height:64px;background:#ffffffdf;border:1px solid #8f8298;border-radius:4px;box-sizing:border-box;padding:4px 7px;overflow:hidden;color:#281b33;touch-action:pan-x pan-y}.is-editing .sheet-field{touch-action:none;cursor:move}.sheet-field.selected{outline:2px solid #8e54ba;outline-offset:1px;z-index:1}.sheet-field-label{display:flex;align-items:center;justify-content:space-between;height:20px;gap:6px}.sheet-field-label label{font-size:12px;margin:0;color:#392445;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.sheet-field input{background:#fff!important;border:1px solid #b8adbf!important;border-radius:3px!important;color:#211729!important;font-size:14px!important;height:28px!important;padding:3px 6px!important;width:100%!important;margin:3px 0 0!important;box-sizing:border-box}.sheet-field .sheet-drag{padding:0 4px;line-height:18px;border:0;border-radius:3px;font-size:19px;cursor:grab;background:#e4d7f0;color:#5d3677;flex-shrink:0}.sheet-save-hint{display:block;margin-top:12px}.sheet-error{color:#ffc0d0!important;font-size:12px}@media(max-width:540px){.sheet-toolbar{align-items:flex-start;flex-direction:column}.sheet-field-settings{grid-template-columns:1fr}.sheet-layout-tools{align-items:stretch;flex-direction:column}}
</style>
