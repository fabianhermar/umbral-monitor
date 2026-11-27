## Summary / Resumen

<!-- Describe what this PR changes and why. -->

## Verification Checklist

- [ ] `pnpm typecheck` passes with zero errors (`tsconfig.worker.json` & `tsconfig.web.json`).
- [ ] `pnpm build` succeeds cleanly.
- [ ] Zero personal domains, tokens, or `.dev.vars` files are included in this diff.
- [ ] Layer separation respected (`routes` → `services` → `repositories` on backend; `hooks` → domain `components` on frontend).
- [ ] New metrics or statuses (if any) added to `src/constants/glossary.ts`.
