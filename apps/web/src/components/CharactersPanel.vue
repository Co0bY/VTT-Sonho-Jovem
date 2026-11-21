<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Character, CharacterFolder, Token, Member, Layer } from '../tabletop/types'
const props=defineProps<{characters:Character[];folders:CharacterFolder[];userId:string;compact:boolean;createFolder:(name:string)=>Promise<boolean>;removeFolder:(id:string)=>Promise<boolean>;moveFolder:(id:string,folder:string|null)=>Promise<boolean>;tokens:Token[];members:Member[];master:boolean;busy:boolean;selected:string}>()
const emit=defineEmits<{view:[character:Character];create:[];edit:[character:Character];place:[id:string];select:[id:string];remove:[id:string];layer:[id:string,layer:Layer];'update:compact':[boolean]}>()
function drag(character:Character,event:DragEvent){
  if(!props.master||props.busy){event.preventDefault();return}
  event.dataTransfer?.setData('application/x-vtt-character',character.id)
  if(event.dataTransfer)event.dataTransfer.effectAllowed='copy'
}
const instances=(id:string)=>props.tokens.filter(token=>token.character_id===id)
const folderName = ref('')
const folderToRemove = ref<CharacterFolder>()
const groups = computed(() => [
  ...props.folders.map(folder => ({ ...folder, characters: props.characters.filter(character => character.folder_id === folder.id) })),
  { id: null, name: 'Sem pasta', characters: props.characters.filter(character => !props.folders.some(folder => folder.id === character.folder_id)) },
])
const canEdit = (character: Character) => props.master || character.owner_id === props.userId
async function createFolder() {
  const name = folderName.value.trim()
  if (name && await props.createFolder(name)) folderName.value = ''
}
async function removeFolder() {
  if (folderToRemove.value && await props.removeFolder(folderToRemove.value.id)) folderToRemove.value = undefined
}
async function moveFolder(character: Character, event: Event) {
  const select = event.target as HTMLSelectElement
  if (!await props.moveFolder(character.id, select.value || null)) select.value = character.folder_id ?? ''
}
</script>
<template><section class="panel-content characters-panel">
  <div class="panel-heading"><h2>Personagens</h2><span>{{ characters.length }} {{ master ? 'NA CAMPANHA' : 'VISÍVEIS PARA VOCÊ' }}</span></div>
  <div class="character-panel-actions">
    <button v-if="master" class="primary" :disabled="busy" @click="emit('create')">+ Novo personagem</button>
    <button type="button" class="table-button" :aria-pressed="compact" @click="emit('update:compact', !compact)">{{ compact ? 'Expandir lista' : 'Minimizar lista' }}</button>
  </div>
  <form v-if="master" class="character-folder-form" @submit.prevent="createFolder">
    <input v-model="folderName" aria-label="Nome da pasta de personagens" placeholder="Nome da pasta" maxlength="100" :disabled="busy" required>
    <button class="table-button" :disabled="busy || !folderName.trim()">Criar pasta</button>
  </form>
  <p v-if="!characters.length && !folders.length" class="panel-help characters-empty">Nenhum personagem disponível.</p>
  <details v-for="group in groups" v-show="group.id || group.characters.length" :key="group.id ?? 'root'" open class="character-folder">
    <summary>{{ group.name }}</summary>
    <button v-if="master && group.id" type="button" class="table-button remove-character-folder"
      :aria-label="`Excluir pasta ${group.name}`" :disabled="busy" @click="folderToRemove={id:group.id,name:group.name}">Excluir pasta</button>
    <ul class="character-list"><li v-for="character in group.characters" :key="character.id" class="character-card" :class="{ compact }"
      :data-character-id="character.id" :draggable="master && !busy" @dragstart="drag(character,$event)">
    <button v-if="compact" type="button" class="compact-character" @dblclick="emit('edit',character)"
      @click="($event.detail === 0 || $event.pointerType === 'touch') && emit('edit',character)">
      <span aria-hidden="true" :style="{ background: character.color }"></span><strong>{{ character.name }}</strong>
    </button>
    <template v-else>
    <div class="character-summary" @dblclick="emit('edit',character)"><img v-if="character.appearance_url" :src="character.appearance_url" :alt="`Aparência de ${character.name}`" draggable="false"><span v-else class="character-initial" :style="{background:character.color}">{{ character.name.slice(0,1).toUpperCase() }}</span><div><strong>{{ character.name }}</strong><small>{{ members.find(member=>member.id===character.owner_id)?.name || 'Participante' }}</small><small>{{ instances(character.id).length ? `${instances(character.id).length} no mapa atual` : 'Fora deste mapa' }}</small></div></div>
    <div class="character-actions"><button class="view-card" title="ver cartão de apresentação" :aria-label="`Ver cartão de apresentação de ${character.name}`" @click="emit('view',character)"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><circle cx="8" cy="10" r="2"/><path d="M4 17c0-4 8-4 8 0m2-7h5m-5 4h5"/></svg><q-tooltip>ver cartão de apresentação</q-tooltip></button><button v-if="master" :disabled="busy" :aria-label="`Adicionar ${character.name} ao mapa`" @click="emit('place',character.id)">Adicionar ao mapa</button><button :disabled="busy" :aria-label="canEdit(character) ? `Editar personagem ${character.name}` : `Ver ficha de ${character.name}`" @click="emit('edit',character)">{{ canEdit(character) ? 'Editar' : 'Ver ficha' }}</button></div>
    <ul v-if="instances(character.id).length" class="character-instances"><li v-for="token in instances(character.id)" :key="token.id" :class="{selected:selected===token.id}"><button :aria-label="`Selecionar ${character.name} no mapa`" @click="emit('select',token.id)">◉ {{ token.layer === 'mestre' ? 'Mestre' : token.layer === 'fundo' ? 'Fundo' : 'Geral' }}</button><select v-if="master" :value="token.layer" :disabled="busy" :aria-label="`Camada do token ${character.name}`" @change="emit('layer',token.id,($event.target as HTMLSelectElement).value as Layer)"><option value="fundo">Fundo</option><option value="mestre">Mestre</option><option value="geral">Geral</option></select><button v-if="master" :disabled="busy" :aria-label="`Remover ${character.name} do mapa`" @click="emit('remove',token.id)">×</button></li></ul>
    <label v-if="master && folders.length" class="character-folder-select">Pasta
      <select :value="character.folder_id ?? ''" :aria-label="`Pasta de ${character.name}`" :disabled="busy" @change="moveFolder(character,$event)">
        <option value="">Sem pasta</option>
        <option v-for="folder in folders" :key="folder.id" :value="folder.id">{{ folder.name }}</option>
      </select>
    </label>
    </template>
    </li></ul>
  </details>
  <q-dialog :model-value="!!folderToRemove" :persistent="busy" @update:model-value="folderToRemove=undefined">
    <q-card class="modal"><q-card-section>
      <h2>Excluir pasta {{ folderToRemove?.name }}?</h2>
      <p>Os personagens serão movidos para Sem pasta.</p>
      <div class="modal-actions">
        <button type="button" class="text-button" :disabled="busy" @click="folderToRemove=undefined">Cancelar</button>
        <button type="button" class="primary" :disabled="busy" @click="removeFolder">Excluir pasta</button>
      </div>
    </q-card-section></q-card>
  </q-dialog>
</section></template>
<style scoped>
.characters-empty{margin-top:20px}.character-list,.character-instances{list-style:none;padding:0}.character-list{margin:18px 0}.character-card{border:1px solid #513761;border-radius:10px;background:#281c32;padding:12px;margin-bottom:12px}.character-card[draggable=true]{cursor:grab}.character-summary{display:flex;gap:12px;align-items:center}.character-summary>img,.character-initial{width:65px;height:80px;flex-shrink:0;object-fit:cover;border-radius:7px;background:#17101e}.character-initial{display:grid;place-items:center;color:white;font-size:25px}.character-summary>div{min-width:0}.character-summary strong{font-size:13px;overflow-wrap:anywhere;display:block}.character-summary small{display:block;color:#ad94bd;font-size:10px;line-height:1.6;margin-top:4px}.character-actions{display:flex;gap:8px;margin-top:12px}.character-actions button,.character-instances button{color:#dec5f2;background:#3a2748;border:1px solid #614174;border-radius:6px;font-size:10px;padding:7px}.character-actions button:not(.view-card){flex:1}.character-actions .view-card{display:grid;place-items:center;padding:6px;flex:none}.character-instances{margin:12px 0 0}.character-instances li{display:flex;align-items:center;gap:5px;padding:5px 0}.character-instances li.selected{border-bottom:1px solid #b386d6}.character-instances button:first-child{flex:1;text-align:left}.character-instances select{width:80px;margin:0;padding:6px;font-size:10px}
.character-panel-actions,.character-folder-form{display:flex;align-items:center;gap:8px}
.character-folder-form{margin-top:10px}
.character-folder-form input{min-width:0;margin:0}
.character-folder-form button{flex-shrink:0}
.character-folder{margin-top:14px}
.character-folder summary{color:#dbc3ee;cursor:pointer;font-weight:600;padding:6px 0;overflow-wrap:anywhere}
.character-folder .character-list{margin:6px 0}
.remove-character-folder{padding:4px 8px;font-size:10px;margin:4px 0}
.character-folder-select{display:block;margin-top:8px}
.character-folder-select select{margin-top:4px}
.character-card.compact{padding:0;margin-bottom:4px}
.compact-character{display:flex;align-items:center;gap:8px;width:100%;padding:6px 8px;text-align:left;background:none;color:inherit;border:0;border-radius:inherit;touch-action:manipulation}
.compact-character:hover{background:#3a2748}
.compact-character span{width:9px;height:9px;border-radius:50%;flex:none}
.compact-character strong{min-width:0;overflow-wrap:anywhere}
</style>
