# Contributing to UMBRAL

Thank you for your interest in improving **UMBRAL**! Whether you are fixing a typo, improving documentation, refining UI accessibility, or hardening Worker security, contributions from developers of all experience levels are welcome.

---

## 1. Local Setup

```bash
pnpm install
cp .dev.vars.example .dev.vars
pnpm db:migrate:local
pnpm db:seed:local
pnpm build
pnpm dev:worker
```

To test the isolated Demo Mode locally:
```bash
pnpm dev:demo
```

---

## 2. Architectural Conventions

Before adding new code, read [ARCHITECTURE.md](./ARCHITECTURE.md) to place each file in its proper layer:

* **Backend (`worker/`):**
  * `routes/` — Thin HTTP controllers only (no raw SQL or heavy business rules).
  * `services/` — Domain logic, deduplication, alerting, and diagnostics.
  * `repositories/` — Parameterized D1 SQL queries (`?` bindings only — never string interpolation).
  * `security/` & `middlewares/` — Authentication, crypto, rate-limiting, CSP headers, and replay guards.
  * `validators/` — Strict input sanitization and anti-Prototype Pollution.
* **Frontend (`src/`):**
  * `services/` — HTTP client calls.
  * `hooks/` — Stateful data fetching, keyboard shortcuts, and theme persistence.
  * `components/` — Organized by feature domain (`brand`, `ui`, `layout`, `overview`, `incidents`, `perimeter`, `telemetry`, `modals`, `demo`).

---

## 3. Security & Privacy Checklist (Mandatory)

> [!CAUTION]
> Pull Requests that include real personal domains, API tokens, `.dev.vars`, or weaken authentication/SSRF controls will be rejected.

Before opening a Pull Request, verify:

1. `pnpm typecheck` passes with zero errors across both `tsconfig.worker.json` and `tsconfig.web.json`.
2. `pnpm build` completes cleanly.
3. No personal domains, tokens, or credentials appear in tracked files (`git status` & `git diff`).
4. Any new UI metric or badge is documented in `src/constants/glossary.ts`.
