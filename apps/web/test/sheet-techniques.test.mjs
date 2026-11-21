import assert from 'node:assert/strict'
import test from 'node:test'
import { techniqueAttack, techniqueCost, techniqueDamage } from '../src/tabletop/sheet-techniques.ts'

test('calcula o custo máximo de 4 por nível, com níveis entre 1 e 20', () => {
  assert.equal(techniqueCost('1'), 4)
  assert.equal(techniqueCost('20'), 80)
  for (const level of ['', '0', '1.5', '21']) assert.equal(techniqueCost(level), null)
})

test('o ataque usa o atributo e os dados extras e conta 5 e 6', () => {
  const attack = techniqueAttack('3', '20', 'Descrição da técnica')
  assert.equal(attack.content, 'Descrição da técnica')
  assert.deepEqual(attack.dice.groups, [
    { count: 23, sides: 6, reduction: 'sucesso', success: { min: 5, max: 6 } },
  ])
  assert.equal(techniqueAttack('0', '1', 'Fogo').dice.groups[0].count, 1)
  for (const score of ['', '-1', '3.5', '31']) {
    assert.throws(() => techniqueAttack(score, '20', 'Fogo'), /atributo/)
  }
})

test('o dano usa o dado base, os dados da técnica e os acertos do ataque', () => {
  assert.deepEqual(techniqueDamage('1', 2, 'Dano'), { content: '/roll 2d6+2', caption: 'Dano' })
  assert.equal(techniqueDamage('20', 3, 'Dano').content, '/roll 21d6+3')
  assert.throws(() => techniqueDamage('1', 0, 'Dano'), /acerto/)
})
