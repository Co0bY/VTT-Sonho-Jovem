import type { Message } from './types'

export type VisualDie = { sides: number; value: number }

export function diceInRoll(roll: Message['roll']): VisualDie[] {
  if (!roll) return []
  const groups = 'groups' in roll ? roll.groups : [roll]
  return groups.flatMap(({ expression, rolls }) => {
    const sides = Number(/\d+d(\d+)/i.exec(expression)?.[1])
    return Number.isInteger(sides) && sides >= 2
      ? rolls.filter(value => Number.isInteger(value) && value >= 1 && value <= sides).map(value => ({ sides, value }))
      : []
  })
}

export function newDiceBatches(previous: readonly Message[] | undefined, latest: readonly Message[]) {
  if (!previous) return []
  const known = new Set(previous.map(message => message.id))
  return latest.flatMap(message => {
    const dice = known.has(message.id) ? [] : diceInRoll(message.roll)
    return dice.length ? [{ id: message.id, dice }] : []
  })
}

type Vector = [number, number, number]
type Face = { vertices: Vector[]; normal: Vector; center: Vector }
const difference = (a: Vector, b: Vector): Vector => [a[0]-b[0], a[1]-b[1], a[2]-b[2]]
const dot = (a: Vector, b: Vector) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2]
const cross = (a: Vector, b: Vector): Vector => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]
const scale = (v: Vector, multiplier: number): Vector => [v[0]*multiplier,v[1]*multiplier,v[2]*multiplier]
const unit = (v: Vector) => scale(v, 1/Math.hypot(...v))

function hull(points: Vector[]): Face[] {
  const faces = new Map<string, Face>()
  for (const [i, a] of points.entries()) {
    for (let j=i+1; j<points.length; j++) {
      for (let k=j+1; k<points.length; k++) {
        const perpendicular = cross(difference(points[j]!,a),difference(points[k]!,a))
        if (Math.hypot(...perpendicular)<1e-6) continue
        let normal = unit(perpendicular)
        const distances = points.map(point => dot(normal,difference(point,a)))
        if (distances.some(d=>d>1e-6) && distances.some(d=>d< -1e-6)) continue
        if (distances.some(d=>d>1e-6)) normal = scale(normal,-1)
        const indices = distances.flatMap((d,index)=>Math.abs(d)<1e-6?[index]:[])
        const key = indices.join(',')
        if (faces.has(key)) continue
        const vertices = indices.map(index=>points[index]!)
        const center = scale(vertices.reduce<Vector>((sum,v)=>[sum[0]+v[0],sum[1]+v[1],sum[2]+v[2]],[0,0,0]),1/vertices.length)
        const right = unit(difference(vertices[0]!,center))
        const up = cross(normal,right)
        const angle = (v:Vector) => Math.atan2(dot(difference(v,center),up),dot(difference(v,center),right))
        faces.set(key,{vertices:vertices.sort((a,b)=>angle(a)-angle(b)),normal,center})
      }
    }
  }
  return [...faces.values()]
}

const signs = [-1,1]
const phi = (1+Math.sqrt(5))/2
const cube = signs.flatMap(x=>signs.flatMap(y=>signs.map((z):Vector=>[x,y,z])))
const icosahedron = signs.flatMap(a=>signs.flatMap((b):Vector[]=>[[0,a,b*phi],[b*phi,0,a],[a,b*phi,0]]))
const octahedron = signs.flatMap((a):Vector[]=>[[a,0,0],[0,a,0],[0,0,a]])
const ring = (count:number,z:number,offset=0):Vector[] => Array.from({length:count},(_,i)=>{
  const angle=(i+offset)*Math.PI*2/count
  return [Math.cos(angle),Math.sin(angle),z]
})
const dual = (points:Vector[])=>hull(points).map(({normal,center})=>scale(normal,1/dot(normal,center)))
const polyhedra = new Map<number, Face[]>()

export function dieFaces(sides:number) {
  const shape = [4,6,8,10,12,20].includes(sides) ? sides : 2
  const cached=polyhedra.get(shape)
  if (cached) return cached
  const points = shape===4 ? cube.filter(([x,y,z])=>x*y*z===1)
    : shape===6 ? cube
    : shape===8 ? octahedron
    : shape===10 ? dual([...ring(5,.42),...ring(5,-.42,.5)])
    : shape===12 ? dual(icosahedron)
    : shape===20 ? icosahedron
    : [...ring(12,.16),...ring(12,-.16)]
  const radius=Math.max(...points.map(point=>Math.hypot(...point)))
  const faces=hull(points.map(point=>scale(point,1/radius)))
  // The two large faces of the generic shape hold the numeric result.
  if (shape===2) faces.sort((a,b)=>b.vertices.length-a.vertices.length)
  polyhedra.set(shape,faces)
  return faces
}

export function drawDie(context:CanvasRenderingContext2D,die:VisualDie,x:number,y:number,radius:number,progress:number,index:number) {
  const faces=dieFaces(die.sides)
  const standard=die.sides===2 || faces.length===die.sides
  const resultIndex=standard ? die.value-1 : 0
  const normal=faces[resultIndex]!.normal
  const right=unit(cross(Math.abs(normal[1])>.95?[1,0,0]:[0,1,0],normal))
  const up=cross(normal,right)
  const spin=(1-progress)**2*Math.PI*2
  // Keep the octahedron slightly tilted so the result and its neighboring faces stay visible.
  const octahedral=die.sides===8
  const a=spin*(1.24+index%3)+(octahedral ? .42 : 0)
  const b=spin*(1.72+index%2)+(octahedral ? .24 : 0)
  const depth=octahedral ? .3 : .18
  const ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b)
  const rotate=(v:Vector):Vector=>{
    const px=dot(right,v),py=dot(up,v),pz=dot(normal,v)
    const py2=py*ca-pz*sa,pz2=py*sa+pz*ca
    return [px*cb+pz2*sb,py2,pz2*cb-px*sb]
  }
  const perspective=([px,py,pz]:Vector)=>[x+px*radius/(1-pz*depth),y-py*radius/(1-pz*depth)] as const
  for (const [faceIndex,face] of faces.entries()) {
    const [nx,ny,nz]=rotate(face.normal)
    if (nz<=(octahedral ? depth*dot(face.normal,face.center) : .04)) continue
    const points=face.vertices.map(vertex=>perspective(rotate(vertex)))
    context.beginPath()
    for (const [pointIndex,[sx,sy]] of points.entries()) {
      if (pointIndex===0) context.moveTo(sx,sy)
      else context.lineTo(sx,sy)
    }
    context.closePath()
    const light=Math.round(28+23*Math.max(0,.16*nx+.37*ny+.76*nz))
    context.fillStyle=`hsl(${245+index%5*9} 58% ${light}%)`
    context.strokeStyle='#e5cbfa'
    context.lineWidth=.9
    context.fill()
    context.stroke()
    const label=standard ? faceIndex+1 : faceIndex<2 ? die.value : null
    if (label===null || nz<.38 || (progress===1 && faceIndex!==resultIndex)) continue
    const [tx,ty]=perspective(rotate(face.center))
    context.fillStyle='#fff5ff'
    context.font=`700 ${Math.max(8,radius*(label>=100?.54:.68)*Math.sqrt(nz))}px system-ui`
    context.textAlign='center'
    context.textBaseline='middle'
    context.fillText(String(label),tx,ty)
  }
}
