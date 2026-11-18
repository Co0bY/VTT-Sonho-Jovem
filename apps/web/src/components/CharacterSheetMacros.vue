<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { events, macroText, parseMacros, type MacroAction, type MacroEvent, type MacroField, type SheetMacro } from '../tabletop/sheet-macros'

const props=defineProps<{modelValue:SheetMacro[];fields:MacroField[];disabled:boolean}>()
const emit=defineEmits<{'update:modelValue':[rules:SheetMacro[]]}>()
const mode=ref<'blocks'|'text'>('blocks')
const source=ref('')
const textError=ref('')
const blockError=ref('')
const newField=ref('')
const availableField=computed(()=>props.fields.find(field=>field.id===newField.value)??props.fields[0])
type Block={kind:'field';id:string}|{kind:'event';event:MacroEvent}|{kind:'action';action:MacroAction}
let dragged:Block|undefined
watch(()=>props.fields.map(field=>`${field.id}/${field.reference}`).join(','),()=>{
  if(mode.value==='text'&&!textError.value)source.value=macroText(props.modelValue,props.fields)
})

function switchMode(next:'blocks'|'text'){
  if(next===mode.value||textError.value)return
  blockError.value=''
  if(next==='text')source.value=macroText(props.modelValue,props.fields)
  mode.value=next
}
function changeText(text:string){
  source.value=text
  try{
    const rules=parseMacros(text,props.fields)
    textError.value=''
    emit('update:modelValue',rules)
  }catch(error){
    textError.value=(error as Error).message
  }
}
function validateText(){
  if(mode.value==='text')changeText(source.value)
  return textError.value
}
defineExpose({validateText})

function add(fieldId=availableField.value?.id){
  if(!fieldId||props.disabled)return
  if(props.modelValue.length>=100){blockError.value='A ficha aceita até 100 regras.';return}
  const event=(Object.keys(events) as MacroEvent[]).find(key=>!props.modelValue.some(rule=>rule.fieldId===fieldId&&rule.event===key))
  if(!event){blockError.value='Esse campo já tem uma regra para cada evento.';return}
  blockError.value=''
  emit('update:modelValue',[...props.modelValue,{fieldId,event,action:{kind:'chat'}}])
}
function update(index:number,patch:Partial<SheetMacro>){
  const updated={...props.modelValue[index]!,...patch}
  if(props.modelValue.some((rule,position)=>position!==index&&rule.fieldId===updated.fieldId&&rule.event===updated.event)){
    blockError.value='Já existe uma ação para esse campo e evento.'
    return false
  }
  blockError.value=''
  emit('update:modelValue',props.modelValue.map((rule,position)=>position===index?updated:rule))
  return true
}
function changeSlot(index:number,event:Event,slot:'fieldId'|'event'){
  const input=event.target as HTMLSelectElement
  const patch=slot==='fieldId'?{fieldId:input.value}:{event:input.value as MacroEvent}
  if(!update(index,patch))input.value=props.modelValue[index]![slot]
}
function remove(index:number){
  blockError.value=''
  emit('update:modelValue',props.modelValue.filter((_,position)=>position!==index))
}
function beginDrag(event:DragEvent,block:Block){
  if(props.disabled||!event.dataTransfer)return
  dragged=block
  event.dataTransfer.setData('text/plain','macro-da-ficha')
  event.dataTransfer.effectAllowed='copy'
}
function drop(event:DragEvent,index?:number){
  const block=dragged
  dragged=undefined
  if(!block||props.disabled)return
  event.stopPropagation()
  if(index===undefined){
    if(block.kind==='field')add(block.id)
    else blockError.value='Arraste um campo para criar uma regra.'
    return
  }
  if(block.kind==='field')update(index,{fieldId:block.id})
  if(block.kind==='event')update(index,{event:block.event})
  if(block.kind==='action')update(index,{action:block.action})
}
</script>

<template>
  <div class="macro-editor">
    <div class="macro-modes" aria-label="Modo de edição das regras">
      <button type="button" :aria-pressed="mode==='blocks'" :disabled="disabled || !!textError" @click="switchMode('blocks')">Blocos</button>
      <button type="button" :aria-pressed="mode==='text'" :disabled="disabled" @click="switchMode('text')">Editor de texto</button>
    </div>
    <p v-if="!fields.length">Adicione um campo na aba Ficha para criar sua primeira regra.</p>
    <template v-if="mode==='blocks' && fields.length">
      <div class="macro-palette" @dragend="dragged=undefined">
        <div class="macro-palette-row">
          <span>Campos</span>
          <span v-for="field in fields" :key="field.id" class="macro-tile field-tile" :draggable="!disabled"
            @dragstart="beginDrag($event,{kind:'field',id:field.id})">{{ field.label }} <code>{{ field.reference }}</code></span>
        </div>
        <div class="macro-palette-row">
          <span>Eventos</span>
          <span v-for="(label,event) in events" :key="event" class="macro-tile event-tile" :draggable="!disabled"
            @dragstart="beginDrag($event,{kind:'event',event})">{{ label }}</span>
        </div>
        <div class="macro-palette-row">
          <span>Ações</span>
          <span class="macro-tile action-tile" :draggable="!disabled" @dragstart="beginDrag($event,{kind:'action',action:{kind:'rolar',sides:6}})">Rolar dados</span>
          <span class="macro-tile action-tile" :draggable="!disabled" @dragstart="beginDrag($event,{kind:'action',action:{kind:'chat'}})">Enviar ao chat</span>
        </div>
      </div>
      <div v-for="(rule,index) in modelValue" :key="index" class="macro-rule" @dragover.prevent @drop.prevent="drop($event,index)">
        <div class="macro-rule-blocks">
          <label class="macro-tile field-tile">Campo
            <select :aria-label="`Campo da regra ${index+1}`" :value="rule.fieldId" :disabled="disabled"
              @change="changeSlot(index,$event,'fieldId')">
              <option v-for="field in fields" :key="field.id" :value="field.id">{{ field.label }} ({{ field.reference }})</option>
            </select>
          </label>
          <label class="macro-tile event-tile">Quando
            <select :aria-label="`Evento da regra ${index+1}`" :value="rule.event" :disabled="disabled"
              @change="changeSlot(index,$event,'event')">
              <option v-for="(label,event) in events" :key="event" :value="event">{{ label }}</option>
            </select>
          </label>
          <label class="macro-tile action-tile">Faça
            <select :aria-label="`Ação da regra ${index+1}`" :value="rule.action.kind" :disabled="disabled"
              @change="update(index,{action:($event.target as HTMLSelectElement).value==='chat'?{kind:'chat'}:{kind:'rolar',sides:6}})">
              <option value="chat">Enviar ao chat</option><option value="rolar">Rolar dados</option>
            </select>
          </label>
          <label v-if="rule.action.kind==='rolar'" class="macro-tile action-tile">Faces do dado
            <input :aria-label="`Faces da regra ${index+1}`" inputmode="numeric" :value="rule.action.sides" :disabled="disabled"
              @change="update(index,{action:{kind:'rolar',sides:Math.round(Math.min(1000,Math.max(2,Number(($event.target as HTMLInputElement).value)||6)))}})">
          </label>
        </div>
        <button type="button" :aria-label="`Excluir regra ${index+1}`" :disabled="disabled" @click="remove(index)">Excluir</button>
      </div>
      <div class="macro-drop" @dragover.prevent @drop.prevent="drop($event)">
        <span>Solte um campo aqui para criar uma regra. Solte eventos e ações sobre uma regra para alterá-la.</span>
        <div class="macro-add">
          <select aria-label="Campo para nova regra" :value="availableField?.id" :disabled="disabled" @change="newField=($event.target as HTMLSelectElement).value">
            <option v-for="field in fields" :key="field.id" :value="field.id">{{ field.label }} ({{ field.reference }})</option>
          </select>
          <button type="button" :disabled="disabled" @click="add()">Adicionar regra</button>
        </div>
      </div>
      <p v-if="blockError" class="macro-error" role="alert">{{ blockError }}</p>
    </template>
    <template v-else-if="mode==='text'">
      <label class="macro-source">Regras da ficha
        <textarea rows="9" maxlength="16000" :value="source" :disabled="disabled" spellcheck="false" autocapitalize="none"
          @input="changeText(($event.target as HTMLTextAreaElement).value)"></textarea>
      </label>
      <p v-if="textError" class="macro-error" role="alert">{{ textError }}</p>
      <p>Escreva uma regra por linha, usando a referência do campo. Eventos válidos: <code>clique</code>, <code>enter</code> e <code>mudanca</code>.</p>
      <pre>quando for clique rolar d6
quando frase enter chat</pre>
    </template>
  </div>
</template>

<style scoped>
.macro-editor{display:grid;gap:12px;min-width:0}
.macro-modes,.macro-palette-row,.macro-rule-blocks,.macro-add{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.macro-editor button{border:1px solid #79548d;border-radius:6px;background:#3b2849;color:#eadff3;padding:8px 12px;cursor:pointer}
.macro-editor button[aria-pressed="true"]{background:#65447c;border-color:#c49de5}
.macro-editor button:disabled{opacity:.6;cursor:default}
.macro-palette{display:grid;gap:8px;padding:12px;background:#21172b;border-radius:8px}
.macro-palette-row>span:first-child{min-width:62px;color:#ddc9ed}
.macro-tile{padding:6px 10px;border-radius:7px;font-size:12px;color:#fff;margin:0}
.macro-tile[draggable="true"]{cursor:grab}
.field-tile{background:#503778}.event-tile{background:#83541b}.action-tile{background:#176248}
.macro-rule{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;padding:8px;border:1px solid #59436a;border-radius:8px}
.macro-rule label{display:grid;gap:4px}
.macro-rule select,.macro-rule input,.macro-add select{width:auto;max-width:100%;margin:0;padding:5px}
.macro-rule input{width:84px}
.macro-drop{border:1px dashed #a487b6;border-radius:8px;padding:12px;display:grid;gap:8px;color:#ddc9ed}
.macro-source textarea{display:block;width:100%;margin-top:6px;padding:10px;background:#181121;color:#f4e9fc;border:1px solid #79548d;border-radius:7px;resize:vertical;font-family:monospace}
.macro-editor p,.macro-editor pre{margin:0}
.macro-error{color:#ffc0d0}
</style>
