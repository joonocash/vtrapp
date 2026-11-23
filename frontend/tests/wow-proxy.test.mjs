// Tester för WoW-fliken i backend. Kör: node frontend/tests/wow-proxy.test.mjs
import assert from 'node:assert/strict'
import { lasEnv } from '../../backend/src/routes/wow.js'

let passed = 0
const test = (name, fn) => {
  fn()
  passed++
  console.log('ok  ' + name)
}

test('läser WoW-assistentens .env', () => {
  const env = lasEnv([
    '# kommentar',
    'NOTIFY_TOKEN=abc123',
    'WEB_PORT = 8081',
    'API_TOKEN="med citat"',
    "GROQ_API_KEY='gsk_x'",
    'DISCORD_TOKEN=xyz # kommentar efter',
    'tom rad utan likamed',
    '',
  ].join('\n'))
  assert.equal(env.NOTIFY_TOKEN, 'abc123')
  assert.equal(env.WEB_PORT, '8081')
  assert.equal(env.API_TOKEN, 'med citat')
  assert.equal(env.GROQ_API_KEY, 'gsk_x')
  assert.equal(env.DISCORD_TOKEN, 'xyz')
  assert.equal(Object.keys(env).length, 5)
})

test('klarar Windows-radslut', () => {
  assert.deepEqual(lasEnv('A=1\r\nB=2\r\n'), { A: '1', B: '2' })
})

console.log(`\n${passed} tester ok`)
