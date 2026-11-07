<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import TabletopBoard from '../components/TabletopBoard.vue'
import ScenesMenu from '../components/ScenesMenu.vue'
import ImageTransformDialog from '../components/ImageTransformDialog.vue'
import type { Tabletop, Tool, Token, Scene, Layer, Rect } from '../tabletop/types'
import type { Point } from '../tabletop/geometry'
const route = useRoute()
const id = String(route.params.id)
const endpoint = `campaigns/${encodeURIComponent(id)}/tabletop`
const state = ref<Tabletop>(), loading = ref(true), busy = ref(false), error = ref(''), accessDenied = ref(false), loginRequired = ref(false), networkError = ref('')
const tool = ref<Tool>('select'), selected = ref(''), zoom = ref(100), panel = ref('chat'), sidebar = ref(true)
const board = ref<InstanceType<typeof TabletopBoard>>(), chatList = ref<HTMLElement>()
const draft = ref(''), tokenName = ref(''), tokenOwner = ref(''), tokenColor = ref('#a47ae2')

const editingLayer=ref<Layer>('geral'),objectName=ref(''),objectFile=ref<File>(),objectInput=ref<HTMLInputElement>()
const transformTarget=ref<{id:string;name:string;rect:Rect;layer:Layer}|null>(null)
const master = computed(() => state.value?.role === 'mestre')
const selectedToken = computed(() => state.value?.tokens.find(t => t.id === selected.value))
const loginLink = `/?retorno=${encodeURIComponent(`/mesas/${id}`)}`
const tabs = [{ id: 'chat', label: 'Chat', icon: '☷' }, { id: 'tokens', label: 'Tokens', icon: '◉' }, { id: 'members', label: 'Grupo', icon: '♙' }, { id: 'settings', label: 'Cenários', icon: '▦' },{ id:'layers',label:'Camadas',icon:'▱' }]
let timer: ReturnType<typeof setTimeout> | undefined, disposed = false, revision = 0
const abort = new AbortController()
class ApiError extends Error { constructor(message: string, readonly status: number) { super(message) } }
async function api<T>(path: string, body?: object | FormData): Promise<T> {
  const response = await fetch(`/api/${path}`, { method: body ? 'POST' : 'GET', credentials: 'same-origin', signal: abort.signal, headers: body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new ApiError(response.status === 413 ? 'A imagem deve ter no máximo 10 MB.' : data.message || 'Não foi possível concluir a ação.', response.status)
  return data
}
function report(e: unknown) {
  if (disposed) return
  error.value = e instanceof Error ? e.message : 'Falha ao conectar com a mesa.'
  if (e instanceof ApiError && (e.status === 401 || e.status === 403)) { accessDenied.value = true; loginRequired.value = e.status === 401; state.value = undefined }
}
async function refresh() {
  const requested = revision
  const data = await api<Tabletop>(endpoint)
  if (disposed || requested !== revision) return
  const element = chatList.value
  const shouldScroll = !state.value || !element || element.scrollHeight - element.scrollTop - element.clientHeight < 90
  if (state.value?.scene.id && state.value.scene.id !== data.scene.id) {selected.value='';transformTarget.value=null}
  state.value = data
  if (!tokenOwner.value) tokenOwner.value = data.user.id
  if(selected.value && selected.value!=='background'&&!data.tokens.some(t=>t.id===selected.value)&&!data.objects.some(object=>`object:${object.id}`===selected.value))selected.value=''
  if(transformTarget.value&&transformTarget.value.id!=='background'&&!data.objects.some(object=>object.id===transformTarget.value!.id))transformTarget.value=null
  if (shouldScroll) { await nextTick(); chatList.value?.scrollTo({ top: chatList.value.scrollHeight }) }
}
async function poll() {
  if (disposed || accessDenied.value) return
  if (!busy.value) { try { await refresh(); networkError.value = '' } catch (e) { if (e instanceof ApiError && [401,403].includes(e.status)) report(e); else networkError.value = e instanceof Error ? e.message : 'Falha ao atualizar a mesa.' } }
  if (!disposed && !accessDenied.value) timer = setTimeout(poll, 2000)
}
async function action(work: () => Promise<void>) {
  if (busy.value) return false
  busy.value = true; error.value = ''; revision++
  try { await work(); await refresh(); return true } catch (e) { if (e instanceof ApiError && e.status === 403) error.value = e.message; else report(e); return false } finally { busy.value = false }
}
async function moveToken(tokenId: string, point: Point) {
  await action(async () => {
    const token = await api<Token>(`${endpoint}/tokens/${tokenId}/move`, { x: Math.round(point.x), y: Math.round(point.y) })
    if (state.value) state.value.tokens = state.value.tokens.map(t => t.id === tokenId ? token : t)
  })
}
async function addToken() { await action(async () => {
  const count = state.value?.tokens.length || 0
  const token = await api<Token>(`${endpoint}/tokens`, { name: tokenName.value, owner_id: tokenOwner.value, color: tokenColor.value, layer:editingLayer.value, x: Math.min(1280 + (count % 8) * (state.value?.scene.cell_size || 64),(state.value?.scene.width || 3200)-64), y: Math.min(896 + Math.floor(count / 8) % 6 * (state.value?.scene.cell_size || 64),(state.value?.scene.height || 2200)-64) })
  selected.value = token.id; tokenName.value = ''
}) }
async function removeToken(tokenId: string) { await action(async () => { await api(`${endpoint}/tokens/${tokenId}/remove`, {}); selected.value = '' }) }
async function removeObject(objectId:string){return action(async()=>{await api(`${endpoint}/objects/${objectId}/remove`,{});selected.value=''})}
function removeSelected(targetId:string){if(targetId.startsWith('object:'))void removeObject(targetId.slice(7));else void removeToken(targetId)}
async function send(content = draft.value) { if (!content.trim()) return; await action(async () => { await api(`${endpoint}/messages`, { content }); if (content === draft.value) draft.value = ''; await nextTick(); chatList.value?.scrollTo({ top: chatList.value.scrollHeight }) }) }
async function createScene(settings: object) {
  let created: Scene | undefined
  const ok = await action(async () => { created = await api<Scene>(`${endpoint}/scenes`, settings) })
  return ok ? created?.id : undefined
}
async function saveScene(sceneId: string, settings: object) { return action(async () => { await api(`${endpoint}/scenes/${sceneId}/settings`, settings) }) }
async function activateScene(sceneId: string) { return action(async () => { await api(`${endpoint}/scenes/${sceneId}/activate`, {}); selected.value = '' }) }
async function uploadBackground(sceneId: string, file: File) { return action(async () => { const data = new FormData();data.append('image',file);await api(`${endpoint}/scenes/${sceneId}/background`,data) }) }
async function removeScene(sceneId:string){return action(async()=>{await api(`${endpoint}/scenes/${sceneId}/remove`,{})})}
async function saveFolder(folderId:string|null,name:string){return action(async()=>{await api(folderId?`${endpoint}/folders/${folderId}/settings`:`${endpoint}/folders`,{name})})}
async function removeFolder(folderId:string){return action(async()=>{await api(`${endpoint}/folders/${folderId}/remove`,{})})}
async function moveSceneFolder(sceneId:string,folderId:string|null){return action(async()=>{await api(`${endpoint}/scenes/${sceneId}/folder`,{folder_id:folderId})})}
async function setTokenLayer(tokenId:string,value:string){await action(async()=>{await api(`${endpoint}/tokens/${tokenId}/layer`,{layer:value})})}
function editImage(targetId:string,rect:Rect){const object=state.value?.objects.find(object=>object.id===targetId);transformTarget.value={id:targetId,name:object?.name||'Imagem principal de fundo',rect,layer:object?.layer||'fundo'}}
async function transformImage(targetId:string,rect:Rect,targetLayer:Layer=editingLayer.value,sceneSize?:{width:number;height:number;cell_size:number}){return action(async()=>{const path=targetId==='background'?`${endpoint}/scenes/${state.value!.scene.id}/background/transform`:`${endpoint}/objects/${targetId}/transform`;await api(path,{...rect,...(targetId==='background'?{}:{layer:targetLayer}),...(sceneSize?{scene_width:sceneSize.width,scene_height:sceneSize.height,scene_cell_size:sceneSize.cell_size}:{})})})}
async function addImage(){if(!objectFile.value)return;await action(async()=>{const data=new FormData();data.append('name',objectName.value);data.append('layer',editingLayer.value);data.append('image',objectFile.value!);await api(`${endpoint}/objects`,data);objectName.value='';objectFile.value=undefined;if(objectInput.value)objectInput.value.value=''})}
watch(editingLayer,()=>{selected.value='';tool.value='select'},{flush:'sync'})
watch(panel, async () => { if (panel.value === 'chat') { await nextTick(); chatList.value?.scrollTo({ top: chatList.value.scrollHeight }) } })
onMounted(async () => { try { await refresh() } catch (e) { report(e) } finally { loading.value = false; if (!disposed && !accessDenied.value) timer = setTimeout(poll, 2000) } })
onBeforeUnmount(() => { disposed = true; abort.abort(); if (timer) clearTimeout(timer) })
</script>

<template>
  <div class="tabletop-page">
    <header class="table-header"><router-link to="/" class="table-back" aria-label="Voltar às minhas mesas">‹ <span>Minhas mesas</span></router-link><div class="table-title"><span class="table-logo">✦</span><div><h1>{{ state?.campaign.name || 'Mesa virtual' }}</h1><span>{{ state?.campaign.system || 'Sonho Jovem' }}</span></div></div><div class="table-header-right"><span v-if="state" class="table-role">{{ master ? 'Mestre' : 'Jogador' }}</span><button class="table-button" :aria-expanded="sidebar" aria-label="Mostrar ou ocultar painel da mesa" @click="sidebar = !sidebar">☷ <span>Painel</span></button></div></header>
    <div v-if="loading" class="table-loading" role="status">Preparando a mesa e reunindo as histórias…</div>
    <div v-else-if="!state" class="table-loading"><h2>{{ loginRequired ? 'Entre para acessar a mesa' : 'Não foi possível abrir a mesa' }}</h2><p role="alert">{{ error }}</p><a v-if="loginRequired" :href="loginLink" class="primary">Entrar na conta</a><router-link v-else to="/" class="primary">Voltar às minhas mesas</router-link></div>
    <template v-else>
      <div v-if="error || networkError" class="table-error" role="alert">{{ error || networkError }} <button @click="error = ''; networkError = ''" aria-label="Fechar mensagem">×</button></div>
      <div class="table-workspace" :class="{ 'panel-hidden': !sidebar }">
        <nav class="table-tools" aria-label="Ferramentas da mesa"><div class="tool-group"><button :class="{ active: tool === 'select' }" :aria-pressed="tool === 'select'" title="Selecionar e mover tokens" aria-label="Selecionar e mover tokens" @click="tool = 'select'">↖</button><button :class="{ active: tool === 'pan' }" :aria-pressed="tool === 'pan'" title="Mover câmera" aria-label="Mover câmera" @click="tool = 'pan'">✥</button><button :class="{ active: tool === 'measure' }" :aria-pressed="tool === 'measure'" title="Medir distância" aria-label="Medir distância" @click="tool = 'measure'">↔</button></div><div class="tool-group"><button v-if="master" title="Adicionar token" aria-label="Adicionar token" @click="panel = 'tokens'; sidebar = true">+</button><button title="Configurar cenário" aria-label="Configurar cenário" @click="panel = 'settings'; sidebar = true">▦</button><button title="Centralizar cenário" aria-label="Centralizar cenário" @click="board?.center()"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M7 12h10m-5-5v10" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></button></div><span class="tools-bottom">SJ</span></nav>
        <section class="table-scene" aria-label="Área de jogo"><div v-if="master" class="layer-picker"><label for="active-layer">Camada de edição</label><select id="active-layer" v-model="editingLayer"><option value="fundo">Fundo</option><option value="mestre">Mestre · só você vê</option><option value="geral">Geral</option></select></div><div class="scene-caption"><span class="scene-dot"></span> {{ state.scene.name }} <span class="scene-dimensions">{{ Math.ceil(state.scene.width / state.scene.cell_size) }} × {{ Math.ceil(state.scene.height / state.scene.cell_size) }} células · {{ state.scene.snap && state.scene.grid_type !== 'none' ? 'Encaixe ativo' : 'Movimento livre' }}</span></div>
          <TabletopBoard :key="state.scene.id" ref="board" :scene="state.scene" :tokens="state.tokens" :objects="state.objects" :layer="master ? editingLayer : 'geral'" :user-id="state.user.id" :master="master" :tool="tool" :selected="selected" :locked="busy" @move="moveToken" @select="selected = $event" @zoom="zoom = $event" @transform="transformImage" @edit="editImage" @remove="removeSelected" />
          <div v-if="!state.tokens.length && !state.objects.length && !state.scene.background_url" class="scene-empty"><span>✧</span><strong>O palco da sua próxima aventura</strong><p>{{ master ? 'Adicione o primeiro token para começar.' : 'O mestre pode adicionar um token e atribuí-lo a você.' }}</p><button v-if="master" @click="panel = 'tokens'; sidebar = true">＋ Adicionar token</button></div>
          <div v-if="selectedToken" class="selection-info"><span :style="{ background: selectedToken.color }"></span><strong>{{ selectedToken.name }}</strong><small>{{ master || selectedToken.owner_id === state.user.id ? 'Arraste ou use as setas' : 'Controlado por outro participante' }}</small><button @click="selected = ''" aria-label="Desmarcar token">×</button></div>
          <div class="scene-controls"><span>{{ tool === 'measure' ? `Arraste para medir · 1 quadrado = ${state.scene.distance_per_cell} ${state.scene.distance_unit}` : tool === 'pan' ? 'Arraste o cenário para navegar' : master && (selected === 'background' || selected.startsWith('object:')) ? 'Cantos: proporção/grid · Alt: livre · Duplo clique: editar · Del: excluir' : 'Selecione um token · Arraste o fundo para navegar' }}</span><div><button aria-label="Diminuir zoom" @click="board?.zoomBy(0.8)">−</button><output aria-label="Zoom atual">{{ zoom }}%</output><button aria-label="Aumentar zoom" @click="board?.zoomBy(1.25)">+</button><button aria-label="Ajustar cenário à tela" title="Ajustar cenário à tela" @click="board?.center()"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M7 12h10m-5-5v10" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></button></div></div>
        </section>
        <aside v-if="sidebar" class="table-panel"><nav class="panel-tabs" aria-label="Painéis da mesa"><button v-for="tab in tabs" :key="tab.id" :class="{ active: panel === tab.id }" :aria-pressed="panel === tab.id" :aria-label="tab.label" @click="panel = tab.id"><span>{{ tab.icon }}</span>{{ tab.label }}</button></nav>
          <template v-if="panel === 'chat'"><div class="panel-heading"><h2>Chat da mesa</h2><span>HISTÓRICO COMPARTILHADO</span></div><div ref="chatList" class="chat-messages" role="log" aria-label="Mensagens da mesa" aria-live="polite"><div class="chat-welcome"><span>✦</span><strong>A história começa aqui</strong><p>Converse com seu grupo ou deixe os dados decidirem.</p></div><article v-for="message in state.messages" :key="message.id" class="chat-message" :class="{ 'own-message': message.user_id === state.user.id }"><header><strong>{{ message.author }}</strong><time :datetime="message.created_at">{{ new Date(message.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }}</time></header><div v-if="message.roll" class="dice-result"><span>ROLAGEM · {{ message.roll.expression }}</span><div class="dice-values"><b v-for="(value, index) in message.roll.rolls" :key="index">{{ value }}</b><span v-if="message.roll.modifier">{{ message.roll.modifier > 0 ? '+' : '' }}{{ message.roll.modifier }}</span></div><footer><span>RESULTADO</span><strong>{{ message.roll.total }}</strong></footer></div><p v-else>{{ message.content }}</p></article></div><div class="chat-composer"><div class="quick-dice"><button v-for="sides in [4,6,8,10,12,20]" :key="sides" :disabled="busy" @click="send(`/roll 1d${sides}`)">d{{ sides }}</button></div><form @submit.prevent="send()"><label class="sr-only" for="table-message">Mensagem ou comando de dados</label><textarea id="table-message" v-model="draft" rows="3" maxlength="2000" placeholder="Sua mensagem ou /roll 2d6+3" @keydown.enter.exact.prevent="send()"></textarea><div><span>Como <strong>{{ state.user.name }}</strong></span><button class="primary" :disabled="busy || !draft.trim()">Enviar ↗</button></div></form><small>Enter envia · Shift + Enter quebra linha</small></div></template>
          <section v-else-if="panel === 'tokens'" class="panel-content"><div class="panel-heading"><h2>Tokens do cenário</h2><span>{{ state.tokens.length }} NO TABULEIRO</span></div><p class="panel-help">{{ master ? 'Crie personagens e escolha quem pode controlá-los.' : 'Você pode mover os tokens atribuídos a você.' }}</p><ul class="table-token-list"><li v-for="token in state.tokens" :key="token.id" :class="{ selected: selected === token.id }"><button @click="editingLayer = token.layer; selected = token.id; tool = 'select'"><span :style="{ background: token.color }">{{ token.name.slice(0, 1).toUpperCase() }}</span><div><strong>{{ token.name }}</strong><small>{{ state.members.find(m => m.id === token.owner_id)?.name || 'Participante' }} · {{ token.layer }}</small></div></button><select v-if="master" :value="token.layer" :disabled="busy" :aria-label="`Camada do token ${token.name}`" @change="setTokenLayer(token.id,($event.target as HTMLSelectElement).value)"><option value="fundo">Fundo</option><option value="mestre">Mestre</option><option value="geral">Geral</option></select><button v-if="master" :disabled="busy" :aria-label="`Remover token ${token.name}`" title="Remover token" @click="removeToken(token.id)">×</button></li></ul><p v-if="!state.tokens.length" class="panel-help">Nenhum token adicionado ainda.</p><form v-if="master" class="token-form" @submit.prevent="addToken"><h3>Novo token</h3><label>Nome<input v-model="tokenName" required maxlength="40" placeholder="Ex.: Guardião da floresta"></label><label>Controlado por<select v-model="tokenOwner" required><option v-for="member in state.members" :key="member.id" :value="member.id">{{ member.name }} ({{ member.role }})</option></select></label><label class="token-color">Cor do token<input v-model="tokenColor" type="color"></label><button class="primary full" :disabled="busy">＋ Adicionar ao cenário</button></form></section>
          <section v-else-if="panel === 'members'" class="panel-content"><div class="panel-heading"><h2>Grupo da campanha</h2><span>{{ state.members.length }} PARTICIPANTES</span></div><p class="panel-help">Pessoas com acesso à mesa. Para convidar mais jogadores, use a opção de convite na dashboard.</p><ul class="member-list"><li v-for="member in state.members" :key="member.id"><span>{{ member.name.slice(0, 1).toUpperCase() }}</span><div><strong>{{ member.name }}{{ member.id === state.user.id ? ' (você)' : '' }}</strong><small>{{ member.role === 'mestre' ? 'Mestre da mesa' : 'Jogador' }}</small></div></li></ul></section>
          <ScenesMenu v-else-if="panel === 'settings'" :error="error" :remove="removeScene" :scenes="state.scenes" :folders="state.folders" :save-folder="saveFolder" :remove-folder="removeFolder" :move-folder="moveSceneFolder" :active-id="state.scene.id" :master="master" :busy="busy" :create="createScene" :save="saveScene" :activate="activateScene" :upload="uploadBackground" />          <section v-else class="panel-content"><div class="panel-heading"><h2>Camadas do cenário</h2><span>{{ master ? editingLayer.toUpperCase() : 'GERAL' }}</span></div><p class="panel-help">Fundo: mapa e composição. Mestre: conteúdo oculto dos jogadores. Geral: tokens e objetos visíveis ao grupo.</p><template v-if="master"><p class="panel-help">Escolha a camada acima do tabuleiro. Selecione uma imagem e arraste os cantos para redimensionar ou a alça circular para girar. Os cantos mantêm a proporção em passos do grid; Alt permite tamanho livre. Duplo clique abre as medidas e a exclusão. Del exclui a seleção.</p><form @submit.prevent="addImage"><label>Nome do objeto<input v-model="objectName" required maxlength="100" placeholder="Ex.: árvore, ponte, pista secreta"></label><label>Imagem do objeto<input ref="objectInput" type="file" accept="image/png,image/jpeg,image/webp" required @change="objectFile = ($event.target as HTMLInputElement).files?.[0]"></label><p class="panel-help">Até 10 MB. Será adicionado à camada {{ editingLayer }}.</p><button class="primary full" :disabled="busy || !objectFile">Adicionar imagem à camada</button></form></template><ul class="layer-object-list"><li v-for="object in state.objects.filter(object => !master || object.layer === editingLayer)" :key="object.id"><img :src="object.image_url" alt=""><div><strong>{{ object.name }}</strong><small>{{ object.layer }}</small></div><button v-if="master" class="text-button" @click="editImage(object.id, object)">Redimensionar</button></li></ul></section>

        </aside>
      </div><footer class="table-status"><span><i></i>{{ busy ? 'Salvando…' : error || networkError ? 'Falha de atualização' : 'Alterações salvas no servidor' }}</span><span>Protótipo · atualização a cada 2 s <b>✦ SONHO JOVEM</b></span></footer>
    <ImageTransformDialog :scene="state.scene" :target="transformTarget" :busy="busy" :error="error" :save="transformImage" :remove="removeObject" @close="transformTarget = null" /></template>
  </div>
</template>
<style src="../tabletop.css"></style>
