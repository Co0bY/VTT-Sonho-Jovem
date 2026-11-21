<script setup lang="ts">
import { computed } from 'vue'
import FilterSelect from './FilterSelect.vue'
import MacroDiceEditor from './MacroDiceEditor.vue'
import {
  diceAction, newMacroChoice, MAX_CHOICE_DEPTH, MAX_CHOICE_OPTIONS,
  type ChoiceAction, type MacroAction, type MacroField,
} from '../tabletop/sheet-macros'

const props = withDefaults(defineProps<{
  modelValue: ChoiceAction; fields: MacroField[]; sourceId: string; disabled: boolean; depth?: number
}>(), { depth: 1 })
const emit = defineEmits<{ 'update:modelValue': [action: ChoiceAction] }>()
const destinations = computed(() => props.fields.filter(field => field.id !== props.sourceId)
  .map(field => ({ value: field.id, label: `${field.label} (${field.reference})` })))
const actions = computed(() => [
  { value: 'rolar', label: 'Rolar dados' },
  { value: 'chat', label: 'Enviar ao chat' },
  { value: 'atribuir', label: 'Atualizar outro campo', disabled: !destinations.value.length },
  { value: 'escolher', label: 'Abrir próximo seletor', disabled: props.depth >= MAX_CHOICE_DEPTH },
])

function updateOption(index: number, patch: Partial<ChoiceAction['options'][number]>) {
  emit('update:modelValue', { ...props.modelValue, options: props.modelValue.options
    .map((option, current) => current === index ? { ...option, ...patch } : option) })
}

function changeAction(index: number, kind: MacroAction['kind']) {
  if (kind === 'escolher') updateOption(index, { action: newMacroChoice() })
  else if (kind === 'atribuir') {
    const target = destinations.value[0]
    if (target) updateOption(index, { action: { kind, targetId: target.value } })
  } else if (kind === 'rolar') {
    updateOption(index, { action: { kind, groups: [{ count: 1, sides: 6, reduction: 'somar' }], combine: null } })
  } else updateOption(index, { action: { kind } })
}

function addOption() {
  const options = props.modelValue.options
  let number = options.length + 1
  while (options.some(option => option.label === `Opção ${number}`)) number++
  emit('update:modelValue', { ...props.modelValue, options: [...options, { label: `Opção ${number}`, action: { kind: 'chat' } }] })
}

function removeOption(index: number) {
  emit('update:modelValue', { ...props.modelValue, options: props.modelValue.options.filter((_, current) => current !== index) })
}
</script>

<template>
  <section class="macro-choice">
    <div class="macro-choice-node">
      <label>Título do seletor
        <input :value="modelValue.label" :disabled="disabled" maxlength="100"
          @input="emit('update:modelValue',{...modelValue,label:($event.target as HTMLInputElement).value})">
      </label>
    </div>
    <div class="macro-choice-branches">
      <details v-for="(option,index) in modelValue.options" :key="index" open class="macro-choice-branch">
        <summary>{{ option.label || 'Opção sem nome' }}</summary>
        <div class="macro-choice-option">
          <label>Nome da opção
            <input :value="option.label" :disabled="disabled" maxlength="100"
              @input="updateOption(index,{label:($event.target as HTMLInputElement).value})">
          </label>
          <label>Ação da opção
            <FilterSelect aria-label="Ação da opção" :model-value="option.action.kind" :options="actions" compact :disabled="disabled"
              @update:model-value="changeAction(index,$event)" />
          </label>
          <button type="button" :disabled="disabled || modelValue.options.length===1" @click="removeOption(index)">Excluir opção</button>
        </div>
        <MacroChoiceEditor v-if="option.action.kind==='escolher'" :model-value="option.action" :fields="fields"
          :source-id="sourceId" :depth="depth+1" :disabled="disabled" @update:model-value="updateOption(index,{action:$event})" />
        <MacroDiceEditor v-else-if="option.action.kind==='rolar'" :model-value="diceAction(option.action)" :fields="fields"
          :source-id="sourceId" :rule-number="index+1" :disabled="disabled" @update:model-value="updateOption(index,{action:$event})" />
        <label v-else-if="option.action.kind==='chat'">Mensagem para o chat
          <input :value="option.action.text" :disabled="disabled" maxlength="2000" placeholder="Valor do campo atual"
            @input="updateOption(index,{action:{kind:'chat',text:($event.target as HTMLInputElement).value || undefined}})">
        </label>
        <label v-else>Campo de destino
          <FilterSelect aria-label="Campo de destino" :model-value="option.action.targetId" :options="destinations" compact
            :disabled="disabled" @update:model-value="updateOption(index,{action:{kind:'atribuir',targetId:$event}})" />
        </label>
      </details>
      <button type="button" :disabled="disabled || modelValue.options.length===MAX_CHOICE_OPTIONS" @click="addOption">Adicionar opção</button>
    </div>
  </section>
</template>

<style scoped>
.macro-choice{width:100%;min-width:0;display:grid;gap:8px}
.macro-choice-node,.macro-choice-branch{padding:8px;border:1px solid #654980;border-radius:7px;background:#241a30;min-width:0}
.macro-choice-branches{position:relative;display:grid;gap:8px;border-left:1px solid #9169b3;margin-left:6px;padding-left:9px}
.macro-choice-branch{position:relative}
.macro-choice-branch::before{content:'';position:absolute;width:9px;left:-10px;top:18px;border-top:1px solid #9169b3}
.macro-choice-branch summary{cursor:pointer;color:#edd8ff;font-weight:600;overflow-wrap:anywhere}
.macro-choice-option{display:flex;flex-wrap:wrap;align-items:end;gap:8px;margin:8px 0}
.macro-choice label{display:grid;flex:1;min-width:min(120px,100%);gap:4px;font-size:12px}
.macro-choice input{width:100%;min-width:0;margin:0;padding:6px}
.macro-choice button{justify-self:start;border:1px solid #79548d;border-radius:6px;background:#3b2849;color:#eadff3;padding:6px 8px}
.macro-choice button:disabled{opacity:.55}
@media(max-width:600px){
  .macro-choice-node,.macro-choice-branch{padding:5px}
  .macro-choice-branches{margin-left:2px;padding-left:5px}
  .macro-choice-branch::before{left:-6px;width:5px}
}
</style>
