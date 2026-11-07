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
