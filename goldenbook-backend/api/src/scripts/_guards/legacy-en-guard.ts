// Shared runtime guard for operator-run scripts that pre-date the
// canonical-locale switch (EN → PT). Refuses to run unless the operator
// explicitly opts in with `--allow-legacy-en`. The intent is to make
// "writing EN as if it were canonical" an active, deliberate choice.
//
// Usage at the top of any legacy script:
//
//   import { assertLegacyEnAllowed } from './_guards/legacy-en-guard'
//   assertLegacyEnAllowed('generate-editorial-notes')
//
// The guard reads `process.argv` directly so it works regardless of the
// caller's argument-parsing library. It does not attempt to run any work
// before the opt-in flag is verified — the process exits with code 2.

const FLAG = '--allow-legacy-en'

const BANNER = `
[legacy-en guard] This script writes \`place_translations.locale = 'en'\`
as if English were the canonical editorial locale. Portuguese is canonical
since the dashboard switch — see modules/admin/places/translation-policy.ts.

Re-run with \`${FLAG}\` if you understand and intend this behavior, e.g.:

    tsx src/scripts/<scriptName>.ts ${FLAG}

Without the flag, this process is a no-op (exit code 2).
`.trim()

export function assertLegacyEnAllowed(scriptName: string): void {
  if (process.argv.includes(FLAG)) {
    console.warn(`[legacy-en guard] ${scriptName}: ${FLAG} present — proceeding with EN-canonical writes.`)
    return
  }
  console.error(`[legacy-en guard] ${scriptName} blocked.`)
  console.error(BANNER)
  process.exit(2)
}
