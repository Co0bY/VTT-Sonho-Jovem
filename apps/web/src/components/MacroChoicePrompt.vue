<script setup lang="ts">
import { computed } from 'vue'
import FilterSelect from './FilterSelect.vue'
import type { ChoiceAction } from '../tabletop/sheet-macros'

const props = defineProps<{ choice: ChoiceAction; canGoBack: boolean }>()
const emit = defineEmits<{ choose: [value: string]; back: []; cancel: [] }>()
const options = computed(() => props.choice.options.map((option, index) => ({ label: option.label, value: String(index) })))
</script>

<template>
  <div class="macro-choice-prompt">
    <h2>{{ choice.label }}</h2>
    <FilterSelect :key="choice.label" :aria-label="choice.label" model-value="" :options="options" autofocus
      @update:model-value="emit('choose',$event)" />
    <div class="modal-actions">
      <button v-if="canGoBack" type="button" class="text-button" @click="emit('back')">Voltar</button>
      <button type="button" class="text-button" @click="emit('cancel')">Cancelar</button>
    </div>
  </div>
</template>

<style scoped>
.macro-choice-prompt { min-width:0; }
.macro-choice-prompt h2 { font-size:20px;overflow-wrap:anywhere; }
</style>
