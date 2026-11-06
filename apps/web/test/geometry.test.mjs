import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toWorld, zoomAt, tokenPosition, distance } from '../src/tabletop/geometry.ts'
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
