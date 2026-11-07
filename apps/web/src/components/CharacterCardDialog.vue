<script setup lang="ts">
import { computed } from 'vue'
import type { CharacterCard } from '../tabletop/types'
import { cleanHtml } from '../tabletop/rich-text'
const props=defineProps<{card:CharacterCard|null;master:boolean;busy:boolean;error:string}>()
const emit=defineEmits<{close:[];present:[id:string]}>()
const description=computed(()=>cleanHtml(props.card?.description??''))
</script>
<template>
  <q-dialog :model-value="!!card" @update:model-value="emit('close')">
    <q-card v-if="card" class="presentation-card" :style="{'--character-color':card.color}" role="dialog" :aria-label="card.name">
      <header><h2>{{ card.name }}</h2><button type="button" aria-label="Fechar cartão de apresentação" @click="emit('close')">×</button></header>
      <div class="presentation-images" v-if="card.appearance_url || card.token_url"><img v-if="card.appearance_url" class="portrait" :src="card.appearance_url" :alt="`Aparência de ${card.name}`"><img v-if="card.token_url" class="token" :src="card.token_url" :alt="`Token de ${card.name}`"></div>
      <div v-else class="presentation-initial" aria-hidden="true">{{ card.name.slice(0,1).toUpperCase() }}</div>
      <div class="presentation-description" v-html="description"></div>
      <p v-if="error" role="alert">{{ error }}</p>
      <footer v-if="master"><button type="button" :disabled="busy" @click="emit('present',card.id)">Exibir aos jogadores</button></footer>
    </q-card>
  </q-dialog>
</template>
<style scoped>
.presentation-card{width:620px;max-width:94vw;max-height:90vh;overflow:auto;background:#24192e;color:#eadff3;border:1px solid #654574;border-top:4px solid var(--character-color);border-radius:12px;padding:24px}.presentation-card header{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:10px;letter-spacing:1.5px;color:#baa0cd}.presentation-card header h2{margin:0}.presentation-card header button{background:none;border:0;color:#e4c7ff;font-size:24px;cursor:pointer}.presentation-images{display:flex;align-items:center;justify-content:center;gap:24px;margin:20px 0;flex-wrap:wrap}.portrait{max-width:100%;max-height:280px;object-fit:contain;border-radius:10px}.token{width:96px;height:96px;object-fit:contain}.presentation-initial{width:90px;height:90px;margin:24px auto 0;border-radius:50%;display:grid;place-items:center;font-size:40px;background:var(--character-color);color:white}.presentation-card h2{font-size:26px;line-height:1.4;color:var(--character-color);overflow-wrap:anywhere;margin:20px 0}.presentation-description{overflow-wrap:anywhere;line-height:1.8;font-size:14px}.presentation-description :deep(p){margin:0 0 12px}.presentation-card footer{display:flex;justify-content:flex-end;margin-top:24px}.presentation-card footer button{font-size:11px;padding:8px 12px;border:1px solid #79548d;border-radius:6px;background:#3b2849;color:#eadff3;cursor:pointer}.presentation-card [role=alert]{color:#ffc0d0;font-size:12px}
</style>
