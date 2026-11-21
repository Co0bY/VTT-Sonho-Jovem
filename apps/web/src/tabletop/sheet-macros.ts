export const events = {clique:'Clique',enter:'Enter',mudanca:'Modificação'} as const
export type MacroEvent = keyof typeof events
export const reductions={maior:'Maior valor',menor:'Menor valor',somar:'Somar',subtrair:'Subtrair',multiplicar:'Multiplicar',dividir:'Dividir'} as const
export type Reduction=keyof typeof reductions
export type DiceGroup={count:number|null;countFieldId?:string;sides:number;reduction:Reduction|'sucesso'|null;success?:{min:number;max:number}}
export type DiceAction={kind:'rolar';groups:DiceGroup[];combine:Reduction|null}
export type TerminalAction=DiceAction|{kind:'rolar';sides:number}|{kind:'chat';text?:string}|{kind:'atribuir';targetId:string}
export type ChoiceAction={kind:'escolher';label:string;options:{label:string;action:MacroAction}[]}
export type MacroAction=TerminalAction|ChoiceAction
export type SheetMacro={fieldId:string;event:MacroEvent;action:MacroAction}
export type MacroField={id:string;reference:string;label:string}
export type MacroMessage={content:string;literal?:true;dice?:{groups:(Omit<DiceGroup,'count'|'countFieldId'>&{count:number})[];combine:Reduction|null}}
export const MAX_DICE_GROUPS=10
export const MAX_CHOICE_DEPTH=16
export const MAX_CHOICE_OPTIONS=12

export function diceAction(action:Extract<MacroAction,{kind:'rolar'}>):DiceAction {
  return 'groups' in action?action:{kind:'rolar',groups:[{count:null,sides:action.sides,reduction:'somar'}],combine:null}
}

function actionText(action: TerminalAction, fields: MacroField[]) {
  const reference = (id: string) => fields.find(field => field.id === id)?.reference
  if (action.kind === 'chat') return action.text === undefined ? 'chat' : `chat ${JSON.stringify(action.text)}`
  if (action.kind === 'atribuir') return `atribuir ${reference(action.targetId)}`
  const { groups, combine } = diceAction(action)
  const dice = groups.map(group => {
    const from = group.countFieldId ? ` de ${reference(group.countFieldId)}` : ''
    const expression = `${group.count ?? ''}d${group.sides}${from}`
    if (group.reduction === 'sucesso' && group.success) return `${expression} sucesso ${group.success.min}-${group.success.max}`
    return group.reduction === 'somar' ? expression : `${expression} ${group.reduction ?? 'null'}`
  }).join(', ')
  return `rolar ${dice}${combine ? ` combinar ${combine}` : ''}`
}

export function macroText(rules: SheetMacro[], fields: MacroField[]) {
  function choiceText(action: ChoiceAction): object {
    return { label: action.label, options: action.options.map(option => ({
      label: option.label, action: option.action.kind === 'escolher' ? choiceText(option.action) : actionText(option.action, fields),
    })) }
  }
  return rules.map(rule => {
    const field = fields.find(item => item.id === rule.fieldId)
    const text = rule.action.kind === 'escolher' ? `escolher ${JSON.stringify(choiceText(rule.action))}` : actionText(rule.action, fields)
    return `quando ${field?.reference} ${rule.event} ${text}`
  }).join('\n')
}

function parseDice(text:string,fields:MacroField[],sourceId:string,error:(detail:string)=>Error):DiceAction {
  const [groupsText,combineText,...extra]=text.trim().split(/\s+combinar\s+/)
  const isReduction=(value:string):value is Reduction=>Object.hasOwn(reductions,value)
  const combine=combineText??null
  if(extra.length||(combine&&!isReduction(combine)))throw error('operação inválida após “combinar”.')
  const parts=groupsText!.split(',')
  if(combine&&parts.length<2)throw error('use “combinar” com pelo menos duas rolagens.')
  if(parts.length>MAX_DICE_GROUPS)throw error('use até 10 rolagens por ação.')
  const groups=parts.map((part):DiceGroup=>{
    const match=/^(\d{1,2})?d(\d{1,4})(?:\s+de\s+([a-z][a-z0-9_]*))?(?:\s+(\w+)(?:\s+(\d{1,4})\s*-\s*(\d{1,4}))?)?$/.exec(part.trim())
    if(!match)throw error('use “d6” para quantidade do campo ou “2d6 maior” para quantidade fixa.')
    const count=match[1]?Number(match[1]):null
    const sides=Number(match[2])
    const operation=match[4]??'somar'
    const other = match[3] && fields.find(field => field.reference === match[3])
    if (match[3] && (!other || other.id === sourceId || count !== null)) throw error('selecione outro campo para a quantidade de dados.')
    const quantity = other ? { count, countFieldId: other.id } : { count }
    if(count!==null&&(count<1||count>50))throw error('use de 1 a 50 dados por rolagem.')
    if(sides<2||sides>1000)throw error('use de 2 a 1.000 faces.')
    if(operation==='sucesso'){
      const min=Number(match[5]),max=Number(match[6])
      if(!match[5]||min<1||max<min||max>sides)throw error(`defina um intervalo de sucesso entre 1 e ${sides}.`)
      return {...quantity,sides,reduction:'sucesso',success:{min,max}}
    }
    if(match[5])throw error('o intervalo só pode ser usado com “sucesso”.')
    if(operation==='null')return {...quantity,sides,reduction:null}
    if(!isReduction(operation))throw error('operação inválida para a rolagem.')
    return {...quantity,sides,reduction:operation}
  })
  if(combine&&groups.some(group=>group.reduction===null))throw error('para combinar, selecione um resultado em cada rolagem.')
  return {kind:'rolar',groups,combine:combine as Reduction|null}
}

function parseAction(text: string, fields: MacroField[], fieldId: string, error: (detail: string) => Error): MacroAction {
  function terminal(value: string): TerminalAction {
    value = value.replace(/^(chat|rolar|atribuir)\s+/, '$1 ')
    if (value === 'chat') return { kind: 'chat' }
    if (value.startsWith('chat ')) {
      let message: unknown
      try { message = JSON.parse(value.slice(5)) } catch { throw error('use aspas duplas para a mensagem do chat.') }
      if (typeof message !== 'string' || !message.trim() || message.length > 2000) throw error('escreva uma mensagem de até 2.000 caracteres.')
      return { kind: 'chat', text: message }
    }
    if (value.startsWith('atribuir ')) {
      const target = fields.find(field => field.reference === value.slice(9).trim())
      if (!target || target.id === fieldId) throw error('selecione um campo de destino existente e diferente da origem.')
      return { kind: 'atribuir', targetId: target.id }
    }
    if (value.startsWith('rolar ')) return parseDice(value.slice(6), fields, fieldId, error)
    throw error('use “chat”, “atribuir”, “rolar” ou “escolher”.')
  }

  function choice(raw: unknown, depth: number): ChoiceAction {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || depth > MAX_CHOICE_DEPTH) {
      throw error(`use até ${MAX_CHOICE_DEPTH} seletores em cada caminho.`)
    }
    const node = raw as Partial<ChoiceAction>
    if (typeof node.label !== 'string' || !node.label.trim() || node.label.length > 100 ||
      !Array.isArray(node.options) || !node.options.length || node.options.length > MAX_CHOICE_OPTIONS) {
      throw error('nomeie o seletor e configure de 1 a 12 opções.')
    }
    const labels = new Set<string>()
    const options = node.options.map(option => {
      const label = typeof option?.label === 'string' ? option.label.trim() : ''
      if (!label || label.length > 100 || labels.has(label)) throw error('use nomes diferentes de até 100 caracteres nas opções.')
      labels.add(label)
      const action = typeof option.action === 'string' ? terminal(option.action) : choice(option.action, depth + 1)
      return { label, action }
    })
    return { kind: 'escolher', label: node.label.trim(), options }
  }

  const choiceSource = /^escolher\s+(.+)$/.exec(text)
  if (!choiceSource) return terminal(text)
  let raw: unknown
  try { raw = JSON.parse(choiceSource[1]!) } catch { throw error('o seletor deve usar JSON válido.') }
  return choice(raw, 1)
}

export function parseMacros(text:string,fields:MacroField[]):SheetMacro[]{
  const rules:SheetMacro[]=[]
  const seen=new Set<string>()
  for(const [index,raw] of text.split('\n').entries()){
    const line=raw.trim()
    if(!line||line.startsWith('#'))continue
    const error=(detail:string)=>new Error(`Linha ${index+1}: ${detail}`)
    const match=/^quando\s+([a-z][a-z0-9_]*)\s+(clique|enter|mudanca)\s+(.+)$/.exec(line)
    if(!match)throw error('use “quando campo clique chat” ou “quando campo enter rolar d6”.')
    const field=fields.find(field=>field.reference===match[1])
    if(!field)throw error(`campo “${match[1]}” não encontrado na ficha.`)
    const event=match[2] as MacroEvent
    const key=`${field.id}/${event}`
    if(seen.has(key))throw error('já existe uma ação para esse campo e evento.')
    if(rules.length>=100)throw error('a ficha aceita até 100 regras.')
    seen.add(key)
    rules.push({fieldId:field.id,event,action:parseAction(match[3]!,fields,field.id,error)})
  }
  return rules
}

export function macroMessage(action:Exclude<TerminalAction,{kind:'atribuir'}>,value:string,readField:(id:string)=>string|undefined = () => undefined):MacroMessage {
  const content=(action.kind === 'chat' ? action.text ?? value : value).trim()
  if(action.kind==='chat'){
    if(!content)throw new Error('Preencha o valor do campo para executar a regra.')
    return {content,literal:true}
  }
  const {groups,combine}=diceAction(action)
  const resolved=groups.map(({ countFieldId, ...group })=>{
    const input = countFieldId ? readField(countFieldId)?.trim() ?? '' : content
    const count=group.count??Number(input)
    if(group.count===null&&(!/^\d+$/.test(input)||count<1||count>50)){
      throw new Error('Para usar o valor do campo, informe uma quantidade inteira de 1 a 50.')
    }
    return {...group,count}
  })
  const expression=resolved.map(group=>`${group.count}d${group.sides}`).join(', ')
  if(resolved.length===1&&resolved[0]?.reduction==='somar'&&!combine)return {content:`/roll ${expression}`}
  return {content:`/roll ${expression}`,dice:{groups:resolved,combine}}
}

export function usesMacroField(action: MacroAction, fieldId: string): boolean {
  if (action.kind === 'atribuir') return action.targetId === fieldId
  if (action.kind === 'rolar') return diceAction(action).groups.some(group => group.countFieldId === fieldId)
  return action.kind === 'escolher' && action.options.some(option => usesMacroField(option.action, fieldId))
}

export function newMacroChoice(): ChoiceAction {
  return {
    kind: 'escolher', label: 'Escolha uma opção',
    options: [
      { label: 'Opção 1', action: { kind: 'rolar', groups: [{ count: 1, sides: 6, reduction: 'somar' }], combine: null } },
      { label: 'Opção 2', action: { kind: 'chat' } },
    ],
  }
}
