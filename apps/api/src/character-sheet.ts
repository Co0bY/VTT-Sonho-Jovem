import { BadRequestException } from '@nestjs/common'
export type SheetField={id:string;label:string;reference:string;type:'text'|'number';x:number;y:number;width:number;value:string}
export type CharacterSheet={version:1;width:number;height:number;fields:SheetField[]}
export const emptySheet=():CharacterSheet=>({version:1,width:800,height:1100,fields:[]})
export const MAX_SHEET_PAGES = 5
export const MAX_SHEET_BYTES = 1_000_000
export const FIRST_SHEET_PAGE = '00000000-0000-4000-8000-000000000001'
export const sheetPageParts = Array.from({length:MAX_SHEET_PAGES}, (_, index) => `sheet_page_${index}`)
export type FieldType = SheetField['type'] | 'bar' | 'select' | 'radio' | 'checkbox'
export type PageField = Omit<SheetField, 'type'> & {type:FieldType; height:number; highlight:boolean; hideLabel:boolean; maximum:number; options:string[]}
export type SheetPage = {id:string; width:number; height:number; fields:PageField[]; backgroundFile?:string; removeBackground?:boolean}
export type PagedSheet = {version:2; pages:SheetPage[]}
export type StoredSheet = CharacterSheet | PagedSheet

export function characterSheet(raw:unknown):StoredSheet {
  const fail=():never=>{throw new BadRequestException('Ficha inválida. Confira dimensões, referências únicas e posições dos campos.')}
  if(typeof raw!=='string'||Buffer.byteLength(raw)>MAX_SHEET_BYTES) return fail()
  let data:unknown
  try{data=JSON.parse(raw)}catch{return fail()}
  if(!data||typeof data!=='object'||Array.isArray(data))return fail()
  const sheet=data as Record<string,unknown>
  const number=(value:unknown,min:number,max:number):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max
  if(sheet.version===2)return pagedSheet(sheet.pages, fail)
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

function pagedSheet(raw:unknown, fail:()=>never):PagedSheet {
  const isRecord = (value:unknown):value is Record<string,unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
  const inRange = (value:unknown,min:number,max:number):value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
  const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
  const pageIds = new Set<string>(), fieldIds = new Set<string>(), references = new Set<string>()
  const types:readonly string[] = ['text','number','bar','select','radio','checkbox']
  if(!Array.isArray(raw)||raw.length<1||raw.length>MAX_SHEET_PAGES)return fail()
  let fieldCount=0
  const pages = raw.map((page:unknown):SheetPage=>{
    if(!isRecord(page))return fail()
    const {id,width,height,fields,removeBackground}=page
    if(removeBackground!==undefined&&typeof removeBackground!=='boolean')return fail()
    if(typeof id!=='string'||!uuid.test(id)||pageIds.has(id)||!inRange(width,400,1600)||!inRange(height,300,4000)||!Array.isArray(fields)||fields.length>100)return fail()
    fieldCount+=fields.length
    if(fieldCount>100)return fail()
    pageIds.add(id)
    return {id,width,height,removeBackground,fields:fields.map((field:unknown):PageField=>{
      if(!isRecord(field))return fail()
      const {id,label,reference,type,x,y,width:fieldWidth,height:fieldHeight,value,highlight,hideLabel,maximum,options}=field
      if(typeof id!=='string'||!uuid.test(id)||fieldIds.has(id)||typeof reference!=='string'||!/^[a-z][a-z0-9_]{0,63}$/.test(reference)||references.has(reference))return fail()
      if(typeof label!=='string'||!label.trim()||label.length>60||typeof type!=='string'||!types.includes(type)||typeof value!=='string'||value.length>1000)return fail()
      if(!inRange(fieldWidth,80,Math.min(600,width))||!inRange(fieldHeight,48,Math.min(600,height))||!inRange(x,0,width-fieldWidth)||!inRange(y,0,height-fieldHeight))return fail()
      if(typeof highlight!=='boolean'||typeof hideLabel!=='boolean'||!inRange(maximum,1,1000000)||!Number.isInteger(maximum))return fail()
      if(!Array.isArray(options)||options.length>20||options.some(o=>typeof o!=='string'||!o.trim()||o.trim()!==o||o.length>60)||new Set(options).size!==options.length)return fail()
      if(type==='number'&&value!==''&&!/^-?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(value))return fail()
      if(type==='bar'&&(!/^\d+$/.test(value)||!inRange(Number(value),0,maximum)))return fail()
      if((type==='select'||type==='radio')&&(!options.length||(value!==''&&!options.includes(value))))return fail()
      if(type==='checkbox'&&value!=='true'&&value!=='false')return fail()
      fieldIds.add(id)
      references.add(reference)
      return {id,label:label.trim(),reference,type:type as FieldType,x,y,width:fieldWidth,height:fieldHeight,value,highlight,hideLabel,maximum,options}
    })}
  })
  return {version:2,pages}
}
