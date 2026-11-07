export type SheetField={id:string;label:string;reference:string;type:'text'|'number';x:number;y:number;width:number;value:string}
export type CharacterSheet={version:1;width:number;height:number;fields:SheetField[]}
export const emptySheet=():CharacterSheet=>({version:1,width:800,height:1100,fields:[]})
export function sheetError(sheet:CharacterSheet){
  const references=new Set<string>()
  for(const field of sheet.fields){
    if(!field.label.trim()||field.label.length>60)return 'Cada campo precisa de um rótulo de até 60 caracteres.'
    if(!/^[a-z][a-z0-9_]{0,63}$/.test(field.reference))return 'Use referências como for ou pontos_de_vida: letras minúsculas, números e sublinhado, começando por uma letra.'
    if(references.has(field.reference))return `A referência ${field.reference} está repetida. Use uma referência única para cada campo.`
    if(field.value.length>1000)return 'Use até 1.000 caracteres no valor de cada campo.'
    if(field.type==='number'&&field.value!==''&&!/^-?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(field.value))return `Preencha ${field.label} com um número válido ou deixe vazio.`
    references.add(field.reference)
  }
  return ''
}
