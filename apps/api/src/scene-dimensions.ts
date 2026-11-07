import { BadRequestException } from '@nestjs/common'
import { integer } from './tabletop-rules'
export const MIN_SCENE_SIZE=128
export const MAX_SCENE_SIZE=16384
export function sceneSize(body:Record<string,unknown>,current:{width:number;height:number},prefix=''){
  return {width:integer(body?.[`${prefix}width`]??current.width,MIN_SCENE_SIZE,MAX_SCENE_SIZE,'Largura do cenário'),height:integer(body?.[`${prefix}height`]??current.height,MIN_SCENE_SIZE,MAX_SCENE_SIZE,'Altura do cenário')}
}
export function sceneError(error:unknown):never{
  if((error as {code?:string}).code==='23503')throw new BadRequestException('A pasta não está mais disponível. Atualize a lista e tente novamente.')
  if((error as {code?:string}).code==='23514')throw new BadRequestException('As dimensões deixariam tokens ou imagens fora do cenário. Reposicione ou redimensione esses itens antes de reduzir a área.')
  throw error
}
