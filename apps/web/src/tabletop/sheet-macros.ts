export const events = {clique:'Clique',enter:'Enter',mudanca:'Modificação'} as const
export type MacroEvent = keyof typeof events
export const reductions={maior:'Maior valor',menor:'Menor valor',somar:'Somar',subtrair:'Subtrair',multiplicar:'Multiplicar',dividir:'Dividir'} as const
export type Reduction=keyof typeof reductions
export type DiceGroup={count:number|null;sides:number;reduction:Reduction|'sucesso'|null;success?:{min:number;max:number}}
export type DiceAction={kind:'rolar';groups:DiceGroup[];combine:Reduction|null}
export type MacroAction=DiceAction|{kind:'rolar';sides:number}|{kind:'chat'}|{kind:'atribuir';targetId:string}
export type SheetMacro={fieldId:string;event:MacroEvent;action:MacroAction}
export type MacroField={id:string;reference:string;label:string}
export type MacroMessage={content:string;caption?:string;literal?:true;dice?:{groups:(Omit<DiceGroup,'count'>&{count:number})[];combine:Reduction|null}}
export const MAX_DICE_GROUPS=10

export function diceAction(action:Extract<MacroAction,{kind:'rolar'}>):DiceAction {
  return 'groups' in action?action:{kind:'rolar',groups:[{count:null,sides:action.sides,reduction:'somar'}],combine:null}
}

export function macroText(rules:SheetMacro[],fields:MacroField[]){
  return rules.map(rule=>{
    const reference=fields.find(field=>field.id===rule.fieldId)?.reference
    if(rule.action.kind==='chat')return `quando ${reference} ${rule.event} chat`
    if(rule.action.kind==='atribuir'){
      const target=rule.action.targetId
      return `quando ${reference} ${rule.event} atribuir ${fields.find(field=>field.id===target)?.reference}`
    }
    const {groups,combine}=diceAction(rule.action)
    const dice=groups.map(group=>{
      const expression=`${group.count??''}d${group.sides}`
      if(group.reduction==='sucesso'&&group.success)return `${expression} sucesso ${group.success.min}-${group.success.max}`
      return group.reduction==='somar'?expression:`${expression} ${group.reduction??'null'}`
    }).join(', ')
    return `quando ${reference} ${rule.event} rolar ${dice}${combine?` combinar ${combine}`:''}`
  }).join('\n')
}

function parseDice(text:string,error:(detail:string)=>Error):DiceAction {
  const [groupsText,combineText,...extra]=text.trim().split(/\s+combinar\s+/)
  const isReduction=(value:string):value is Reduction=>Object.hasOwn(reductions,value)
  const combine=combineText??null
  if(extra.length||(combine&&!isReduction(combine)))throw error('operação inválida após “combinar”.')
  const parts=groupsText!.split(',')
  if(combine&&parts.length<2)throw error('use “combinar” com pelo menos duas rolagens.')
  if(parts.length>MAX_DICE_GROUPS)throw error('use até 10 rolagens por ação.')
  const groups=parts.map((part):DiceGroup=>{
    const match=/^(\d{1,2})?d(\d{1,4})(?:\s+(\w+)(?:\s+(\d{1,4})\s*-\s*(\d{1,4}))?)?$/.exec(part.trim())
    if(!match)throw error('use “d6” para quantidade do campo ou “2d6 maior” para quantidade fixa.')
    const count=match[1]?Number(match[1]):null
    const sides=Number(match[2])
    const operation=match[3]??'somar'
    if(count!==null&&(count<1||count>50))throw error('use de 1 a 50 dados por rolagem.')
    if(sides<2||sides>1000)throw error('use de 2 a 1.000 faces.')
    if(operation==='sucesso'){
      const min=Number(match[4]),max=Number(match[5])
      if(!match[4]||min<1||max<min||max>sides)throw error(`defina um intervalo de sucesso entre 1 e ${sides}.`)
      return {count,sides,reduction:'sucesso',success:{min,max}}
    }
    if(match[4])throw error('o intervalo só pode ser usado com “sucesso”.')
    if(operation==='null')return {count,sides,reduction:null}
    if(!isReduction(operation))throw error('operação inválida para a rolagem.')
    return {count,sides,reduction:operation}
  })
  if(combine&&groups.some(group=>group.reduction===null))throw error('para combinar, selecione um resultado em cada rolagem.')
  return {kind:'rolar',groups,combine:combine as Reduction|null}
}

export function parseMacros(text:string,fields:MacroField[]):SheetMacro[]{
  const rules:SheetMacro[]=[]
  const seen=new Set<string>()
  for(const [index,raw] of text.split('\n').entries()){
    const line=raw.trim()
    if(!line||line.startsWith('#'))continue
    const error=(detail:string)=>new Error(`Linha ${index+1}: ${detail}`)
    const match=/^quando\s+([a-z][a-z0-9_]*)\s+(clique|enter|mudanca)\s+(chat|rolar\s+(.+)|atribuir\s+([a-z][a-z0-9_]*))$/.exec(line)
    if(!match)throw error('use “quando campo clique chat” ou “quando campo enter rolar d6”.')
    const field=fields.find(field=>field.reference===match[1])
    if(!field)throw error(`campo “${match[1]}” não encontrado na ficha.`)
    const event=match[2] as MacroEvent
    const key=`${field.id}/${event}`
    if(seen.has(key))throw error('já existe uma ação para esse campo e evento.')
    if(rules.length>=100)throw error('a ficha aceita até 100 regras.')
    seen.add(key)
    let action:MacroAction=match[4]?parseDice(match[4],error):{kind:'chat'}
    if(match[5]){
      const target=fields.find(item=>item.reference===match[5])
      if(!target||target.id===field.id)throw error('selecione um campo de destino existente e diferente da origem.')
      action={kind:'atribuir',targetId:target.id}
    }
    rules.push({fieldId:field.id,event,action})
  }
  return rules
}

export function macroMessage(action:Exclude<MacroAction,{kind:'atribuir'}>,value:string):MacroMessage {
  const content=value.trim()
  if(action.kind==='chat'){
    if(!content)throw new Error('Preencha o valor do campo para executar a regra.')
    return {content,literal:true}
  }
  const {groups,combine}=diceAction(action)
  const resolved=groups.map(group=>{
    const count=group.count??Number(content)
    if(group.count===null&&(!/^\d+$/.test(content)||count<1||count>50)){
      throw new Error('Para usar o valor do campo, informe uma quantidade inteira de 1 a 50.')
    }
    return {...group,count}
  })
  const expression=resolved.map(group=>`${group.count}d${group.sides}`).join(', ')
  if(resolved.length===1&&resolved[0]?.reduction==='somar'&&!combine)return {content:`/roll ${expression}`}
  return {content:`/roll ${expression}`,dice:{groups:resolved,combine}}
}
