import DOMPurify from 'dompurify'
export function cleanHtml(value:string){
  return DOMPurify.sanitize(value,{ALLOWED_TAGS:['p','div','br','b','strong','i','em','u','s','strike','ul','ol','li','blockquote'],ALLOWED_ATTR:[]})
}
export function editorHtml(value:string,format?:string){
  if(format==='html')return cleanHtml(value)
  return value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/\n/g,'<br>')
}
