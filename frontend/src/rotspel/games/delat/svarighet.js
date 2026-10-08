// Som i originalen: var femte bana är svår, var tionde supersvår.
// Eget modul utan React så att motorerna går att testa i Node.
export function svarighet(niva) {
  if (niva >= 10 && niva % 10 === 0) return 'supersvår'
  if (niva >= 5 && niva % 10 === 5) return 'svår'
  return 'normal'
}
