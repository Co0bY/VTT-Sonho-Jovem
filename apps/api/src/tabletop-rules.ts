import { BadRequestException } from '@nestjs/common'
import { hexPosition } from './grid'
import { randomInt } from 'node:crypto'

export const BOARD_WIDTH = 3200
export const BOARD_HEIGHT = 2200
export function integer(value: unknown, min: number, max: number, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) throw new BadRequestException(`${label}: informe um inteiro entre ${min} e ${max}.`)
  return value
}
export function position(x: unknown, y: unknown, cell: number, snap: boolean, width=BOARD_WIDTH, height=BOARD_HEIGHT, gridType='square', size?:{width:number|null;height:number|null}) {
  const px = integer(x, 0, width, 'Posição X')
  const py = integer(y, 0, height, 'Posição Y')
  const hex=snap&&gridType==='hex'?hexPosition({x:px,y:py},cell,width,height):null
  const align = (n: number, limit: number) => Math.max(cell / 2, Math.min(limit - cell / 2, snap && gridType!=='none' ? Math.floor(n / cell) * cell + cell / 2 : n))
  const marginX=Math.max(cell/2,(size?.width??0)/2),marginY=Math.max(cell/2,(size?.height??0)/2)
  return {x:Math.max(marginX,Math.min(width-marginX,hex?.x??align(px,width))),y:Math.max(marginY,Math.min(height-marginY,hex?.y??align(py,height)))}
}
export function rollDice(expression: string) {
  const match = /^(\d{1,2})d(\d{1,4})([+-]\d{1,4})?$/i.exec(expression.replace(/\s/g, ''))
  if (!match) throw new BadRequestException('Use /roll XdY, por exemplo /roll 2d6+3.')
  const count = integer(Number(match[1]), 1, 50, 'Quantidade de dados')
  const sides = integer(Number(match[2]), 2, 1000, 'Faces do dado')
  const modifier = Number(match[3] || 0)
  const rolls = Array.from({ length: count }, () => randomInt(1, sides + 1))
  return { expression: `${count}d${sides}${modifier ? (modifier > 0 ? '+' : '') + modifier : ''}`, rolls, modifier, total: rolls.reduce((sum, n) => sum + n, modifier) }
}

const reductions = ['maior','menor','somar','subtrair','multiplicar','dividir'] as const
type Reduction=typeof reductions[number]
type DiceGroup={count:number|null;sides:number;reduction:Reduction|'sucesso'|null;success?:{min:number;max:number}}

function reduction(value:unknown):value is Reduction {
  return reductions.some(operation=>operation===value)
}

export function diceGroups(raw:unknown,allowFieldValue:boolean){
  const invalid=():never=>{throw new BadRequestException('Configure de 1 a 10 rolagens, com 1 a 50 dados, 2 a 1.000 faces e operações válidas. Para combinar resultados, use pelo menos duas rolagens.')}
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return invalid()
  const {groups,combine}=raw as Record<string,unknown>
  if(!Array.isArray(groups)||groups.length<1||groups.length>10||(combine!==null&&(!reduction(combine)||groups.length<2)))return invalid()
  const validatedGroups=groups.map((item:unknown):DiceGroup=>{
    if(!item||typeof item!=='object'||Array.isArray(item))return invalid()
    const {count,sides,reduction:operation,success}=item as Record<string,unknown>
    if(operation!==null&&operation!=='sucesso'&&!reduction(operation))return invalid()
    const faces=integer(sides,2,1000,'Faces do dado')
    const group:DiceGroup={
      count:allowFieldValue&&count===null?null:integer(count,1,50,'Quantidade de dados'),
      sides:faces,
      reduction:operation,
    }
    if(operation==='sucesso'){
      if(!success||typeof success!=='object'||Array.isArray(success))return invalid()
      const range=success as Record<string,unknown>
      const min=integer(range.min,1,faces,'Início do sucesso')
      group.success={min,max:integer(range.max,min,faces,'Fim do sucesso')}
    }
    return group
  })
  if(combine&&validatedGroups.some(group=>group.reduction===null)){
    throw new BadRequestException('Para combinar resultados, selecione um resultado em cada rolagem.')
  }
  return {combine,groups:validatedGroups}
}

function reduceDice(values:number[],operation:Reduction){
  const combine:Record<Reduction,(left:number,right:number)=>number>={
    maior:Math.max,
    menor:Math.min,
    somar:(left,right)=>left+right,
    subtrair:(left,right)=>left-right,
    multiplicar:(left,right)=>left*right,
    dividir:(left,right)=>left/right,
  }
  const result=values.reduce((left,right)=>combine[operation](left,right))
  if(!Number.isFinite(result))throw new BadRequestException('A operação resultou em divisão por zero ou excedeu o limite numérico.')
  return result
}

export function rollDiceGroups(raw:unknown){
  const {groups,combine}=diceGroups(raw,false)
  const results=groups.map(group=>{
    const {expression,rolls}=rollDice(`${group.count}d${group.sides}`)
    if(group.reduction==='sucesso'){
      const {min,max}=group.success!
      const hits=rolls.filter(value=>value>=min&&value<=max).length
      return {expression,rolls,reduction:group.reduction,total:hits,success:{min,max,hits,misses:rolls.length-hits}}
    }
    return {expression,rolls,reduction:group.reduction,total:group.reduction===null?null:reduceDice(rolls,group.reduction)}
  })
  const total=combine?reduceDice(results.flatMap(group=>group.total===null?[]:[group.total]),combine):results.length===1?results[0].total:null
  return {expression:results.map(group=>group.expression).join(', '),groups:results,combine,total}
}
