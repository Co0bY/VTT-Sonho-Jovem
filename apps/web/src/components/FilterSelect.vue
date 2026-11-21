<script setup lang="ts" generic="Model extends string | string[] = string">
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'

defineOptions({ inheritAttrs: false })
type Option = { value: string; label: string; disabled?: boolean }
const props = defineProps<{
  modelValue?: Model
  options: readonly Option[]
  id?: string
  disabled?: boolean
  multiple?: boolean
  compact?: boolean
  sheet?: boolean
  placeholder?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: Model]; confirm: [] }>()
const uid = useId()
const input = ref<HTMLInputElement>()
const control = ref<HTMLElement>()
const menu = ref<HTMLElement>()
const open = ref(false)
const search = ref('')
const highlighted = ref(-1)
const position = ref({ left: '0px', top: '0px', width: '0px', maxHeight: '0px' })
const popupId = `${uid}-options`
const selected = computed<readonly (string | undefined)[]>(() => Array.isArray(props.modelValue) ? props.modelValue : [props.modelValue])
const summary = computed(() => selected.value.map(value => props.options.find(option => option.value === value)?.label ?? value ?? '').join(', '))
const normalize = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR')
const filtered = computed(() => {
  const term = normalize(search.value.trim())
  return props.options.filter(option => normalize(option.label).includes(term))
})
const optionId = (index: number) => `${popupId}-${index}`
let popupDocument: Document | undefined

function placeMenu() {
  const bounds = control.value?.getBoundingClientRect()
  const screen = popupDocument?.defaultView
  if (!bounds || !screen) return
  const gap = 4, margin = 8
  const below = screen.innerHeight - bounds.bottom - gap - margin
  const above = bounds.top - gap - margin
  const upward = below < 170 && above > below
  const width = Math.min(Math.max(bounds.width, 160), screen.innerWidth - margin * 2)
  const height = Math.max(0, Math.min(260, upward ? above : below))
  position.value = {
    left: `${Math.min(Math.max(bounds.left, margin), screen.innerWidth - width - margin)}px`,
    top: `${upward ? bounds.top - gap - Math.min(menu.value?.scrollHeight ?? 0, height) : bounds.bottom + gap}px`,
    width: `${width}px`,
    maxHeight: `${height}px`,
  }
}

function onOutsidePointer(event: PointerEvent) {
  const path = event.composedPath()
  if ((!control.value || !path.includes(control.value)) && (!menu.value || !path.includes(menu.value))) close()
}

function close() {
  open.value = false
  search.value = ''
  highlighted.value = -1
  popupDocument?.removeEventListener('pointerdown', onOutsidePointer, true)
  popupDocument?.removeEventListener('scroll', placeMenu, true)
  popupDocument?.defaultView?.removeEventListener('resize', placeMenu)
  popupDocument = undefined
}

function show() {
  if (props.disabled || open.value || !input.value) return
  popupDocument = input.value.ownerDocument
  popupDocument.addEventListener('pointerdown', onOutsidePointer, true)
  popupDocument.addEventListener('scroll', placeMenu, true)
  popupDocument.defaultView?.addEventListener('resize', placeMenu)
  open.value = true
  placeMenu()
  void nextTick(placeMenu)
}

function choose(option: Option) {
  if (option.disabled || props.disabled) return
  if (props.multiple) {
    const values = Array.isArray(props.modelValue) ? props.modelValue : []
    emit('update:modelValue', (values.includes(option.value) ? values.filter(value => value !== option.value) : [...values, option.value]) as Model)
    return
  }
  if (option.value !== props.modelValue) emit('update:modelValue', option.value as Model)
  close()
}

function onInput(event: Event) {
  const value = (event.target as HTMLInputElement).value
  show()
  search.value = value
  highlighted.value = filtered.value.findIndex(option => !option.disabled)
}

function move(step: number) {
  show()
  const options = filtered.value
  let index = highlighted.value < 0 && step < 0 ? options.length : highlighted.value
  for (let attempts = 0; attempts < options.length; attempts++) {
    index = (index + step + options.length) % options.length
    if (!options[index]?.disabled) {
      highlighted.value = index
      void nextTick(() => popupDocument?.getElementById(optionId(index))?.scrollIntoView({ block: 'nearest' }))
      break
    }
  }
}

function keydown(event: KeyboardEvent) {
  if (event.isComposing) return
  if (event.key === 'Tab') { close(); return }
  if (event.key === 'Escape') {
    if (open.value) { event.preventDefault(); event.stopPropagation(); close() }
    return
  }
  event.stopPropagation()
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    move(event.key === 'ArrowDown' ? 1 : -1)
  }
  if (event.key === 'Enter') {
    event.preventDefault()
    if (!open.value) { emit('confirm'); show(); return }
    const option = filtered.value[highlighted.value]
    if (option) choose(option)
    else close()
  }
}

watch(filtered, () => { if (open.value) void nextTick(placeMenu) })
watch(() => props.disabled, disabled => { if (disabled) close() })
onBeforeUnmount(close)
</script>

<template>
  <span ref="control" class="filter-select" :class="{ compact, sheet }">
    <input v-bind="$attrs" :id="id ?? uid" ref="input" class="filter-select-input"
      role="combobox" aria-autocomplete="list" :aria-expanded="open" :aria-controls="open ? popupId : undefined"
      :aria-activedescendant="open && highlighted >= 0 ? optionId(highlighted) : undefined"
      :disabled="disabled" :placeholder="open ? (summary || 'Pesquisar opções') : (placeholder || 'Selecione')"
      :value="open ? search : summary" :title="summary" autocomplete="off" spellcheck="false"
      @focus="!open && input?.select()" @click="show" @blur="close" @input.stop="onInput" @change.stop @keydown="keydown">
    <span class="filter-select-arrow" aria-hidden="true"></span>
    <Teleport v-if="open && popupDocument" :to="popupDocument.body">
      <div :id="popupId" ref="menu" class="filter-select-menu" role="listbox" :aria-multiselectable="multiple || undefined"
        :aria-label="'Opções de ' + ($attrs['aria-label'] || input?.labels?.item(0)?.textContent?.trim() || 'seleção')"
        :style="position" @mousedown.prevent>
        <div v-if="!filtered.length" class="filter-select-empty" role="status">Nenhuma opção encontrada</div>
        <button v-for="(option, index) in filtered" :id="optionId(index)" :key="option.value" type="button" role="option"
          tabindex="-1" :aria-selected="selected.includes(option.value)" :disabled="option.disabled"
          :data-option-value="option.value" :class="{ highlighted: highlighted === index }" @click="choose(option)">
          <span>{{ option.label }}</span><span v-if="selected.includes(option.value)" aria-hidden="true">✓</span>
        </button>
      </div>
    </Teleport>
  </span>
</template>

<style scoped>
.filter-select { display:block;position:relative;min-width:0;width:100%; }
.filter-select .filter-select-input {
  display:block;width:100%;min-width:0;margin:0;padding:9px 30px 9px 11px;
  border:1px solid #59436a;border-radius:7px;background:#17111e;color:#eadff3;
  font:inherit;line-height:1.35;text-overflow:ellipsis;
}
.filter-select .filter-select-input:focus { outline:2px solid #b48ce9;outline-offset:-1px; }
.filter-select-input::placeholder { color:#b8a5c6;opacity:1; }
.filter-select-input:disabled { opacity:.55;cursor:not-allowed; }
.filter-select-arrow {
  position:absolute;right:12px;top:50%;width:7px;height:7px;border-right:1px solid #c6a2e8;
  border-bottom:1px solid #c6a2e8;transform:translateY(-70%) rotate(45deg);pointer-events:none;
}
.filter-select.compact .filter-select-input { padding:5px 24px 5px 8px; }
.compact .filter-select-arrow { right:9px; }
.filter-select.sheet { min-height:0;flex:1; }
.filter-select.sheet .filter-select-input {
  height:100%;padding:0 12px 0 1px;font-size:var(--field-font,14px);line-height:1;border:1px solid transparent;
  border-radius:0;background:transparent;color:inherit;
}
.sheet .filter-select-arrow { right:4px;width:5px;height:5px;border-color:currentColor; }
.filter-select-menu {
  position:fixed;z-index:8500;overflow:auto;overscroll-behavior:contain;
  padding:4px;border:1px solid #654c79;border-radius:8px;background:#241a30;color:#eadff3;
  box-shadow:0 8px 22px #0e0915a8;font:13px/1.35 Inter,Arial,sans-serif;
}
.filter-select-menu button,.filter-select-empty { display:block;width:100%;padding:7px 8px;text-align:left;overflow-wrap:anywhere; }
.filter-select-menu button { display:flex;justify-content:space-between;gap:8px;border:0;border-radius:5px;background:transparent;color:inherit;font:inherit; }
.filter-select-menu button[aria-selected="true"] { background:#3b2850;color:#f0dbff; }
.filter-select-menu button:not(:disabled):hover,.filter-select-menu button.highlighted { background:#503469;color:#fff; }
.filter-select-menu button:disabled { opacity:.5; }
.filter-select-empty { color:#b8a5c6; }
</style>
