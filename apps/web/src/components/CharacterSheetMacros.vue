<script setup lang="ts">
import FilterSelect from './FilterSelect.vue'
import MacroDiceEditor from './MacroDiceEditor.vue'
import MacroChoiceEditor from './MacroChoiceEditor.vue'
import { selectOptions } from '../tabletop/select-options'
import { computed, ref, watch } from 'vue'
import { events, diceAction, newMacroChoice, macroText, parseMacros, type MacroAction, type MacroEvent, type MacroField, type SheetMacro } from '../tabletop/sheet-macros'

const props=defineProps<{modelValue:SheetMacro[];fields:MacroField[];disabled:boolean}>()
const emit=defineEmits<{'update:modelValue':[rules:SheetMacro[]]}>()
const fieldsForSelect = computed(() => props.fields.map(field => ({ value: field.id, label: `${field.label} (${field.reference})` })))
const eventOptions = selectOptions(events)
const actionOptions = computed(() => [
  { value: 'chat', label: 'Enviar ao chat' },
  { value: 'rolar', label: 'Rolar dados' },
  { value: 'atribuir', label: 'Atualizar outro campo', disabled: props.fields.length < 2 },
  { value: 'escolher', label: 'Abrir seletor', disabled: false },
])
const mode=ref<'blocks'|'text'>('blocks')
const source=ref('')
const textError=ref('')
const blockError=ref('')
const newField=ref('')
const availableField=computed(()=>props.fields.find(field=>field.id===newField.value)??props.fields[0])
type Block={kind:'field';id:string}|{kind:'event';event:MacroEvent}|{kind:'action';action:MacroAction}|{kind:'assignment'}
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
  if (mode.value === 'text') {
    changeText(source.value)
    return textError.value
  }
  try {
    parseMacros(macroText(props.modelValue, props.fields), props.fields)
    return ''
  } catch (error) {
    return (error as Error).message
  }
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
  if(updated.action.kind==='atribuir'&&updated.fieldId===updated.action.targetId){
    blockError.value='O campo de destino deve ser diferente do campo de origem.'
    return false
  }
  if(props.modelValue.some((rule,position)=>position!==index&&rule.fieldId===updated.fieldId&&rule.event===updated.event)){
    blockError.value='Já existe uma ação para esse campo e evento.'
    return false
  }
  blockError.value=''
  emit('update:modelValue',props.modelValue.map((rule,position)=>position===index?updated:rule))
  return true
}
function assign(index:number){
  const source=props.modelValue[index]!.fieldId
  const target=props.fields.find(field=>field.id!==source)
  if(!target){blockError.value='Adicione outro campo para usar como destino.';return}
  update(index,{action:{kind:'atribuir',targetId:target.id}})
}
function changeAction(index:number,kind:MacroAction['kind']){
  if(kind==='atribuir')assign(index)
  else if(kind==='escolher')update(index,{action:newMacroChoice()})
  else update(index,{action:kind==='chat'?{kind:'chat'}:{kind:'rolar',sides:6}})
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
  if(block.kind==='assignment')assign(index)
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
          <span class="macro-tile action-tile" :draggable="!disabled"
            @dragstart="beginDrag($event,{kind:'action',action:newMacroChoice()})">Abrir seletor</span>
          <span v-if="fields.length>1" class="macro-tile action-tile" :draggable="!disabled"
            @dragstart="beginDrag($event,{kind:'assignment'})">Atualizar outro campo</span>
        </div>
      </div>
      <div v-for="(rule,index) in modelValue" :key="index" class="macro-rule" @dragover.prevent @drop.prevent="drop($event,index)">
        <div class="macro-rule-blocks">
          <label class="macro-tile field-tile">Campo
            <FilterSelect :aria-label="`Campo da regra ${index+1}`" :model-value="rule.fieldId" :options="fieldsForSelect" compact
              :disabled="disabled" @update:model-value="update(index,{fieldId:$event})" />
          </label>
          <label class="macro-tile event-tile">Quando
            <FilterSelect :aria-label="`Evento da regra ${index+1}`" :model-value="rule.event" :options="eventOptions" compact
              :disabled="disabled" @update:model-value="update(index,{event:$event})" />
          </label>
          <label class="macro-tile action-tile">Faça
            <FilterSelect :aria-label="`Ação da regra ${index+1}`" :model-value="rule.action.kind" :options="actionOptions" compact
              :disabled="disabled" @update:model-value="changeAction(index,$event)" />
          </label>
          <label v-if="rule.action.kind==='atribuir'" class="macro-tile action-tile">Campo de destino
            <FilterSelect :aria-label="`Destino da regra ${index+1}`" :model-value="rule.action.targetId"
              :options="fieldsForSelect.filter(field=>field.value!==rule.fieldId)" compact :disabled="disabled"
              @update:model-value="update(index,{action:{kind:'atribuir',targetId:$event}})" />
          </label>
        </div>
        <button type="button" :aria-label="`Excluir regra ${index+1}`" :disabled="disabled" @click="remove(index)">Excluir</button>
        <MacroDiceEditor v-if="rule.action.kind==='rolar'" :model-value="diceAction(rule.action)"
          :fields="fields" :source-id="rule.fieldId" :rule-number="index+1" :disabled="disabled"
          @update:model-value="update(index,{action:$event})" />
        <label v-else-if="rule.action.kind==='chat'" class="macro-chat-message">Mensagem para o chat
          <input :value="rule.action.text" :disabled="disabled" maxlength="2000" placeholder="Valor do campo atual"
            @input="update(index,{action:{kind:'chat',text:($event.target as HTMLInputElement).value || undefined}})">
        </label>
        <MacroChoiceEditor v-else-if="rule.action.kind==='escolher'" :model-value="rule.action"
          :fields="fields" :source-id="rule.fieldId" :disabled="disabled" @update:model-value="update(index,{action:$event})" />
      </div>
      <div class="macro-drop" @dragover.prevent @drop.prevent="drop($event)">
        <span>Solte um campo aqui para criar uma regra. Solte eventos e ações sobre uma regra para alterá-la.</span>
        <div class="macro-add">
          <FilterSelect aria-label="Campo para nova regra" :model-value="availableField?.id" :options="fieldsForSelect" compact
            :disabled="disabled" @update:model-value="newField=$event" />
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
      <p>Escreva uma regra por linha, usando a referência do campo. Use <code>d6 de atributo</code> para ler outro campo. Os seletores aparecem como <code>escolher</code> seguido do JSON das opções.</p>
      <pre>quando for clique rolar d6
quando frase enter chat
quando for mudanca atribuir bonus
quando ataque clique rolar 2d20 maior, d6 combinar somar</pre>
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
.macro-rule input{max-width:100%;margin:0;padding:5px}
.macro-rule .filter-select,.macro-add .filter-select{width:min(165px,100%)}
.macro-chat-message{width:100%;min-width:0}
.macro-chat-message input{width:100%}
.macro-drop{border:1px dashed #a487b6;border-radius:8px;padding:12px;display:grid;gap:8px;color:#ddc9ed}
.macro-source textarea{display:block;width:100%;margin-top:6px;padding:10px;background:#181121;color:#f4e9fc;border:1px solid #79548d;border-radius:7px;resize:vertical;font-family:monospace}
.macro-editor p,.macro-editor pre{margin:0}
.macro-error{color:#ffc0d0}
</style>
