<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { sheetError, type CharacterSheet } from '../tabletop/character-sheet'

type Model = { id: string; name: string; global: 'S' | 'N'; author: string }
const props = defineProps<{
  sheet: CharacterSheet
  backgroundFor: (id: string) => string | null | undefined
  disabled: boolean
}>()
const emit = defineEmits<{
  busy: [busy: boolean]
  import: [sheet: CharacterSheet, backgrounds: Map<string, File>]
}>()

const models = ref<Model[]>()
const selected = ref('')
const name = ref('')
const global = ref(false)
const busy = ref(false)
const error = ref('')
const status = ref('')
const abort = new AbortController()

onBeforeUnmount(() => abort.abort())

async function request(url: string, body?: FormData) {
  const response = await fetch(url, { method: body ? 'POST' : 'GET', body, signal: abort.signal })
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new Error(data?.message || 'Não foi possível acessar os modelos de ficha.')
  }
  return response
}

async function operate(action: () => Promise<void>) {
  if (busy.value || props.disabled) return
  busy.value = true
  emit('busy', true)
  error.value = ''
  status.value = ''
  try { await action() }
  catch (cause) {
    if (!abort.signal.aborted) error.value = cause instanceof Error ? cause.message : 'Falha ao acessar o modelo.'
  } finally {
    busy.value = false
    if (!abort.signal.aborted) emit('busy', false)
  }
}

function loadModels() {
  return operate(async () => {
    models.value = await (await request('/api/modelos-ficha')).json()
  })
}

function openModels(event: Event) {
  if ((event.currentTarget as HTMLDetailsElement).open && !models.value) void loadModels()
}

async function backgroundFile(url: string) {
  const blob = await (await request(url)).blob()
  return new File([blob], 'fundo', { type: blob.type })
}

function saveModel() {
  return operate(async () => {
    const invalid = sheetError(props.sheet)
    if (invalid) throw new Error(invalid)

    const form = new FormData()
    form.set('name', name.value.trim())
    form.set('global', global.value ? 'S' : 'N')
    form.set('sheet', JSON.stringify({
      ...props.sheet,
      pages: props.sheet.pages.map(({ backgroundUrl, ...page }) => page),
    }))
    await Promise.all(props.sheet.pages.map(async (page, index) => {
      const url = props.backgroundFor(page.id)
      if (url) form.append(`sheet_page_${index}`, await backgroundFile(url))
    }))

    const model: Model = await (await request('/api/modelos-ficha', form)).json()
    if (models.value) models.value = [...models.value, model]
    name.value = ''
    global.value = false
    status.value = 'Modelo salvo na sua biblioteca.'
  })
}

function importModel() {
  return operate(async () => {
    if (!selected.value) return
    const model: CharacterSheet = await (await request(`/api/modelos-ficha/${selected.value}`)).json()
    const backgrounds = new Map<string, File>()
    await Promise.all(model.pages.map(async page => {
      if (page.backgroundUrl) backgrounds.set(page.id, await backgroundFile(page.backgroundUrl))
    }))
    if (abort.signal.aborted) return
    emit('import', {
      ...model,
      pages: model.pages.map(({ backgroundUrl, ...page }) => ({ ...page, removeBackground: true })),
    }, backgrounds)
    status.value = 'Modelo aplicado. Salve o personagem para gravar a ficha.'
  })
}
</script>

<template>
  <details class="sheet-models" @toggle="openModels">
    <summary>Modelos de ficha</summary>
    <div class="model-controls">
      <fieldset :disabled="disabled || busy">
        <legend>Salvar modelo</legend>
        <label>Nome do modelo<input v-model="name" maxlength="80"></label>
        <label class="model-global"><input v-model="global" type="checkbox"> Global</label>
        <p>Modelos globais ficam disponíveis para qualquer usuário. Os valores preenchidos são limpos na cópia.</p>
        <button type="button" class="text-button" :disabled="!name.trim()" @click="saveModel">Salvar como modelo</button>
      </fieldset>
      <fieldset :disabled="disabled || busy">
        <legend>Importar modelo</legend>
        <label>Modelo disponível
          <select v-model="selected">
            <option value="">Selecione um modelo</option>
            <option v-for="model in models" :key="model.id" :value="model.id">
              {{ model.name }} · {{ model.global === 'S' ? `Global · ${model.author}` : 'Privado' }}
            </option>
          </select>
        </label>
        <p>A importação substitui a ficha em edição. Ela é gravada ao salvar o personagem.</p>
        <button type="button" class="text-button" :disabled="!selected" @click="importModel">Substituir ficha pelo modelo</button>
        <button v-if="!models && error" type="button" class="text-button" @click="loadModels">Recarregar modelos</button>
      </fieldset>
    </div>
    <p v-if="busy" role="status">Carregando modelos de ficha…</p>
    <p v-if="status" role="status">{{ status }}</p>
    <p v-if="error" class="model-error" role="alert">{{ error }}</p>
  </details>
</template>

<style scoped>
.sheet-models { margin-bottom: 16px; padding: 8px 12px; border: 1px solid #59436a; border-radius: 8px; }
summary { cursor: pointer; color: #e4c7ff; }
.model-controls { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 235px), 1fr)); gap: 12px; margin-top: 12px; }
fieldset { min-width: 0; border: 1px solid #59436a; border-radius: 6px; }
label { margin: 8px 0; }
select { width: 100%; margin-top: 8px; padding: 8px; border: 1px solid #59436a; border-radius: 6px; background: #17111e; color: #eadff3; }
.model-global { display: flex; align-items: center; gap: 8px; }
.model-global input { width: auto; margin: 0; }
.model-error { color: #ffc0d0; }
</style>
