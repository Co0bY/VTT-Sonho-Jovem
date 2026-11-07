import { test } from 'node:test'
import assert from 'node:assert/strict'
import { tokenBounds, hexGridSegments, hexPosition, imagePoint, imageContains, resizeImage, toWorld, zoomAt, tokenPosition, distance } from '../src/tabletop/geometry.ts'
test('zoom preserves world point beneath cursor and clamps zoom', () => {
  const camera = {x:100,y:-50,scale:0.8}, cursor={x:333,y:222}
  const before = toWorld(cursor,camera)
  for (const scale of [0.01,0.5,1,100]) {
    const next = zoomAt(camera,cursor,scale)
    const after = toWorld(cursor,next)
    assert.ok(Math.abs(before.x-after.x)<0.00001)
    assert.ok(Math.abs(before.y-after.y)<0.00001)
    assert.ok(next.scale>=0.02&&next.scale<=2.5)
  }
})
test('tokens snap to cell center and stay within scene borders', () => {
  assert.deepEqual(tokenPosition({x:130,y:200},64,true,3200,2200),{x:160,y:224})
  assert.deepEqual(tokenPosition({x:-50,y:9999},64,true,3200,2200),{x:32,y:2168})
  assert.deepEqual(tokenPosition({x:130,y:200},64,false,3200,2200),{x:130,y:200})
})
test('ruler measures Euclidean distance using 1.5 m per cell', () => {
  assert.equal(distance({x:0,y:0},{x:192,y:256},64),7.5)
  assert.equal(distance({x:32,y:32},{x:32,y:32},64),0)
})

test('ruler uses configurable distance per cell without changing its unit', () => {
  assert.equal(distance({x:0,y:0},{x:64,y:0},64,5),5)
  assert.equal(distance({x:0,y:0},{x:192,y:256},64,100),500)
  assert.equal(distance({x:0,y:0},{x:64,y:0},64,0.01),0.01)
})

test('rotated images use their actual shape for selection',()=>{
  const rect={x:100,y:100,width:200,height:40,rotation:90}
  assert.equal(imageContains(rect,{x:200,y:200}),true)
  assert.equal(imageContains(rect,{x:110,y:110}),false)
})
test('corner resize keeps opposite corner fixed even with rotation',()=>{
  for(const rotation of [0,45,90,270])for(let corner=0;corner<4;corner++){
    const rect={x:200,y:200,width:160,height:80,rotation}
    const sx=corner===0||corner===3?-1:1,sy=corner<2?-1:1
    const fixed=imagePoint(rect,sx<0?rect.width:0,sy<0?rect.height:0)
    const target=imagePoint(rect,sx<0?-40:rect.width+40,sy<0?-20:rect.height+20)
    const next=resizeImage(rect,target,corner)
    const after=imagePoint(next,sx<0?next.width:0,sy<0?next.height:0)
    assert.ok(Math.hypot(fixed.x-after.x,fixed.y-after.y)<1e-8)
    assert.ok(Math.abs(next.width-200)<1e-8)
    assert.ok(Math.abs(next.height-100)<1e-8)
  }
})

test('proportional resizing snaps the longest side to the grid without distortion',()=>{
  for(const rect of [{x:500,y:500,width:160,height:80},{x:500,y:500,width:80,height:160}]){
    for(const rotation of [0,45,90])for(let corner=0;corner<4;corner++){
      const r={...rect,rotation},sx=corner===0||corner===3?-1:1,sy=corner<2?-1:1
      const point=imagePoint(r,sx<0?-63:r.width+63,sy<0?-17:r.height+17)
      const next=resizeImage(r,point,corner,{cell:64})
      assert.ok(Math.abs(next.width/next.height-r.width/r.height)<1e-8)
      assert.equal(Math.max(next.width,next.height)%64,0)
      const a=imagePoint(r,sx<0?r.width:0,sy<0?r.height:0)
      const b=imagePoint(next,sx<0?next.width:0,sy<0?next.height:0)
      assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<1e-8)
    }
  }
})
test('free resizing changes aspect ratio and bypasses grid steps',()=>{
  const next=resizeImage({x:100,y:100,width:160,height:80},{x:301,y:217},2,{proportional:false,cell:64})
  assert.equal(next.width,201);assert.equal(next.height,117)
})
test('proportional resizing keeps both sides at least eight pixels',()=>{
  const next=resizeImage({x:100,y:100,width:800,height:8},{x:100,y:100},2,{cell:64})
  assert.ok(next.width>=8&&next.height>=8)
  assert.equal(next.width/next.height,100)
})

test('hex snap uses hex centers and stays on the same center after rounding',()=>{
  for(const point of [{x:32,y:37},{x:65,y:92},{x:9999,y:9999},{x:-400,y:-200}]){
    const center=hexPosition(point,64,512,384)
    assert.ok(center.x>=32&&center.x<=480&&center.y>=32&&center.y<=352)
    assert.deepEqual(tokenPosition(point,64,true,512,384,'hex'),center)
    const again=hexPosition({x:Math.round(center.x),y:Math.round(center.y)},64,512,384)
    assert.deepEqual(again,center)
  }
  assert.deepEqual(hexPosition({x:64,y:92},64,512,384),{x:64,y:64/Math.sqrt(3)+64/Math.sqrt(3)*1.5})
})
test('no grid bypasses snap while respecting scene borders',()=>{
  assert.deepEqual(tokenPosition({x:99,y:123},64,true,512,384,'none'),{x:99,y:123})
})
test('hex grid edges have equal lengths and are not drawn twice',()=>{
  const lines=hexGridSegments(64,512,384),keys=new Set()
  for(const [a,b] of lines){
    assert.ok(Math.abs(Math.hypot(a.x-b.x,a.y-b.y)-64/Math.sqrt(3))<1e-8)
    const key=[a,b].map(p=>`${Math.round(p.x*1e6)},${Math.round(p.y*1e6)}`).sort().join('|')
    assert.ok(!keys.has(key));keys.add(key)
  }
  assert.ok(lines.length>0)
  assert.ok(hexGridSegments(64,16384,16384,{left:100,top:100,right:600,bottom:600}).length<1000)
})

test('token bounds preserve the image aspect until an explicit drag size is saved',()=>{
  assert.deepEqual(tokenBounds({x:100,y:100,width:null,height:null},100,{width:40,height:80}),{x:80,y:60,width:40,height:80,rotation:0})
  assert.deepEqual(tokenBounds({x:100,y:100,width:120,height:60},100,{width:40,height:80}),{x:40,y:70,width:120,height:60,rotation:0})
})
test('resized tokens stay completely inside the scene during movement',()=>{
  for(const grid of ['square','hex','none']){
    const point=tokenPosition({x:-100,y:9999},64,true,512,384,grid,{width:200,height:100})
    assert.ok(point.x>=100&&point.x<=412&&point.y>=50&&point.y<=334)
  }
})

test('token bounds preserve rotation for handles, hit testing and corner resizing',()=>{
  const bounds=tokenBounds({x:200,y:200,width:120,height:40,rotation:90},64)
  assert.equal(bounds.rotation,90)
  assert.equal(imageContains(bounds,{x:200,y:250}),true)
  assert.equal(imageContains(bounds,{x:250,y:200}),false)
  const fixed=imagePoint(bounds,0,0),point=imagePoint(bounds,160,80)
  const next=resizeImage(bounds,point,2,{proportional:false})
  const after=imagePoint(next,0,0)
  assert.equal(next.rotation,90)
  assert.ok(Math.hypot(after.x-fixed.x,after.y-fixed.y)<1e-8)
})
