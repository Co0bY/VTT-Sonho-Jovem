export const events = {clique:'Clique',enter:'Enter',mudanca:'Modificação'} as const
export type MacroEvent = keyof typeof events
export type MacroAction = {kind:'rolar';sides:number}|{kind:'chat'}
export type SheetMacro = {fieldId:string;event:MacroEvent;action:MacroAction}
export type MacroField = {id:string;reference:string;label:string}
export type MacroMessage = {content:string;literal?:true}

export function macroText(rules:SheetMacro[],fields:MacroField[]){
  return rules.map(rule=>{
    const reference=fields.find(field=>field.id===rule.fieldId)?.reference
    const action=rule.action.kind==='rolar'?`rolar d${rule.action.sides}`:'chat'
    return `quando ${reference} ${rule.event} ${action}`
  }).join('\n')
}

export function parseMacros(text:string,fields:MacroField[]):SheetMacro[]{
  const rules:SheetMacro[]=[]
  const seen=new Set<string>()
  for(const [index,raw] of text.split('\n').entries()){
    const line=raw.trim()
    if(!line||line.startsWith('#'))continue
    const error=(detail:string)=>new Error(`Linha ${index+1}: ${detail}`)
    const match=/^quando\s+([a-z][a-z0-9_]*)\s+(clique|enter|mudanca)\s+(chat|rolar\s+d(\d{1,4}))$/.exec(line)
    if(!match)throw error('use “quando campo clique chat” ou “quando campo enter rolar d6”.')
    const field=fields.find(field=>field.reference===match[1])
    if(!field)throw error(`campo “${match[1]}” não encontrado na ficha.`)
    const event=match[2] as MacroEvent
    const key=`${field.id}/${event}`
    if(seen.has(key))throw error('já existe uma ação para esse campo e evento.')
    const sides=Number(match[4])
    if(match[4]&&(sides<2||sides>1000))throw error('use de 2 a 1.000 faces.')
    if(rules.length>=100)throw error('a ficha aceita até 100 regras.')
    seen.add(key)
    rules.push({fieldId:field.id,event,action:match[4]?{kind:'rolar',sides}:{kind:'chat'}})
  }
  return rules
}

export function macroMessage(rule:SheetMacro,value:string):MacroMessage {
  const content=value.trim()
  if(!content)throw new Error('Preencha o valor do campo para executar a regra.')
  if(rule.action.kind==='chat')return {content,literal:true}
  if(!/^\d+$/.test(content)||Number(content)<1||Number(content)>50){
    throw new Error('Para rolar dados, informe no campo uma quantidade inteira de 1 a 50.')
  }
  return {content:`/roll ${Number(content)}d${rule.action.sides}`}
}
