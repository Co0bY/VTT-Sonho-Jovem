export type Point = { x: number; y: number }
export type Camera = Point & { scale: number }
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
export function toWorld(point: Point, camera: Camera): Point {
  return { x: (point.x - camera.x) / camera.scale, y: (point.y - camera.y) / camera.scale }
}
export function zoomAt(camera: Camera, point: Point, scale: number): Camera {
  const world = toWorld(point, camera)
  const nextScale = clamp(scale, 0.02, 2.5)
  return { x: point.x - world.x * nextScale, y: point.y - world.y * nextScale, scale: nextScale }
}
export function tokenPosition(point: Point, cell: number, snap: boolean, width: number, height: number, gridType='square', size?:{width:number|null;height:number|null}): Point {
  const hex=snap&&gridType==='hex'?hexPosition(point,cell,width,height):null
  const align = (n: number, limit: number) => clamp(snap && gridType!=='none' ? Math.floor(n / cell) * cell + cell / 2 : n, cell / 2, limit - cell / 2)
  const marginX=Math.max(cell/2,(size?.width??0)/2),marginY=Math.max(cell/2,(size?.height??0)/2)
  return {x:clamp(hex?.x??align(point.x,width),marginX,width-marginX),y:clamp(hex?.y??align(point.y,height),marginY,height-marginY)}
}
export function distance(a: Point, b: Point, cell: number, perCell = 1.5): number {
  return Math.hypot(a.x - b.x, a.y - b.y) / cell * perCell
}

// Image coordinates use a top-left position and rotation around the center.
type ImageRect = Point & { width: number; height: number; rotation?: number }
export function imagePoint(rect: ImageRect, x: number, y: number): Point {
  const angle=(rect.rotation??0)*Math.PI/180, dx=x-rect.width/2, dy=y-rect.height/2
  return {x:rect.x+rect.width/2+dx*Math.cos(angle)-dy*Math.sin(angle),y:rect.y+rect.height/2+dx*Math.sin(angle)+dy*Math.cos(angle)}
}
export function imageContains(rect: ImageRect, point: Point): boolean {
  const angle=-(rect.rotation??0)*Math.PI/180,dx=point.x-rect.x-rect.width/2,dy=point.y-rect.y-rect.height/2
  return Math.abs(dx*Math.cos(angle)-dy*Math.sin(angle))<=rect.width/2 && Math.abs(dx*Math.sin(angle)+dy*Math.cos(angle))<=rect.height/2
}
export function resizeImage(rect: ImageRect, point: Point, corner: number, options: { proportional?: boolean; cell?: number } = {}): ImageRect {
  const sx=corner===0||corner===3?-1:1, sy=corner<2?-1:1
  const anchor=imagePoint(rect,sx<0?rect.width:0,sy<0?rect.height:0)
  const angle=(rect.rotation??0)*Math.PI/180,dx=point.x-anchor.x,dy=point.y-anchor.y
  let width=Math.max(8,sx*(dx*Math.cos(angle)+dy*Math.sin(angle)))
  let height=Math.max(8,sy*(-dx*Math.sin(angle)+dy*Math.cos(angle)))
  if(options.proportional!==false){
    const scale=(width*rect.width+height*rect.height)/(rect.width**2+rect.height**2)
    const longest=Math.max(rect.width,rect.height), shortest=Math.min(rect.width,rect.height)
    const cell=Math.max(1,options.cell??1)
    const steps=Math.max(Math.ceil(8*longest/shortest/cell),Math.round(longest*scale/cell))
    width=rect.width*steps*cell/longest
    height=rect.height*steps*cell/longest
  }
  const cx=anchor.x+(sx*width*Math.cos(angle)-sy*height*Math.sin(angle))/2
  const cy=anchor.y+(sx*width*Math.sin(angle)+sy*height*Math.cos(angle))/2
  return {x:cx-width/2,y:cy-height/2,width,height,rotation:rect.rotation??0}
}

// Pointy-top hexagons: cell is the width between parallel sides.
export function hexPosition(point: {x:number;y:number}, cell:number, width:number, height:number) {
  point={x:Math.max(cell/2,Math.min(width-cell/2,point.x)),y:Math.max(cell/2,Math.min(height-cell/2,point.y))}
  const radius=cell/Math.sqrt(3),step=radius*1.5
  const row=Math.round((point.y-radius)/step)
  let best={x:cell/2,y:radius},minimum=Infinity
  for(let r=Math.max(0,row-2);r<=Math.max(0,row+2);r++){
    const offset=(r%2)*cell/2,col=Math.round((point.x-cell/2-offset)/cell)
    for(let c=Math.max(0,col-2);c<=Math.max(0,col+2);c++){
      const x=cell/2+c*cell+offset,y=radius+r*step
      if(x<cell/2||x>width-cell/2||y<cell/2||y>height-cell/2)continue
      const d=(x-point.x)**2+(y-point.y)**2
      if(d<minimum){minimum=d;best={x,y}}
    }
  }
  return best
}

export function hexGridSegments(cell:number, width:number, height:number, view={left:0,top:0,right:width,bottom:height}): [Point,Point][] {
  const radius=cell/Math.sqrt(3),step=radius*1.5,segments:[Point,Point][]=[],seen=new Set<string>()
  for(let row=Math.floor(Math.max(0,view.top)/step)-2;row<=Math.ceil(Math.min(height,view.bottom)/step)+1;row++){
    for(let col=Math.floor(Math.max(0,view.left)/cell)-2;col<=Math.ceil(Math.min(width,view.right)/cell)+1;col++){
      const x=cell/2+col*cell+((row%2+2)%2)*cell/2,y=radius+row*step
      const vertices=Array.from({length:6},(_,i)=>{const angle=(i*60-90)*Math.PI/180;return {x:x+radius*Math.cos(angle),y:y+radius*Math.sin(angle)}})
      for(let i=0;i<6;i++){
        const a=vertices[i]!,b=vertices[(i+1)%6]!,key=[a,b].map(p=>`${Math.round(p.x*1e6)},${Math.round(p.y*1e6)}`).sort().join('|')
        if(!seen.has(key)){seen.add(key);segments.push([a,b])}
      }
    }
  }
  return segments
}

export function tokenBounds(token:Point & {width:number|null;height:number|null;rotation?:number}, cell:number, texture?:{width:number;height:number}): ImageRect {
  const scale=texture?Math.min(cell*0.8/texture.width,cell*0.8/texture.height):1
  const width=token.width??(texture?texture.width*scale:cell*0.8),height=token.height??(texture?texture.height*scale:cell*0.8)
  return {x:token.x-width/2,y:token.y-height/2,width,height,rotation:token.rotation??0}
}
