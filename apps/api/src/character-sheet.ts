import { BadRequestException } from '@nestjs/common'
import { diceGroups } from './tabletop-rules'
export type SheetField={id:string;label:string;reference:string;type:'text'|'number';x:number;y:number;width:number;value:string}
export type CharacterSheet={version:1;width:number;height:number;fields:SheetField[]}
export const emptySheet=():CharacterSheet=>({version:1,width:800,height:1100,fields:[]})
export const MAX_SHEET_PAGES = 5
export const MAX_SHEET_BYTES = 1_000_000
export const FIRST_SHEET_PAGE = '00000000-0000-4000-8000-000000000001'
export const sheetPageParts = Array.from({length:MAX_SHEET_PAGES}, (_, index) => `sheet_page_${index}`)
export type FieldType = SheetField['type'] | 'textarea' | 'bar' | 'select' | 'radio' | 'checkbox'
export type PageField = Omit<SheetField, 'type'> & {type:FieldType; height:number; highlight:boolean; hideLabel:boolean; readOnly?:boolean; tokenShortcut?:boolean; maximum:number; options:string[]}
export type SheetPage = {id:string; width:number; height:number; fields:PageField[]; backgroundFile?:string; removeBackground?:boolean}
type SheetMacro = {
  fieldId:string
  event:'clique'|'enter'|'mudanca'
  action:{kind:'chat'}|{kind:'atribuir';targetId:string}|{kind:'rolar';sides:number}|({kind:'rolar'} & ReturnType<typeof diceGroups>)
}
export type PagedSheet = {version:2; pages:SheetPage[]; macros?:SheetMacro[]; techniques?:unknown}
export type StoredSheet = CharacterSheet | PagedSheet

function countFields(sheet?: StoredSheet) {
  return sheet?.version === 2 ? sheet.pages.reduce((count, page) => count + page.fields.length, 0) : 0
}

export function validateSheetFieldLimit(sheet?: StoredSheet, previous?: StoredSheet) {
  if (countFields(sheet) > Math.max(100, countFields(previous))) {
    throw new BadRequestException('A ficha aceita até 100 campos. Fichas existentes acima desse limite podem manter os campos já salvos.')
  }
}

export function characterSheet(raw:unknown):StoredSheet {
  const fail=():never=>{throw new BadRequestException('Ficha inválida. Confira dimensões, referências únicas e posições dos campos.')}
  if(typeof raw!=='string'||Buffer.byteLength(raw)>MAX_SHEET_BYTES) return fail()
  let data:unknown
  try{data=JSON.parse(raw)}catch{return fail()}
  if(!data||typeof data!=='object'||Array.isArray(data))return fail()
  const sheet=data as Record<string,unknown>
  const number=(value:unknown,min:number,max:number):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max
  if(sheet.version===2)return pagedSheet(sheet.pages, sheet.macros, fail)
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

function pagedSheet(raw:unknown, macros:unknown, fail:()=>never):PagedSheet {
  const isRecord = (value:unknown):value is Record<string,unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
  const inRange = (value:unknown,min:number,max:number):value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
  const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
  const pageIds = new Set<string>(), fieldIds = new Set<string>(), references = new Set<string>()
  const types:readonly string[] = ['text','textarea','number','bar','select','radio','checkbox']
  if(!Array.isArray(raw)||raw.length<1||raw.length>MAX_SHEET_PAGES)return fail()
  const pages = raw.map((page:unknown):SheetPage=>{
    if(!isRecord(page))return fail()
    const {id,width,height,fields,removeBackground}=page
    if(removeBackground!==undefined&&typeof removeBackground!=='boolean')return fail()
    if(typeof id!=='string'||!uuid.test(id)||pageIds.has(id)||!inRange(width,400,1600)||!inRange(height,300,4000)||!Array.isArray(fields)||fields.length>100)return fail()
    pageIds.add(id)
    return {id,width,height,removeBackground,fields:fields.map((field:unknown):PageField=>{
      if(!isRecord(field))return fail()
      const {id,label,reference,type,x,y,width:fieldWidth,height:fieldHeight,value,highlight,hideLabel,readOnly,tokenShortcut,maximum,options}=field
      if(typeof id!=='string'||!uuid.test(id)||fieldIds.has(id)||typeof reference!=='string'||!/^[a-z][a-z0-9_]{0,63}$/.test(reference)||references.has(reference))return fail()
      if(typeof label!=='string'||!label.trim()||label.length>60||typeof type!=='string'||!types.includes(type)||typeof value!=='string'||value.length>1000)return fail()
      if(!inRange(fieldWidth,12,width)||!inRange(fieldHeight,12,height)||!inRange(x,0,width-fieldWidth)||!inRange(y,0,height-fieldHeight))return fail()
      if(typeof highlight!=='boolean'||typeof hideLabel!=='boolean'||(readOnly!==undefined&&typeof readOnly!=='boolean')||!inRange(maximum,1,1000000)||!Number.isInteger(maximum))return fail()
      if(tokenShortcut!==undefined&&typeof tokenShortcut!=='boolean')return fail()
      if(!Array.isArray(options)||options.length>20||options.some(o=>typeof o!=='string'||!o.trim()||o.trim()!==o||o.length>60)||new Set(options).size!==options.length)return fail()
      if(type==='number'&&value!==''&&!/^-?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(value))return fail()
      if(type==='bar'&&(!/^\d+$/.test(value)||!inRange(Number(value),0,maximum)))return fail()
      if((type==='select'||type==='radio')&&(!options.length||(value!==''&&!options.includes(value))))return fail()
      if(type==='checkbox'&&value!=='true'&&value!=='false')return fail()
      fieldIds.add(id)
      references.add(reference)
      return {id,label:label.trim(),reference,type:type as FieldType,x,y,width:fieldWidth,height:fieldHeight,value,highlight,hideLabel,...(readOnly===undefined?{}:{readOnly}),...(tokenShortcut===undefined?{}:{tokenShortcut}),maximum,options}
    })}
  })
  if(macros===undefined)return {version:2,pages}
  const invalidMacro=():never=>{throw new BadRequestException('Regra da ficha inválida. Confira o campo, o evento e a ação.')}
  if(!Array.isArray(macros)||macros.length>100)return invalidMacro()
  const rules=new Set<string>()
  const validated=macros.map((rule:unknown):SheetMacro=>{
    if(!isRecord(rule))return invalidMacro()
    const {fieldId,event,action}=rule
    if(typeof fieldId!=='string'||!fieldIds.has(fieldId)||
      (event!=='clique'&&event!=='enter'&&event!=='mudanca')||!isRecord(action))return invalidMacro()
    const key=`${fieldId}/${event}`
    if(rules.has(key))return invalidMacro()
    rules.add(key)
    if(action.kind==='atribuir'&&typeof action.targetId==='string'&&fieldIds.has(action.targetId)&&action.targetId!==fieldId){
      return {fieldId,event,action:{kind:'atribuir',targetId:action.targetId}}
    }
    if(action.kind==='chat')return {fieldId,event,action:{kind:'chat'}}
    if(action.kind==='rolar'&&action.groups!==undefined)return {fieldId,event,action:{kind:'rolar',...diceGroups(action,true)}}
    if(action.kind==='rolar'&&inRange(action.sides,2,1000)&&Number.isInteger(action.sides)){
      return {fieldId,event,action:{kind:'rolar',sides:action.sides}}
    }
    return invalidMacro()
  })
  return {version:2,pages,macros:validated}
}
