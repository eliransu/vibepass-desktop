## Contributing to cloudpass.dev

Thanks for your interest! We welcome contributions. Please follow the steps below.

### Getting started
- Install Node.js 18+ and npm 9+
- Install dependencies: `npm install`
- Run the app: `npm run dev`

### Commands
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Build: `npm run build`
- Package: `npm run dist` or `npm run dist:mac`

### Coding style
- TypeScript with explicit function signatures on public APIs
- Prefer clear, descriptive names
- Functional declarations (e.g., `export function foo() {}`), no default exports
- Keep components small and focused; handle errors explicitly

### Tests
- If adding core features or security‑sensitive code, include tests or a clear manual test plan.

### Commit and PR tips
- Keep PRs scoped and focused
- Include screenshots for UI changes and a brief test plan
- Ensure CI is green (lint, typecheck, build)

### Security
- Never commit secrets. Use `.env` and `.env.example`
- See `SECURITY.md` for reporting procedures

### License
By contributing, you agree your contributions will be licensed under the ISC License.
