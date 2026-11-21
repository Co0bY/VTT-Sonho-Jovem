<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import FilterSelect from './FilterSelect.vue'
import { editableTokenSettings, maxTokenBars, newTokenBar, tokenBarColor, tokenConditions } from '../tabletop/token-settings'
import type { Token, TokenProperties } from '../tabletop/types'

const props = defineProps<{
  token?: Token
  fields: { id: string; label: string; reference: string; value: string }[]
  unit: string
  busy: boolean
  error: string
  save: (tokenId: string, properties: TokenProperties) => Promise<boolean>
}>()
const emit = defineEmits<{ close: [] }>()
const defense = ref<number | ''>('')
const observation = ref<number | ''>('')
const settings = ref(editableTokenSettings())
const tab = ref('properties')
const fieldOptions = computed(() => [
  { value: '', label: 'Valor manual' },
  ...props.fields.map(field => ({ value: field.id, label: `${field.label} (${field.reference})` })),
])
const barSides = [
  { value: 'value', field: 'valueFieldId', label: 'Valor atual' },
  { value: 'max', field: 'maxFieldId', label: 'Máximo' },
] as const
function optionsForLink(id: string | undefined) {
  return id && !props.fields.some(field => field.id === id)
    ? [...fieldOptions.value, { value: id, label: 'Campo indisponível', disabled: true }]
    : fieldOptions.value
}
function addBar() {
  if (settings.value.bars.length < maxTokenBars) settings.value.bars.push(newTokenBar())
}
const auraShapes = [{ value: 'circle', label: 'Círculo' }, { value: 'square', label: 'Quadrado' }]
const sightRanges = [{ key: 'bright', label: 'Sob luz intensa' }, { key: 'dim', label: 'Sob luz fraca' },
  { key: 'dark', label: 'Na escuridão' }] as const
const lightRanges = [{ key: 'bright', label: 'Alcance da luz intensa' }, { key: 'dim', label: 'Alcance da luz fraca' }] as const

watch(() => props.token?.id, () => {
  defense.value = props.token?.defense ?? ''
  observation.value = props.token?.observation ?? ''
  settings.value = editableTokenSettings(props.token?.settings)
  tab.value = 'properties'
}, { immediate: true })

async function save() {
  const token = props.token
  if (!token || props.busy) return
  const saved = await props.save(token.id, {
    defense: defense.value === '' ? null : defense.value,
    observation: observation.value === '' ? null : observation.value,
    settings: {
      ...settings.value,
      bars: settings.value.bars.map(bar => ({
        ...bar,
        value: typeof bar.value === 'number' ? bar.value : null,
        max: typeof bar.max === 'number' ? bar.max : null,
      })),
      auras: settings.value.auras.map(aura => ({ ...aura, radius: Number(aura.radius) })),
      vision: { ...settings.value.vision, bright: Number(settings.value.vision.bright),
        dim: Number(settings.value.vision.dim), dark: Number(settings.value.vision.dark), angle: Number(settings.value.vision.angle) },
      light: { ...settings.value.light, bright: Number(settings.value.light.bright),
        dim: Number(settings.value.light.dim), angle: Number(settings.value.light.angle) },
    },
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
        <q-tabs v-model="tab" align="left" no-caps outside-arrows mobile-arrows class="token-tabs" aria-label="Opções do token">
          <q-tab name="properties" label="Propriedades" />
          <q-tab name="auras" label="Auras" />
          <q-tab name="conditions" label="Condições" />
          <q-tab name="image" label="Imagem" />
          <q-tab name="vision" label="Visão e luz" />
        </q-tabs>
        <form @submit.prevent="save">
          <section v-if="tab === 'properties'" aria-label="Propriedades">
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
            <fieldset v-for="(bar,index) in settings.bars" :key="index" class="token-fieldset" :disabled="busy">
              <legend><span class="color-dot" :style="{ background: tokenBarColor(index) }"></span>Barra {{ index + 1 }}</legend>
              <div class="token-property-fields">
                <div v-for="side in barSides" :key="side.value">
                  <label>{{ side.label }}
                    <FilterSelect :model-value="bar[side.field] ?? ''" :options="optionsForLink(bar[side.field])"
                      :aria-label="`Vínculo de ${side.label.toLowerCase()} da barra ${index+1}`" :disabled="busy"
                      @update:model-value="bar[side.field]=$event || undefined" />
                  </label>
                  <input v-if="!bar[side.field]" v-model.number="bar[side.value]" type="number" step="1"
                    :min="side.value === 'max' ? 1 : -2147483648" max="2147483647"
                    :aria-label="`${side.label} da barra ${index+1}`">
                </div>
              </div>
              <button type="button" class="text-button token-remove-bar" :aria-label="`Remover barra ${index+1}`"
                @click="settings.bars.splice(index,1)">Remover barra</button>
            </fieldset>
            <button type="button" class="table-button" :disabled="busy || settings.bars.length >= maxTokenBars" @click="addBar">+ Adicionar barra</button>
            <p>A barra aparece quando o valor atual e o máximo estão preenchidos.</p>
          </section>
          <section v-else-if="tab === 'auras'" aria-label="Auras">
            <fieldset v-for="(aura,index) in settings.auras" :key="index" class="token-fieldset" :disabled="busy">
              <legend>Aura {{ index+1 }}</legend>
              <div class="token-property-fields">
                <label>Raio ({{ unit }})
                  <input v-model.number="aura.radius" type="number" min="0" step="any" :aria-label="`Raio da aura ${index+1}`">
                </label>
                <label>Forma
                  <FilterSelect v-model="aura.shape" :options="auraShapes" :disabled="busy" :aria-label="`Forma da aura ${index+1}`" />
                </label>
                <label>Cor<input v-model="aura.color" type="color" :aria-label="`Cor da aura ${index+1}`"></label>
                <label>Opacidade · {{ aura.opacity }}%
                  <input v-model.number="aura.opacity" type="range" min="0" max="100" :aria-label="`Opacidade da aura ${index+1}`">
                </label>
              </div>
            </fieldset>
          </section>
          <section v-else-if="tab === 'conditions'" aria-label="Condições">
            <label for="token-conditions">Condições do token</label>
            <FilterSelect id="token-conditions" v-model="settings.conditions" :options="tokenConditions" multiple :disabled="busy" />
            <div class="condition-chips">
              <span v-for="condition in tokenConditions.filter(item => settings.conditions.includes(item.value))" :key="condition.value" class="condition-chip">
                <span class="color-dot" :style="{ background: condition.color }"></span>{{ condition.label }}
              </span>
            </div>
            <button type="button" class="text-button" :disabled="busy || !settings.conditions.length" @click="settings.conditions=[]">Limpar todas</button>
          </section>
          <section v-else-if="tab === 'image'" aria-label="Imagem">
            <div class="token-preview">
              <img v-if="token.token_url" :src="token.token_url" :alt="token.name"
                :style="{ opacity:settings.image.opacity/100, transform:settings.image.mirrored?'scaleX(-1)':undefined }">
              <span v-else :style="{ background:token.color, opacity:settings.image.opacity/100 }">{{ token.name.slice(0,1).toUpperCase() }}</span>
            </div>
            <label>Opacidade da imagem · {{ settings.image.opacity }}%
              <input v-model.number="settings.image.opacity" type="range" min="0" max="100" aria-label="Opacidade da imagem" :disabled="busy">
            </label>
            <label class="table-checkbox">
              <input v-model="settings.image.mirrored" type="checkbox" :disabled="busy"> Espelhar horizontalmente
            </label>
          </section>
          <section v-else aria-label="Visão e luz">
            <fieldset class="token-fieldset" :disabled="busy">
              <legend>Visão do token</legend>
              <label class="table-checkbox"><input v-model="settings.vision.enabled" type="checkbox"> Possui visão</label>
              <div class="token-property-fields">
                <label v-for="range in sightRanges" :key="range.key">{{ range.label }} ({{ unit }})
                  <input v-model.number="settings.vision[range.key]" type="number" min="0" step="any" :disabled="!settings.vision.enabled">
                </label>
                <label>Ângulo da visão (°)
                  <input v-model.number="settings.vision.angle" type="number" min="0" max="360" step="1" :disabled="!settings.vision.enabled">
                </label>
              </div>
            </fieldset>
            <fieldset class="token-fieldset" :disabled="busy">
              <legend>Luz emitida</legend>
              <div class="token-property-fields">
                <label v-for="range in lightRanges" :key="range.key">{{ range.label }} ({{ unit }})
                  <input v-model.number="settings.light[range.key]" type="number" min="0" step="any">
                </label>
                <label>Ângulo da luz (°)<input v-model.number="settings.light.angle" type="number" min="0" max="360" step="1"></label>
              </div>
            </fieldset>
          </section>
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
.token-properties.modal { width:560px; }
.token-tabs { margin:12px 0;border-bottom:1px solid #58406d; }
.token-tabs :deep(.q-tab) { min-height:38px;padding:0 10px; }
.token-fieldset { margin:12px 0 8px;min-width:0;border:1px solid #58406d;border-radius:8px;padding:5px 12px 12px; }
.token-fieldset legend { display:flex;align-items:center;gap:6px;padding:0 4px;color:#e3c6ff; }
.token-properties input[type=range] { accent-color:#bc8cee;padding:0; }
.condition-chips { display:flex;flex-wrap:wrap;gap:6px;margin:10px 0; }
.condition-chip { display:flex;align-items:center;gap:6px;background:#342641;border-radius:12px;padding:4px 8px; }
.color-dot { display:inline-block;width:9px;height:9px;border-radius:50%; }
.token-preview { height:100px;display:grid;place-items:center;background:#17111e;border-radius:8px;margin-bottom:12px; }
.token-preview img { width:90px;height:90px;object-fit:contain; }
.token-preview > span { width:58px;height:58px;border-radius:50%;display:grid;place-items:center;font-size:22px;font-weight:700; }
.token-remove-bar { padding:6px 0; }
.token-properties h2 { margin-top:0; }
.token-name { display:flex;align-items:center;gap:8px;overflow-wrap:anywhere; }
.token-name span { width:9px;height:9px;border-radius:50%;flex:none; }
.token-property-fields { display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,145px),1fr));gap:12px; }
.token-property-fields input { min-width:0; }
.token-properties .token-properties-error { color:#ffc0d0; }
</style>
