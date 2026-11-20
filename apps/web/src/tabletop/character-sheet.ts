import type { SheetMacro } from './sheet-macros'

export const MAX_SHEET_PAGES = 5
export const MAX_SHEET_FIELDS = 120
const FIRST_SHEET_PAGE = '00000000-0000-4000-8000-000000000001'

export type FieldType = 'text' | 'textarea' | 'number' | 'bar' | 'select' | 'radio' | 'checkbox'
export type SheetField = {
  id:string; label:string; reference:string; type:FieldType
  x:number; y:number; width:number; height:number; value:string
  highlight:boolean; hideLabel:boolean; readOnly?:boolean; maximum:number; options:string[]
}
export type SheetPage = {
  id:string; width:number; height:number; fields:SheetField[]
  backgroundUrl?:string | null; removeBackground?:boolean
}
export type Technique = Record<'name'|'level'|'element'|'cost'|'range'|'effect'|'attribute', string>
export type CharacterSheet = {
  version:2; pages:SheetPage[]; macros?:SheetMacro[]
  techniques?:{attributes:Record<string,string>; rows:Technique[]}
}
type LegacySheet = {
  version:1; width:number; height:number
  fields:Omit<SheetField,'height'|'highlight'|'hideLabel'|'maximum'|'options'>[]
}
export type SavedSheet = LegacySheet | CharacterSheet

export function fieldDefaults() {
  return {height:64,highlight:false,hideLabel:false,maximum:100,options:[] as string[]}
}

export function emptyPage(id:string):SheetPage {
  return {id,width:800,height:1100,fields:[]}
}

export function editableSheet(sheet?:SavedSheet, backgroundUrl?:string|null):CharacterSheet {
  if(sheet?.version===2)return JSON.parse(JSON.stringify(sheet))
  const page=emptyPage(FIRST_SHEET_PAGE)
  if(sheet){
    page.width=sheet.width
    page.height=sheet.height
    page.fields=sheet.fields.map(field=>({...fieldDefaults(),...field}))
  }
  page.backgroundUrl=backgroundUrl
  return {version:2,pages:[page]}
}

export function hasOptions(type:FieldType) {
  return type==='select'||type==='radio'
}

export function fieldValueError(field:SheetField,value:string){
  if(value.length>1000)return 'Use até 1.000 caracteres no valor de cada campo.'
  if(field.type==='number'&&value!==''&&!/^-?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(value))return `Preencha ${field.label} com um número válido ou deixe vazio.`
  if(field.type==='bar'&&(!/^\d+$/.test(value)||Number(value)>field.maximum))return `${field.label} aceita um inteiro de 0 a ${field.maximum}.`
  if(hasOptions(field.type)&&value!==''&&!field.options.includes(value))return `O valor não corresponde a uma opção de ${field.label}.`
  if(field.type==='checkbox'&&value!=='false'&&value!=='true')return `${field.label} aceita somente true ou false.`
  return ''
}

export function sheetError(sheet:CharacterSheet) {
  const references=new Set<string>()
  for(const page of sheet.pages)for(const field of page.fields){
    if(!field.label.trim()||field.label.length>60)return 'Cada campo precisa de um rótulo de até 60 caracteres.'
    if(!/^[a-z][a-z0-9_]{0,63}$/.test(field.reference))return 'Use referências como for ou pontos_de_vida (letras minúsculas, números e sublinhado).'
    if(references.has(field.reference))return `A referência ${field.reference} está repetida. Use uma referência única em toda a ficha.`
    const invalidValue=fieldValueError(field,field.value)
    if(invalidValue)return invalidValue
    if(hasOptions(field.type)&&(!field.options.length||field.options.length>20||field.options.some(option=>option.length>60)||new Set(field.options).size!==field.options.length)){
      return `Informe de 1 a 20 opções distintas de até 60 caracteres para ${field.label}.`
    }
    references.add(field.reference)
  }
  return ''
}
