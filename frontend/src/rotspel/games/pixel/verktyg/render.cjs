// Renderar valda Fluent Emoji Flat-ikoner (MIT) till PNG.
const fs = require('fs')
const path = require('path')
const { Resvg } = require('@resvg/resvg-js')
const set = require('@iconify-json/fluent-emoji-flat/icons.json')
const names = process.argv.slice(3)
const out = process.argv[2]
fs.mkdirSync(out, { recursive: true })
const W = set.width || 32, H = set.height || 32
for (const n of names) {
  const ic = set.icons[n]
  if (!ic) { console.error('saknas', n); continue }
  const w = ic.width || W, h = ic.height || H
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${ic.left||0} ${ic.top||0} ${w} ${h}" width="256" height="256">${ic.body}</svg>`
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 256 } }).render().asPng()
  fs.writeFileSync(path.join(out, n + '.png'), png)
}
console.log('klart', names.length)
