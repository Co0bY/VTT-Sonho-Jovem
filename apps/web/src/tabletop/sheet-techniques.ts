import type { MacroMessage } from './sheet-macros'

export function techniqueCost(level:string){
  return /^(?:[1-9]|1\d|20)$/.test(level) ? Number(level)*4 : null
}

export function techniqueAttack(attribute:string, level:string, caption:string):MacroMessage {
  const cost=techniqueCost(level)
  if(cost===null)throw new Error('Selecione o nível da técnica.')
  const count=Number(attribute)+cost/4
  if(!/^\d+$/.test(attribute)||count>50){
    throw new Error('Preencha o atributo com um inteiro não negativo. A rolagem aceita até 50 dados.')
  }
  return {
    content:caption, literal:true,
    dice:{groups:[{count,sides:6,reduction:'sucesso',success:{min:5,max:6}}],combine:null},
  }
}

export function techniqueDamage(level:string, hits:number, caption:string):MacroMessage {
  const cost=techniqueCost(level)
  if(cost===null||!Number.isInteger(hits)||hits<1||hits>50)throw new Error('Role um ataque com pelo menos um acerto antes de rolar o dano.')
  return {content:`/roll ${1+cost/4}d6+${hits}`,caption}
}
