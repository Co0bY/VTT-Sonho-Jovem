<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
const router = useRouter(), route = useRoute()
type User = { id: string; name: string; email: string }
type Campaign = { id: string; name: string; description: string; system: string; role: string; participants: number }
const user = ref<User | null>(null)
const ready = ref(false), busy = ref(false), registering = ref(false)
const error = ref(''), notice = ref(''), search = ref(''), filter = ref('todas')
const name = ref(''), email = ref(''), password = ref(''), confirmation = ref('')
const linkParams = new URLSearchParams(location.hash.slice(1))
const firstAccessToken = ref(linkParams.get('primeiro-acesso') || '')
const resetToken = ref(linkParams.get('redefinir-senha') || '')
const recovering = ref(false)
const creating = ref(false), title = ref(''), description = ref(''), system = ref('Sistema próprio')
const campaigns = ref<Campaign[]>([]), invitation = ref('')
const pending = ref(new URLSearchParams(location.search).get('convite') || linkParams.get('convite') || '')
const visible = computed(() => campaigns.value.filter(c => (filter.value === 'todas' || c.role === filter.value) && `${c.name} ${c.system}`.toLowerCase().includes(search.value.toLowerCase())))
class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message) }
}
async function api<T>(path: string, body?: object): Promise<T> {
  const response = await fetch(`/api/${path}`, { method: body ? 'POST' : 'GET', credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('auth/')) user.value = null
    throw new ApiError(typeof data.message === 'string' ? data.message : 'Não foi possível concluir. Tente novamente.', response.status)
  }
  return data
}
async function load() { campaigns.value = await api<Campaign[]>('campaigns') }
async function action(work: () => Promise<void>) {
  if (busy.value) return
  busy.value = true; error.value = ''; notice.value = ''
  try { await work() } catch (e) { error.value = e instanceof Error ? e.message : 'Falha de conexão com o servidor.' } finally { busy.value = false }
}
async function authenticate() {
  await action(async () => {
    if (registering.value) {
      const result = await api<{ message: string }>('auth/register', { name: name.value, email: email.value, invitation: pending.value })
      notice.value = result.message
      password.value = ''
      return
    }
    user.value = await api<User>('auth/login', { email: email.value, password: password.value })
    password.value = ''
    await load()
    const destination = typeof route.query.retorno === 'string' ? route.query.retorno : ''
    if (/^\/mesas\/[0-9a-f-]{36}$/i.test(destination)) await router.push(destination)
  })
}
function leavePasswordSetup() {
  firstAccessToken.value = ''; resetToken.value = ''; password.value = ''; confirmation.value = ''; error.value = ''
  const url = new URL('/', location.origin)
  if (pending.value) url.searchParams.set('convite', pending.value)
  history.replaceState({}, '', url)
}
async function setAccountPassword() {
  await action(async () => {
    if (password.value !== confirmation.value) throw new Error('As senhas não conferem.')
    const result = await api<{ message: string }>(resetToken.value ? 'auth/reset-password' : 'auth/first-access', { token: resetToken.value || firstAccessToken.value, password: password.value, confirmation: confirmation.value })
    leavePasswordSetup(); registering.value = false; user.value = null
    notice.value = result.message
  })
}
async function requestPasswordReset() {
  await action(async () => {
    const result = await api<{ message: string }>('auth/forgot-password', { email: email.value })
    notice.value = result.message
  })
}
function showRecovery() {
  leavePasswordSetup(); recovering.value = true; registering.value = false; notice.value = ''
}
async function logout() { await action(async () => { await api('auth/logout', {}); user.value = null; campaigns.value = []; invitation.value = ''; creating.value = false }) }
async function create() { await action(async () => { await api('campaigns', { name: title.value, description: description.value, system: system.value }); creating.value = false; title.value = ''; description.value = ''; await load(); notice.value = 'Mesa criada! Gere um convite para reunir seus jogadores.' }) }
async function invite(c: Campaign) { await action(async () => { const result = await api<{ token: string }>(`campaigns/${c.id}/invitations`, {}); const url = new URL('/', location.origin); url.searchParams.set('convite', result.token); invitation.value = url.toString() }) }
async function accept() { await action(async () => { await api(`invitations/${encodeURIComponent(pending.value)}/accept`, {}); pending.value = ''; history.replaceState({}, '', '/'); await load(); notice.value = 'Você entrou na mesa. Boa aventura!' }) }
async function copy() { try { await navigator.clipboard.writeText(invitation.value); notice.value = 'Convite copiado.' } catch { error.value = 'Selecione e copie o link de convite abaixo.' } }
onMounted(async () => {
  if (firstAccessToken.value || resetToken.value) { ready.value = true; return }
  try { user.value = await api<User>('auth/me'); await load() }
  catch (e) { if (!(e instanceof ApiError) || e.status !== 401) error.value = e instanceof Error ? e.message : 'Servidor indisponível.' }
  finally { ready.value = true }
})
</script>

<template>
  <q-page class="app-page">
    <header class="topbar"><a href="/" class="brand"><span class="brand-mark">✦</span> SONHO JOVEM <small>VIRTUAL TABLETOP</small></a><div v-if="user" class="account"><span>{{ user.name }}</span><button class="text-button" :disabled="busy" @click="logout">Sair</button></div><span v-else class="header-note">Sua próxima história começa aqui.</span></header>
    <main v-if="!ready" class="loading" role="status">Preparando sua próxima aventura…</main>
    <template v-else>
      <div v-if="error" role="alert" class="feedback error">{{ error }}</div>
      <div v-if="notice" role="status" class="feedback success">{{ notice }}</div>
      <main v-if="!user" class="auth-layout">
        <section class="intro"><span class="eyebrow">UM LUGAR PARA TODAS AS SUAS HISTÓRIAS</span><h1>Grandes aventuras.<br><em>Juntos à mesa.</em></h1><p>Reúna seu grupo, crie seus mundos e dê vida à próxima campanha. Seu espaço para jogar RPG, onde quer que seus amigos estejam.</p><div class="table-art" aria-hidden="true"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><span class="dice">✧</span><span class="map-label">IMAGINE. REÚNA. JOGUE.</span></div><div class="intro-bottom"><span>01 / CRIE SEU MUNDO</span><span>FEITO PARA MESTRES E JOGADORES</span></div></section>
        <section v-if="firstAccessToken || resetToken" class="auth-panel">
          <span class="eyebrow">{{ resetToken ? 'REDEFINIÇÃO DE SENHA' : 'PRIMEIRO ACESSO' }}</span><h2>{{ resetToken ? 'Cadastre uma nova senha' : 'Defina sua senha' }}</h2><p>{{ resetToken ? 'O link é de uso único e vale por 1 hora. Após a alteração, entre novamente com sua nova senha.' : 'Crie sua senha para ativar sua conta. O link é de uso único e vale por 2 dias.' }}</p>
          <form @submit.prevent="setAccountPassword"><label>Nova senha<input v-model="password" type="password" autocomplete="new-password" required minlength="10" maxlength="128" placeholder="Pelo menos 10 caracteres"></label><label>Confirme sua senha<input v-model="confirmation" type="password" autocomplete="new-password" required minlength="10" maxlength="128" placeholder="Repita sua senha"></label><button class="primary full" :disabled="busy">{{ busy ? 'Aguarde…' : resetToken ? 'Redefinir minha senha' : 'Definir minha senha' }}</button></form>
          <button class="text-button" :disabled="busy" @click="resetToken ? showRecovery() : (leavePasswordSetup(), registering = true)">Link expirou? Solicitar outro e-mail</button>
        </section>
        <section v-else-if="recovering" class="auth-panel">
          <span class="eyebrow">RECUPERE SEU ACESSO</span><h2>Esqueceu sua senha?</h2><p>Informe o e-mail da sua conta ativada. Enviaremos um link válido por 1 hora para você cadastrar uma nova senha.</p>
          <form @submit.prevent="requestPasswordReset"><label>E-mail<input v-model="email" type="email" autocomplete="email" required maxlength="254" placeholder="voce@exemplo.com"></label><button class="primary full" :disabled="busy">{{ busy ? 'Aguarde…' : 'Enviar link de redefinição' }}</button></form>
          <button class="text-button" :disabled="busy" @click="recovering = false; error = ''; notice = ''">Voltar para entrar</button>
        </section>
        <section v-else class="auth-panel"><span class="eyebrow">BEM-VINDO À SUA MESA</span><h2>{{ registering ? 'Comece sua jornada' : 'Bom ter você de volta' }}</h2><p>{{ registering ? 'Informe nome e e-mail. Você receberá um link para definir sua senha em até 2 dias.' : pending ? 'Entre ou crie uma conta para aceitar seu convite.' : 'Entre na sua conta e continue a história.' }}</p><div class="auth-tabs"><button :class="{ active: !registering }" @click="registering = false; error = ''; password = ''">Entrar</button><button :class="{ active: registering }" @click="registering = true; error = ''; password = ''">Criar conta</button></div>
          <form @submit.prevent="authenticate"><label v-if="registering">Como quer ser chamado?<input v-model="name" autocomplete="nickname" required minlength="2" maxlength="80" placeholder="Seu nome de aventureiro"></label><label>E-mail<input v-model="email" type="email" autocomplete="email" required maxlength="254" placeholder="voce@exemplo.com"></label><label v-if="!registering">Senha<input v-model="password" type="password" autocomplete="current-password" required maxlength="128" placeholder="Sua senha"></label><button class="primary full" :disabled="busy">{{ busy ? 'Aguarde…' : registering ? 'Receber link de primeiro acesso →' : 'Entrar na aventura →' }}</button></form><button v-if="!registering" class="text-button" :disabled="busy" @click="showRecovery">Esqueci minha senha</button><p class="form-foot">Ainda não ativou sua conta? Envie nome e e-mail novamente para receber um novo link.</p>
        </section>
      </main>
      <main v-else class="dashboard">
        <section class="welcome"><div><span class="eyebrow">SEU PONTO DE ENCONTRO</span><h1>Olá, {{ user.name }}<span class="accent">.</span></h1><p>Uma nova história está esperando por você e seu grupo.</p></div><button class="primary" @click="creating = true">＋ Criar nova mesa</button></section>
        <section v-if="pending" class="invite-banner"><div><strong>Você recebeu um convite!</strong><p>Aceite para participar da mesa como jogador.</p></div><button class="primary" :disabled="busy" @click="accept">Aceitar convite</button></section>
        <section class="stats"><div><strong>{{ campaigns.length }}</strong><span>Mesas na sua jornada</span></div><div><strong>{{ campaigns.filter(c => c.role === 'mestre').length }}</strong><span>Histórias que você conduz</span></div><div><strong>{{ campaigns.filter(c => c.role === 'jogador').length }}</strong><span>Aventuras como jogador</span></div></section>
        <section class="campaign-section"><div class="section-heading"><div><span class="eyebrow">SUAS CAMPANHAS</span><h2>Minhas mesas</h2></div><input v-model="search" class="search" aria-label="Buscar mesas" placeholder="Buscar uma mesa…"></div><div class="filters"><button v-for="item in [{v:'todas',l:'Todas as mesas'},{v:'mestre',l:'Sou mestre'},{v:'jogador',l:'Sou jogador'}]" :key="item.v" :class="{ active: filter === item.v }" @click="filter = item.v">{{ item.l }}</button></div>
          <div v-if="!visible.length" class="empty"><span class="empty-symbol">✧</span><h3>{{ campaigns.length ? 'Nenhuma mesa encontrada' : 'Toda aventura começa com uma mesa' }}</h3><p>{{ campaigns.length ? 'Experimente outra busca ou filtro.' : 'Crie sua primeira campanha ou aceite o convite de um amigo.' }}</p><button v-if="!campaigns.length" class="primary" @click="creating = true">Criar minha primeira mesa</button></div>
          <div v-else class="campaign-grid"><article v-for="(c, index) in visible" :key="c.id" class="campaign-card"><div class="card-cover" :class="`cover-${index % 3}`"><span class="card-rune" aria-hidden="true">{{ ['✧','◈','✦'][index % 3] }}</span><span class="role">{{ c.role === 'mestre' ? 'Mestre' : 'Jogador' }}</span></div><div class="card-body"><span class="eyebrow">{{ c.system }}</span><h3>{{ c.name }}</h3><p>{{ c.description || 'Uma história esperando para ser contada.' }}</p><router-link :to="`/mesas/${c.id}`" class="primary enter-table">Entrar na mesa →</router-link><div class="card-footer"><span>{{ c.participants }} {{ c.participants === 1 ? 'participante' : 'participantes' }}</span><button v-if="c.role === 'mestre'" class="text-button" :disabled="busy" @click="invite(c)">Convidar jogadores ↗</button><span v-else class="member-label">Você faz parte desta mesa</span></div></div></article></div>
        </section><footer class="dashboard-footer">SONHO JOVEM <span>O próximo capítulo começa com vocês.</span></footer>
      </main>
      <q-dialog v-model="creating"><q-card class="modal"><q-card-section><span class="eyebrow">UMA NOVA HISTÓRIA</span><h2>Criar mesa</h2><p>Prepare o ponto de encontro do seu grupo.</p><form @submit.prevent="create"><label>Nome da mesa<input v-model="title" required minlength="2" maxlength="100" placeholder="Ex.: Ecos de um reino esquecido"></label><label>Sistema de RPG<input v-model="system" required minlength="2" maxlength="80" placeholder="Ex.: D&D 5e, sistema próprio"></label><label>Descrição<textarea v-model="description" maxlength="1000" rows="3" placeholder="Conte um pouco sobre sua campanha"></textarea></label><p v-if="error" role="alert" class="modal-error">{{ error }}</p><div class="modal-actions"><button type="button" class="text-button" :disabled="busy" @click="creating = false">Cancelar</button><button class="primary" :disabled="busy">{{ busy ? 'Criando…' : 'Criar mesa' }}</button></div></form></q-card-section></q-card></q-dialog>
      <q-dialog :model-value="!!invitation" @update:model-value="invitation = ''"><q-card class="modal"><q-card-section><span class="eyebrow">AVENTURA COMPARTILHADA</span><h2>Convide seu grupo</h2><p>Compartilhe o link com seus jogadores. Válido por 7 dias; quem tiver o link poderá entrar após fazer login.</p><label>Link do convite<input :value="invitation" readonly @focus="($event.target as HTMLInputElement).select()"></label><div class="modal-actions"><button class="text-button" @click="invitation = ''">Fechar</button><button class="primary" @click="copy">Copiar link</button></div></q-card-section></q-card></q-dialog>
    </template>
  </q-page>
</template>

<style>
@import url('../styles.css');
</style>
