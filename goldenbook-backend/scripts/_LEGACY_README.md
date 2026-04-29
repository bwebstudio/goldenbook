# Legacy operator scripts

Most files in this directory pre-date the canonical-locale switch
(EN → PT). They were one-shot operations to bulk-import editorial copy
or repair specific data anomalies, and several of them write
`place_translations.locale = 'en'` as if English were the canonical row.

**Do not run these scripts in production without reading them first.**

The canonical contract is now defined in
[`../api/src/modules/admin/places/translation-policy.ts`](../api/src/modules/admin/places/translation-policy.ts):

- `place_translations.locale = 'pt'` is the editorial source-of-truth.
- EN and ES are auto-translated from PT via the dashboard's **Regenerate
  translations from Portuguese** button or the
  `/admin/places/:id/translations/regenerate` endpoint.
- Manual EN/ES overrides are protected by `translation_override = true`.

For ongoing editorial work, **use the dashboard place editor** at
`/places/:slug` — it goes through the safe save path
(`updatePlace` in `admin-places.query.ts`).

If you genuinely need to bulk-import EN editorial as a one-off (e.g. a
migration from a pre-existing English-language CMS), copy the script you
need into a feature branch, audit it for the new contract, and consider
calling `assertLegacyEnAllowed()` from
`../api/src/scripts/_guards/legacy-en-guard.ts` to make the EN-canonical
intent explicit.

The actively-maintained guarded counterparts live under
[`../api/src/scripts/`](../api/src/scripts/). Two of them
(`generate-editorial-notes.ts`, `enrich-new-places.ts`) are already
guarded behind `--allow-legacy-en`.

| File | Status |
|---|---|
| `apply-*.ts`, `audit-*.ts`, `backfill-*.ts` | Legacy. Touch only if you've verified the new contract. |
| `import-portuguese-editorial.ts` | Writes PT — likely safe but verify. |
| `import-spanish-editorial.ts`, `import-editorial-*.ts` | Writes EN/ES — legacy. |
| `fix-*.ts` | Targeted repair scripts. Likely one-shots already executed. |
| `*.sql` | Hand-written SQL fixes. Read before applying. |
