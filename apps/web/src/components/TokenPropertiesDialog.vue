<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Token, TokenProperties } from '../tabletop/types'

const props = defineProps<{
  token?: Token
  busy: boolean
  error: string
  save: (tokenId: string, properties: TokenProperties) => Promise<boolean>
}>()
const emit = defineEmits<{ close: [] }>()
const defense = ref<number | ''>('')
const observation = ref<number | ''>('')

watch(() => props.token?.id, () => {
  defense.value = props.token?.defense ?? ''
  observation.value = props.token?.observation ?? ''
}, { immediate: true })

async function save() {
  const token = props.token
  if (!token || props.busy) return
  const saved = await props.save(token.id, {
    defense: defense.value === '' ? null : defense.value,
    observation: observation.value === '' ? null : observation.value,
  })
  if (saved) emit('close')
}
</script>

<template>
  <q-dialog :model-value="!!token" :persistent="busy" @update:model-value="value => !value && emit('close')">
    <q-card v-if="token" class="modal token-properties">
      <q-card-section>
        <h2>Propriedades do token</h2>
        <div class="token-name"><span aria-hidden="true" :style="{ background: token.color }"></span>{{ token.name }}</div>
        <form @submit.prevent="save">
          <div class="token-property-fields">
            <label>Defesa
              <input v-model.number="defense" type="number" step="1" min="-2147483648" max="2147483647"
                inputmode="numeric" placeholder="CA" :disabled="busy">
            </label>
            <label>Observação
              <input v-model.number="observation" type="number" step="1" min="-2147483648" max="2147483647"
                inputmode="numeric" placeholder="Percepção passiva" :disabled="busy">
            </label>
          </div>
          <p v-if="error" role="alert" class="token-properties-error">{{ error }}</p>
          <div class="modal-actions">
            <button type="button" class="text-button" :disabled="busy" @click="emit('close')">Cancelar</button>
            <button class="primary" :disabled="busy">Salvar</button>
          </div>
        </form>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.token-properties h2 { margin-top:0; }
.token-name { display:flex;align-items:center;gap:8px;overflow-wrap:anywhere; }
.token-name span { width:9px;height:9px;border-radius:50%;flex:none; }
.token-property-fields { display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,145px),1fr));gap:12px; }
.token-property-fields input { min-width:0; }
.token-properties .token-properties-error { color:#ffc0d0; }
</style>
