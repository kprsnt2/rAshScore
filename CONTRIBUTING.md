# Contributing to rAsh Score

Thank you for your interest in contributing! Here's how to get started.

## Development Setup

1. **Fork & Clone**
   ```bash
   git clone https://github.com/YOUR_USERNAME/BrandScore.git
   cd BrandScore
   npm install
   ```

2. **Environment Variables**
   ```bash
   cp .env.example .env.local
   ```
   Add your API keys:
   - `NVIDIA_API_KEY` — from [build.nvidia.com](https://build.nvidia.com)
   - `GROQ_API_KEY` — from [console.groq.com](https://console.groq.com)

3. **Run Dev Server**
   ```bash
   npm run dev
   ```

## Branch Strategy

- `main` — production (auto-deploys to Vercel)
- Feature branches: `feat/description`
- Bug fixes: `fix/description`

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: Add anomaly detection to intelligence page
fix: Correct score calculation for edge case
refactor: Extract shared utilities to lib/ui-utils
docs: Update architecture diagrams
chore: Remove unused dependencies
```

## Code Quality

Before submitting a PR:

```bash
npm run lint          # ESLint
npm run typecheck     # TypeScript
npm test              # Jest
npm run build         # Ensure production build works
```

## Architecture Notes

- **Frontend reads** the SQLite DB via `sql.js` (WASM) — no write operations in API routes
- **Pipeline writes** use `better-sqlite3` (Node.js native) — runs only in GitHub Actions
- **Shared utilities** live in `src/lib/ui-utils.ts` and `src/lib/types.ts`
- **Charts are custom SVG** — no charting libraries. Keep it that way for portfolio value
- See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for full system diagrams

## Adding a New Industry

1. Add the industry definition in `src/lib/industry-data.ts`
2. Add brands to the pipeline config in `scripts/run-pipeline.ts`
3. Run the pipeline manually to generate initial data
4. The dashboard and intelligence pages auto-discover new industries

## Adding a New API Endpoint

1. Create route in `src/app/api/<endpoint>/route.ts`
2. Follow existing patterns (see `src/app/api/brands/route.ts`)
3. Use the `getDb()` singleton from `src/lib/db.ts`
4. Add ISR caching: `export const revalidate = 3600;`
5. Document in `docs/` and update `README.md`

## Questions?

Open an issue or reach out to [@kprsnt2](https://twitter.com/kprsnt2).
