// Claves estables para listas de textos sin identificador propio (p. ej. avisos de una importación,
// donde el mismo texto puede repetirse): el propio texto + cuántas veces ha aparecido antes.
export function conClaves(textos: string[]): { clave: string; texto: string }[] {
  const vistos = new Map<string, number>()
  return textos.map((texto) => {
    const n = (vistos.get(texto) ?? 0) + 1
    vistos.set(texto, n)
    return { clave: `${texto}#${n}`, texto }
  })
}
