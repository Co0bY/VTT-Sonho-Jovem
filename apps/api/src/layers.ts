import { BadRequestException } from '@nestjs/common'
export const LAYERS = ['fundo','mestre','geral'] as const
export type Layer = typeof LAYERS[number]
export function layer(value: unknown): Layer { if (typeof value !== 'string' || !LAYERS.includes(value as Layer)) throw new BadRequestException('Camada inválida.'); return value as Layer }
export function bounds(body: Record<string,unknown>,scene:{width:number;height:number}) {
  const values = ['x','y','width','height'].map(key => body?.[key])
  if (values.some(n=>typeof n !== 'number' || !Number.isFinite(n))) throw new BadRequestException('Dimensões inválidas.')
  const [x,y,width,height] = values as number[]
  if(x<0||y<0||width<8||height<8||x+width>scene.width||y+height>scene.height) throw new BadRequestException('Mantenha a imagem dentro do cenário, com tamanho mínimo de 8 pixels.')
  return {x,y,width,height}
}
