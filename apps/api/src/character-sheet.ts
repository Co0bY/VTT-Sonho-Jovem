import { BadRequestException } from '@nestjs/common'
export type SheetField={id:string;label:string;reference:string;type:'text'|'number';x:number;y:number;width:number;value:string}
export type CharacterSheet={version:1;width:number;height:number;fields:SheetField[]}
export const emptySheet=():CharacterSheet=>({version:1,width:800,height:1100,fields:[]})
export function characterSheet(raw:unknown):CharacterSheet {
  const fail=():never=>{throw new BadRequestException('Ficha inválida. Confira dimensões, referências únicas e posições dos campos.')}
  if(typeof raw!=='string'||raw.length>200000) return fail()
  let data:unknown
  try{data=JSON.parse(raw)}catch{return fail()}
  if(!data||typeof data!=='object'||Array.isArray(data))return fail()
  const sheet=data as Record<string,unknown>
  const number=(value:unknown,min:number,max:number):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max
  if(sheet.version!==1||!number(sheet.width,400,1600)||!number(sheet.height,300,4000)||!Array.isArray(sheet.fields)||sheet.fields.length>100)return fail()
  const ids=new Set<string>(),references=new Set<string>()
  const fields:SheetField[]=sheet.fields.map((raw:unknown)=>{
    if(!raw||typeof raw!=='object'||Array.isArray(raw))return fail()
    const f=raw as Record<string,unknown>
    if(typeof f.id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(f.id)||ids.has(f.id))return fail()
    if(typeof f.label!=='string'||!f.label.trim()||f.label.length>60||typeof f.reference!=='string'||!/^[a-z][a-z0-9_]{0,63}$/.test(f.reference)||references.has(f.reference))return fail()
    if((f.type!=='text'&&f.type!=='number')||typeof f.value!=='string'||f.value.length>1000)return fail()
    if(f.type==='number'&&f.value!==''&&!/^-?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(f.value))return fail()
    if(!number(f.width,80,Math.min(600,sheet.width as number))||!number(f.x,0,(sheet.width as number)-f.width)||!number(f.y,0,(sheet.height as number)-64))return fail()
    ids.add(f.id);references.add(f.reference)
    return {id:f.id,label:f.label.trim(),reference:f.reference,type:f.type as SheetField['type'],x:f.x,y:f.y,width:f.width,value:f.value}
  })
  return {version:1,width:sheet.width as number,height:sheet.height as number,fields}
}
