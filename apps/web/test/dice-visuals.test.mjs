import assert from 'node:assert/strict'
import test from 'node:test'
import { dieFaces, diceInRoll, drawDie, newDiceBatches } from '../src/tabletop/dice-visuals.ts'

test('preserva cada dado de uma rolagem agrupada e ignora os modificadores', () => {
  assert.deepEqual(diceInRoll({ expression:'2d6+4', rolls:[2,5] }), [
    {sides:6,value:2},{sides:6,value:5},
  ])
  assert.deepEqual(diceInRoll({ groups:[
    { expression:'1d4', rolls:[4] },
    { expression:'2d20', rolls:[2,17] },
  ] }), [{sides:4,value:4},{sides:20,value:2},{sides:20,value:17}])
})

test('mostra somente novas rolagens recebidas depois do histórico inicial', () => {
  const first={id:'1',roll:{expression:'1d6',rolls:[5]}}
  const second={id:'2',roll:null}
  const third={id:'3',roll:{expression:'1d10',rolls:[8]}}
  assert.deepEqual(newDiceBatches(undefined,[first]),[])
  assert.deepEqual(newDiceBatches([first],[first,second,third]),[{id:'3',dice:[{sides:10,value:8}]}])
  assert.deepEqual(newDiceBatches([first,second,third],[second,third]),[])
})

test('usa os sólidos dos dados comuns e termina com a face sorteada', () => {
  const labels=[]
  const canvas={beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},stroke(){},fillText(text){labels.push(text)}}
  for (const sides of [4,6,8,10,12,20]) {
    assert.equal(dieFaces(sides).length,sides)
    drawDie(canvas,{sides,value:sides},0,0,22,1,0)
    assert.deepEqual(labels.splice(0),[String(sides)])
  }
  drawDie(canvas,{sides:1000,value:997},0,0,22,1,0)
  assert.deepEqual(labels,['997'])
})

test('mantém o volume do d8 durante o giro e na pose final', () => {
  const triangles = []
  const labels = []
  const canvas = {
    beginPath() { triangles.push([]) },
    moveTo(x, y) { triangles.at(-1).push([x, y]) },
    lineTo(x, y) { triangles.at(-1).push([x, y]) },
    closePath() {}, fill() {}, stroke() {},
    fillText(text) { labels.push(text) },
  }
  for (const progress of [.5, 1]) {
    triangles.length = 0
    labels.length = 0
    drawDie(canvas, { sides: 8, value: 5 }, 0, 0, 22, progress, 0)
    const areas = triangles.map(([a, b, c]) =>
      Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2,
    ).sort((a, b) => b - a)
    assert.ok(areas[1] > areas[0] / 2, 'A segunda face visível deve ter área suficiente para mostrar o volume.')
  }
  assert.deepEqual(labels, ['5'])
})
