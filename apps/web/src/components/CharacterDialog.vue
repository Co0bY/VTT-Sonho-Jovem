<script setup lang="ts">
import { onBeforeUnmount, reactive, ref, watch } from 'vue'
import type { Character, Member } from '../tabletop/types'
const props=defineProps<{open:boolean;character:Character|null;members:Member[];userId:string;busy:boolean;error:string;save:(id:string|null,data:FormData)=>Promise<boolean>}>()
const emit=defineEmits<{close:[]}>()
const name=ref(''),owner=ref(''),color=ref('#a47ae2'),localError=ref('')
const kinds=['appearance','token'] as const
type Kind=typeof kinds[number]
const inputs:Record<Kind,HTMLInputElement|null>={appearance:null,token:null}
const uploads=reactive<Record<Kind,File|null>>({appearance:null,token:null})
const previews=reactive<Record<Kind,string>>({appearance:'',token:''})
const removed=reactive<Record<Kind,boolean>>({appearance:false,token:false})
function release(kind:Kind){if(previews[kind].startsWith('blob:'))URL.revokeObjectURL(previews[kind]);previews[kind]=''}
watch(()=>[props.open,props.character?.id],()=>{
  if(!props.open){for(const kind of kinds){release(kind);uploads[kind]=null};return}
  name.value=props.character?.name??'';owner.value=props.character?.owner_id??props.userId;color.value=props.character?.color??'#a47ae2';localError.value=''
  for(const kind of kinds){release(kind);uploads[kind]=null;removed[kind]=false}
},{immediate:true})
function preview(kind:Kind){return previews[kind]||(!removed[kind]?(kind==='appearance'?props.character?.appearance_url:props.character?.token_url):null)}
function selectImage(kind:Kind,event:Event){
  const input=event.target as HTMLInputElement,file=input.files?.[0]
  if(!file)return
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>10*1024*1024){localError.value='Escolha uma imagem PNG, JPEG ou WebP de até 10 MB.';input.value='';return}
  localError.value='';release(kind);uploads[kind]=file;removed[kind]=false;previews[kind]=URL.createObjectURL(file)
}
function removeImage(kind:Kind){release(kind);uploads[kind]=null;removed[kind]=true;if(inputs[kind])inputs[kind]!.value=''}
async function save(){
  localError.value=''
  const data=new FormData();data.append('name',name.value);data.append('owner_id',owner.value);data.append('color',color.value)
  for(const kind of kinds){if(uploads[kind])data.append(kind,uploads[kind]!);if(removed[kind])data.append(`remove_${kind}`,'true')}
  if(await props.save(props.character?.id??null,data))emit('close')
}
onBeforeUnmount(()=>{for(const kind of kinds)release(kind)})
</script>
<template>
  <q-dialog :model-value="open" :persistent="busy" @update:model-value="emit('close')"><q-card class="modal character-dialog"><q-card-section>
    <span class="eyebrow">PERSONAGENS DA CAMPANHA</span><h2>{{ character ? 'Editar personagem' : 'Novo personagem' }}</h2>
    <form @submit.prevent="save">
      <div class="character-images"><fieldset v-for="kind in kinds" :key="kind" :disabled="busy"><legend>{{ kind === 'appearance' ? 'Aparência' : 'Token' }}</legend>
        <div class="character-image-preview" :class="{ 'token-preview': kind === 'token' }"><img v-if="preview(kind)" :src="preview(kind)!" :alt="kind === 'appearance' ? 'Prévia da aparência' : 'Prévia do token'"><span v-else aria-hidden="true">{{ name.trim().slice(0,1).toUpperCase() || '✧' }}</span></div>
        <label>{{ kind === 'appearance' ? 'Imagem de aparência' : 'Imagem do token' }}<input :ref="el=>inputs[kind]=el as HTMLInputElement|null" type="file" accept="image/png,image/jpeg,image/webp" @change="selectImage(kind,$event)"></label>
        <p>{{ kind === 'appearance' ? 'Retrato exibido no painel lateral.' : 'Imagem usada ao adicionar ao mapa.' }}</p>
        <button v-if="preview(kind)" type="button" class="text-button" :aria-label="kind === 'appearance' ? 'Remover imagem de aparência' : 'Remover imagem do token'" @click="removeImage(kind)">Remover imagem</button>
      </fieldset></div>
      <p class="character-hint">Imagens opcionais, até 10 MB cada. Criar um personagem não o adiciona ao mapa.</p>
      <label>Nome do personagem<input v-model="name" required maxlength="40" :disabled="busy" placeholder="Ex.: Guardião da floresta"></label>
      <label for="character-owner">Controlado por</label><select id="character-owner" v-model="owner" required :disabled="busy"><option v-for="member in members" :key="member.id" :value="member.id">{{ member.name }} ({{ member.role === 'mestre' ? 'mestre' : 'jogador' }})</option></select>
      <label class="character-color">Cor de identificação<input v-model="color" type="color" :disabled="busy"></label>
      <p v-if="localError || error" role="alert" class="character-error">{{ localError || error }}</p>
      <div class="modal-actions"><button type="button" class="text-button" :disabled="busy" @click="emit('close')">Cancelar</button><button class="primary" :disabled="busy">{{ character ? 'Salvar personagem' : 'Criar personagem' }}</button></div>
    </form>
  </q-card-section></q-card></q-dialog>
</template>
<style scoped>
.character-dialog{width:620px;max-width:94vw;max-height:90vh;overflow:auto}.character-dialog h2{font-size:24px;margin:12px 0 22px}.character-images{display:grid;grid-template-columns:1fr 1fr;gap:16px}.character-images fieldset{min-width:0;border:1px solid #59436a;border-radius:10px;padding:12px}.character-images legend{color:#d8c0ed;font-size:14px;padding:0 7px}.character-image-preview{height:145px;background:#15101d;border-radius:8px;display:grid;place-items:center;overflow:hidden;color:#c2a2e4;font-size:44px}.character-image-preview img{width:100%;height:100%;object-fit:contain}.token-preview img{max-width:130px;max-height:130px}.character-images label{font-size:11px;margin:12px 0}.character-images input[type=file]{padding:7px;font-size:10px;max-width:100%}.character-images p,.character-hint{font-size:11px!important;color:#ad96bc;line-height:1.7}.character-images button{font-size:11px;padding:6px 0}.character-hint{margin:12px 0}.character-dialog select{width:100%;padding:12px;border:1px solid #59436a;background:#17111e;color:#eadff3;border-radius:7px}.character-color{display:flex;align-items:center;justify-content:space-between}.character-color input{width:55px;height:35px;padding:3px;margin:0}.character-error{color:#ffc0d0!important}@media(max-width:480px){.character-images{gap:8px}.character-images fieldset{padding:8px}.character-image-preview{height:110px}.character-images input[type=file]{font-size:9px}}
</style>
