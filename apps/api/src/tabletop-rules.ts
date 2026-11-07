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
