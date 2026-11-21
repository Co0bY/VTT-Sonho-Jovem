<script setup lang="ts">
import { computed } from 'vue'
import FilterSelect from './FilterSelect.vue'
import { selectOptions } from '../tabletop/select-options'
import { reductions, MAX_DICE_GROUPS, type DiceAction, type DiceGroup, type MacroField, type Reduction } from '../tabletop/sheet-macros'

const props = defineProps<{ modelValue: DiceAction; fields: MacroField[]; sourceId: string; ruleNumber: number; disabled: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [action: DiceAction] }>()
const otherFields = computed(() => props.fields.filter(field => field.id !== props.sourceId)
  .map(field => ({ value: field.id, label: `${field.label} (${field.reference})` })))
const sourceOptions = computed(() => [
  { value: 'current', label: 'Input atual' },
  { value: 'other', label: 'Outro input', disabled: !otherFields.value.length },
])
const quantityOptions = selectOptions({ input: 'Valor do input', fixed: 'Definir valor' })
const reductionOptions = selectOptions(reductions)
const resultOptions = [{ value: '', label: 'Sem cálculo' }, { value: 'sucesso', label: 'Definir Sucesso' }, ...reductionOptions]
const combineOptions = [{ value: '', label: 'Mostrar separados' }, ...reductionOptions]

function updateDice(patch: Partial<DiceAction>) {
  emit('update:modelValue', { ...props.modelValue, ...patch })
}
function updateGroup(groupIndex:number,patch:Partial<DiceGroup>){
  const groups=props.modelValue.groups
  const updated=groups.map((group,position)=>position===groupIndex?{...group,...patch}:group)
  updateDice({groups:updated,...(updated.some(group=>group.reduction===null)?{combine:null}:{})})
}
function addGroup(){
  const groups=props.modelValue.groups
  if(groups.length<MAX_DICE_GROUPS)updateDice({groups:[...groups,{count:1,sides:6,reduction:'somar'}]})
}
function removeGroup(groupIndex:number){
  const groups=props.modelValue.groups
  if(groups.length>1)updateDice({groups:groups.filter((_,position)=>position!==groupIndex),...(groups.length===2?{combine:null}:{})})
}
function editGroupNumber(groupIndex:number,event:Event,key:'count'|'sides'){
  const input=event.target as HTMLInputElement
  const min=key==='count'?1:2
  const max=key==='count'?50:1000
  const value=Number(input.value)
  if(/^\d+$/.test(input.value)&&value>=min&&value<=max){
    const group=props.modelValue.groups[groupIndex]
    const success=group?.success
    if(key==='sides'&&success){
      updateGroup(groupIndex,{sides:value,success:{min:Math.min(success.min,value),max:Math.min(success.max,value)}})
    }else updateGroup(groupIndex,{[key]:value})
  }
}
function setGroupResult(groupIndex:number,group:DiceGroup,operation:Reduction|'sucesso'|''){
  if(operation==='sucesso'){
    updateGroup(groupIndex,{reduction:'sucesso',success:{min:Math.min(4,group.sides),max:group.sides}})
  }else updateGroup(groupIndex,{reduction:operation||null,success:undefined})
}
function editSuccessRange(groupIndex:number,group:DiceGroup,event:Event,key:'min'|'max'){
  const input=event.target as HTMLInputElement
  const value=Number(input.value)
  const range=group.success
  if(!range||!/^\d+$/.test(input.value)||value<1||value>group.sides)return
  const success=key==='min'?{min:value,max:Math.max(value,range.max)}:{min:Math.min(value,range.min),max:value}
  updateGroup(groupIndex,{success})
}
function restoreGroupNumber(event:Event,value:number){
  const input=event.target as HTMLInputElement
  input.value=String(value)
}
</script>

<template>
  <div class="macro-dice">
    <fieldset v-for="(group,groupIndex) in modelValue.groups" :key="groupIndex" class="dice-group" :disabled="disabled">
      <legend>Rolagem {{ groupIndex+1 }}</legend>
      <label>Quantidade de dados
        <FilterSelect :aria-label="`Origem da quantidade da rolagem ${groupIndex+1}`" :model-value="group.count===null?'input':'fixed'"
          :options="quantityOptions" compact :disabled="disabled"
          @update:model-value="updateGroup(groupIndex,{count:$event==='input'?null:1,countFieldId:undefined})" />
      </label>
      <template v-if="group.count===null">
        <label>Input da quantidade
          <FilterSelect :aria-label="`Input da quantidade da rolagem ${groupIndex+1}`"
            :model-value="group.countFieldId?'other':'current'" :options="sourceOptions" compact :disabled="disabled"
            @update:model-value="updateGroup(groupIndex,{countFieldId:$event==='other'?otherFields[0]?.value:undefined})" />
        </label>
        <label v-if="group.countFieldId">Campo da quantidade
          <FilterSelect :aria-label="`Campo da quantidade da rolagem ${groupIndex+1}`"
            :model-value="group.countFieldId" :options="otherFields" compact :disabled="disabled"
            @update:model-value="updateGroup(groupIndex,{countFieldId:$event})" />
        </label>
      </template>
      <label v-if="group.count!==null">Dados lançados
        <input :aria-label="`Dados lançados na rolagem ${groupIndex+1}`" inputmode="numeric" :value="group.count"
          @input="editGroupNumber(groupIndex,$event,'count')" @change="restoreGroupNumber($event,group.count)">
      </label>
      <label>Faces do dado
        <input :aria-label="groupIndex===0?`Faces da regra ${ruleNumber}`:`Faces da rolagem ${groupIndex+1}`" inputmode="numeric" :value="group.sides"
          @input="editGroupNumber(groupIndex,$event,'sides')" @change="restoreGroupNumber($event,group.sides)">
      </label>
      <label>Resultado dos dados
        <FilterSelect :aria-label="`Resultado da rolagem ${groupIndex+1}`" :model-value="group.reduction??''"
          :options="resultOptions" compact :disabled="disabled" @update:model-value="setGroupResult(groupIndex,group,$event)" />
      </label>
      <template v-if="group.reduction==='sucesso' && group.success">
        <label>Sucesso de
          <input :aria-label="`Início do sucesso da rolagem ${groupIndex+1}`" inputmode="numeric" :value="group.success.min"
            @input="editSuccessRange(groupIndex,group,$event,'min')" @change="restoreGroupNumber($event,group.success.min)">
        </label>
        <label>Até
          <input :aria-label="`Fim do sucesso da rolagem ${groupIndex+1}`" inputmode="numeric" :value="group.success.max"
            @input="editSuccessRange(groupIndex,group,$event,'max')" @change="restoreGroupNumber($event,group.success.max)">
        </label>
      </template>
      <button v-if="modelValue.groups.length>1" type="button" :aria-label="`Remover rolagem ${groupIndex+1}`"
        @click="removeGroup(groupIndex)">Remover</button>
    </fieldset>
    <div class="macro-add">
      <button type="button" :disabled="disabled || modelValue.groups.length>=MAX_DICE_GROUPS" @click="addGroup()">Adicionar rolagem</button>
      <label v-if="modelValue.groups.length>1">Resultados das rolagens
        <FilterSelect aria-label="Combinar resultados das rolagens" :model-value="modelValue.combine??''"
          :options="combineOptions" compact :disabled="disabled || modelValue.groups.some(group=>group.reduction===null)"
          @update:model-value="updateDice({combine:$event||null})" />
        <small v-if="modelValue.groups.some(group=>group.reduction===null)">Escolha um resultado em cada rolagem para combinar.</small>
      </label>
    </div>
  </div>
</template>

<style scoped>
.macro-dice{display:grid;gap:8px;flex-basis:100%;min-width:0}
.dice-group{display:flex;flex-wrap:wrap;align-items:end;gap:8px;margin:0;padding:8px 10px;min-width:0;border:1px solid #39755f;border-radius:6px;background:#142c27}
.dice-group legend{padding:0 5px;color:#b9ebd6}
.dice-group label,.macro-add label{display:grid;gap:4px;color:#e2f3ea;font-size:12px}
.dice-group input{width:84px;margin:0;padding:5px}
.macro-dice .filter-select{width:min(165px,100%)}
.macro-add{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.macro-dice button{border:1px solid #79548d;border-radius:6px;background:#3b2849;color:#eadff3;padding:8px 12px;cursor:pointer}
.macro-dice button:disabled{opacity:.6}
</style>
