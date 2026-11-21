import assert from 'node:assert/strict'
import test from 'node:test'
import { macroMessage, macroText, parseMacros, MAX_CHOICE_DEPTH } from '../src/tabletop/sheet-macros.ts'

const fields = [
  { id: 'source', reference: 'ataque', label: 'Ataque' },
  { id: 'amount', reference: 'poder', label: 'Poder' },
]

test('sincroniza a quantidade de outro input e resolve seu valor ao executar', () => {
  const text = 'quando ataque clique rolar d8 de poder maior, 2d6 combinar somar'
  const rules = parseMacros(text, fields)
  assert.equal(macroText(rules, fields), text)
  assert.equal(rules[0].action.groups[0].countFieldId, 'amount')
  assert.deepEqual(macroMessage(rules[0].action, '1', id => id === 'amount' ? '4' : undefined), {
    content: '/roll 4d8, 2d6',
    dice: {
      groups: [{ count: 4, sides: 8, reduction: 'maior' }, { count: 2, sides: 6, reduction: 'somar' }],
      combine: 'somar',
    },
  })
  assert.throws(() => macroMessage(rules[0].action, '1', () => '0'), /1 a 50/)
  assert.throws(() => parseMacros(text.replace('de poder', 'de ataque'), fields), /outro campo/)
})

test('reconstrói cinco seletores do texto e mantém ramos independentes', () => {
  const chain = count => count === 0 ? 'rolar d8 de poder' : {
    label: `Nível ${count}`, options: [
      { label: 'Avançar', action: chain(count - 1) },
      { label: 'Encerrar', action: 'chat "Encerrado"' },
    ],
  }
  const script = depth => `quando ataque clique escolher ${JSON.stringify(chain(depth))}`
  const rules = parseMacros(script(5), fields)
  assert.equal(macroText(rules, fields), script(5))
  const edited = parseMacros(script(5).replaceAll('Encerrado', 'Alternativa'), fields)
  assert.deepEqual(macroMessage(edited[0].action.options[1].action, '1'), { content: 'Alternativa', literal: true })
  let leaf = edited[0].action
  for (let depth = 0; depth < 5; depth++) leaf = leaf.options[0].action
  assert.equal(macroMessage(leaf, '1', () => '3').content, '/roll 3d8')
  assert.throws(() => parseMacros(script(MAX_CHOICE_DEPTH + 1), fields), /16 seletores/)
})
