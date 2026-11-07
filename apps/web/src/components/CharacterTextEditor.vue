<script setup lang="ts">
import { cleanHtml } from '../tabletop/rich-text'
defineProps<{modelValue:string;label:string;disabled:boolean}>()
const emit=defineEmits<{'update:modelValue':[value:string]}>()
const toolbar=[['bold','italic','underline','strike'],['unordered','ordered'],['removeFormat'],['undo','redo']]
const definitions={
  bold:{label:'N',icon:'',tip:'Negrito (Ctrl+B)'},italic:{label:'I',icon:'',tip:'Itálico (Ctrl+I)'},
  underline:{label:'S',icon:'',tip:'Sublinhado (Ctrl+U)'},strike:{label:'abc̶',icon:'',tip:'Tachado'},
  unordered:{label:'• Lista',icon:'',tip:'Lista com marcadores'},ordered:{label:'1. Lista',icon:'',tip:'Lista numerada'},
  removeFormat:{label:'Tx',icon:'',tip:'Remover formatação'},undo:{label:'↶',icon:'',tip:'Desfazer'},redo:{label:'↷',icon:'',tip:'Refazer'}
}
function paste(event:ClipboardEvent){
  event.preventDefault()
  const html=event.clipboardData?.getData('text/html')
  if(html)document.execCommand('insertHTML',false,cleanHtml(html))
  else document.execCommand('insertText',false,event.clipboardData?.getData('text/plain')??'')
}
</script>
<template>
  <div class="character-text-editor" @paste.capture="paste" @drop.prevent>
    <span class="editor-label">{{ label }}</span>
    <q-editor :model-value="modelValue" :disable="disabled" :toolbar="toolbar" :definitions="definitions" dark dense min-height="12rem" role="textbox" :aria-label="label" aria-multiline="true" @update:model-value="emit('update:modelValue',$event)" />
    <small>Até 20.000 caracteres, incluindo formatação.</small>
  </div>
</template>
<style scoped>
.character-text-editor{margin:18px 0}.editor-label{display:block;margin-bottom:9px;color:#d8c0ed;font-size:13px}.character-text-editor :deep(.q-editor){border:1px solid #59436a;border-radius:8px;background:#17111e;color:#eadff3}.character-text-editor :deep(.q-editor__toolbar){flex-wrap:wrap;border-color:#59436a;background:#2e2039}.character-text-editor :deep(.q-editor__content){overflow-wrap:anywhere;line-height:1.7}.character-text-editor small{display:block;margin-top:7px;color:#ad96bc;font-size:10px}
</style>
