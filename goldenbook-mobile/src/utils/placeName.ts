// Place names arrive in mixed case: most were entered in capitals, the style
// of the printed guide ("PALÁCIO DA BOLSA"), and a minority in title case
// ("Garcia de Orta Garden"). Display them all the same way. Capitals keep
// acronyms and brand spellings intact, which title-casing would not.
//
// Only for display; never feed the result back to the API or into share text.

export function displayPlaceName(name: string | null | undefined): string {
  return (name ?? '').trim().toLocaleUpperCase('pt-PT');
}
