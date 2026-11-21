<script setup lang="ts">
import FilterSelect from './FilterSelect.vue'
import { selectOptions } from '../tabletop/select-options'
import { computed, ref, watch } from 'vue'
import { events, diceAction, reductions, MAX_DICE_GROUPS, macroText, parseMacros, type DiceAction, type DiceGroup, type Reduction, type MacroAction, type MacroEvent, type MacroField, type SheetMacro } from '../tabletop/sheet-macros'

const props=defineProps<{modelValue:SheetMacro[];fields:MacroField[];disabled:boolean}>()
const emit=defineEmits<{'update:modelValue':[rules:SheetMacro[]]}>()
const fieldsForSelect = computed(() => props.fields.map(field => ({ value: field.id, label: `${field.label} (${field.reference})` })))
const eventOptions = selectOptions(events)
const actionOptions = computed(() => [
  { value: 'chat', label: 'Enviar ao chat' },
  { value: 'rolar', label: 'Rolar dados' },
  { value: 'atribuir', label: 'Atualizar outro campo', disabled: props.fields.length < 2 },
])
const quantityOptions = selectOptions({ input: 'Valor do input', fixed: 'Definir valor' })
const reductionOptions = selectOptions(reductions)
const resultOptions = [{ value: '', label: 'Sem cálculo' }, { value: 'sucesso', label: 'Definir Sucesso' }, ...reductionOptions]
const combineOptions = [{ value: '', label: 'Mostrar separados' }, ...reductionOptions]
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
  else update(index,{action:kind==='chat'?{kind:'chat'}:{kind:'rolar',sides:6}})
}
function groupAction(rule:SheetMacro){
  return rule.action.kind==='rolar'?diceAction(rule.action):null
}
function updateDice(index:number,patch:Partial<DiceAction>){
  const action=groupAction(props.modelValue[index]!)
  if(action)update(index,{action:{...action,...patch}})
}
function updateGroup(index:number,groupIndex:number,patch:Partial<DiceGroup>){
  const groups=groupAction(props.modelValue[index]!)?.groups
  if(!groups)return
  const updated=groups.map((group,position)=>position===groupIndex?{...group,...patch}:group)
  updateDice(index,{groups:updated,...(updated.some(group=>group.reduction===null)?{combine:null}:{})})
}
function addGroup(index:number){
  const groups=groupAction(props.modelValue[index]!)?.groups
  if(groups&&groups.length<MAX_DICE_GROUPS)updateDice(index,{groups:[...groups,{count:1,sides:6,reduction:'somar'}]})
}
function removeGroup(index:number,groupIndex:number){
  const groups=groupAction(props.modelValue[index]!)?.groups
  if(groups&&groups.length>1)updateDice(index,{groups:groups.filter((_,position)=>position!==groupIndex),...(groups.length===2?{combine:null}:{})})
}
function editGroupNumber(index:number,groupIndex:number,event:Event,key:'count'|'sides'){
  const input=event.target as HTMLInputElement
  const min=key==='count'?1:2
  const max=key==='count'?50:1000
  const value=Number(input.value)
  if(/^\d+$/.test(input.value)&&value>=min&&value<=max){
    const group=groupAction(props.modelValue[index]!)?.groups[groupIndex]
    const success=group?.success
    if(key==='sides'&&success){
      updateGroup(index,groupIndex,{sides:value,success:{min:Math.min(success.min,value),max:Math.min(success.max,value)}})
    }else updateGroup(index,groupIndex,{[key]:value})
  }
}
function setGroupResult(index:number,groupIndex:number,group:DiceGroup,operation:Reduction|'sucesso'|''){
  if(operation==='sucesso'){
    updateGroup(index,groupIndex,{reduction:'sucesso',success:{min:Math.min(4,group.sides),max:group.sides}})
  }else updateGroup(index,groupIndex,{reduction:operation||null,success:undefined})
}
function editSuccessRange(index:number,groupIndex:number,group:DiceGroup,event:Event,key:'min'|'max'){
  const input=event.target as HTMLInputElement
  const value=Number(input.value)
  const range=group.success
  if(!range||!/^\d+$/.test(input.value)||value<1||value>group.sides)return
  const success=key==='min'?{min:value,max:Math.max(value,range.max)}:{min:Math.min(value,range.min),max:value}
  updateGroup(index,groupIndex,{success})
}
function restoreGroupNumber(event:Event,value:number){
  const input=event.target as HTMLInputElement
  input.value=String(value)
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
        <div v-if="groupAction(rule)" class="macro-dice">
          <fieldset v-for="(group,groupIndex) in groupAction(rule)?.groups" :key="groupIndex" class="dice-group" :disabled="disabled">
            <legend>Rolagem {{ groupIndex+1 }}</legend>
            <label>Quantidade de dados
              <FilterSelect :aria-label="`Origem da quantidade da rolagem ${groupIndex+1}`" :model-value="group.count===null?'input':'fixed'"
                :options="quantityOptions" compact :disabled="disabled"
                @update:model-value="updateGroup(index,groupIndex,{count:$event==='input'?null:1})" />
            </label>
            <label v-if="group.count!==null">Dados lançados
              <input :aria-label="`Dados lançados na rolagem ${groupIndex+1}`" inputmode="numeric" :value="group.count"
                @input="editGroupNumber(index,groupIndex,$event,'count')" @change="restoreGroupNumber($event,group.count)">
            </label>
            <label>Faces do dado
              <input :aria-label="groupIndex===0?`Faces da regra ${index+1}`:`Faces da rolagem ${groupIndex+1}`" inputmode="numeric" :value="group.sides"
                @input="editGroupNumber(index,groupIndex,$event,'sides')" @change="restoreGroupNumber($event,group.sides)">
            </label>
            <label>Resultado dos dados
              <FilterSelect :aria-label="`Resultado da rolagem ${groupIndex+1}`" :model-value="group.reduction??''"
                :options="resultOptions" compact :disabled="disabled" @update:model-value="setGroupResult(index,groupIndex,group,$event)" />
            </label>
            <template v-if="group.reduction==='sucesso' && group.success">
              <label>Sucesso de
                <input :aria-label="`Início do sucesso da rolagem ${groupIndex+1}`" inputmode="numeric" :value="group.success.min"
                  @input="editSuccessRange(index,groupIndex,group,$event,'min')" @change="restoreGroupNumber($event,group.success.min)">
              </label>
              <label>Até
                <input :aria-label="`Fim do sucesso da rolagem ${groupIndex+1}`" inputmode="numeric" :value="group.success.max"
                  @input="editSuccessRange(index,groupIndex,group,$event,'max')" @change="restoreGroupNumber($event,group.success.max)">
              </label>
            </template>
            <button v-if="(groupAction(rule)?.groups.length??0)>1" type="button" :aria-label="`Remover rolagem ${groupIndex+1}`"
              @click="removeGroup(index,groupIndex)">Remover</button>
          </fieldset>
          <div class="macro-add">
            <button type="button" :disabled="disabled || (groupAction(rule)?.groups.length??0)>=MAX_DICE_GROUPS" @click="addGroup(index)">Adicionar rolagem</button>
            <label v-if="(groupAction(rule)?.groups.length??0)>1">Resultados das rolagens
              <FilterSelect aria-label="Combinar resultados das rolagens" :model-value="groupAction(rule)?.combine??''"
                :options="combineOptions" compact :disabled="disabled || groupAction(rule)?.groups.some(group=>group.reduction===null)"
                @update:model-value="updateDice(index,{combine:$event||null})" />
              <small v-if="groupAction(rule)?.groups.some(group=>group.reduction===null)">Escolha um resultado em cada rolagem para combinar.</small>
            </label>
          </div>
        </div>
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
      <p>Escreva uma regra por linha, usando a referência do campo. Eventos válidos: <code>clique</code>, <code>enter</code> e <code>mudanca</code>.</p>
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
.macro-rule input{width:84px}
.macro-dice{display:grid;gap:8px;flex-basis:100%;min-width:0}
.dice-group{display:flex;flex-wrap:wrap;align-items:end;gap:8px;margin:0;padding:8px 10px;min-width:0;border:1px solid #39755f;border-radius:6px;background:#142c27}
.dice-group legend{padding:0 5px;color:#b9ebd6}
.dice-group label{color:#e2f3ea;font-size:12px}
.macro-drop{border:1px dashed #a487b6;border-radius:8px;padding:12px;display:grid;gap:8px;color:#ddc9ed}
.macro-source textarea{display:block;width:100%;margin-top:6px;padding:10px;background:#181121;color:#f4e9fc;border:1px solid #79548d;border-radius:7px;resize:vertical;font-family:monospace}
.macro-editor p,.macro-editor pre{margin:0}
.macro-error{color:#ffc0d0}
</style>
