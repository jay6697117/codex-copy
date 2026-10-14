---
name: cloud-deploy
description: Build verification, environment preflight check, and zero-downtime preview deployment to Vercel, Cloudflare Pages, Netlify, or Render.
---
# Cloud Deploy (`$cloud-deploy`)

## Workflow Instructions
1. **Preflight Audit**: Run `npm run build` and typecheck (`tsc --noEmit`) inside the active worktree to guarantee zero build errors.
2. **Sandbox Approval**: Request explicit user approval before executing network-bound deployment CLI commands (`vercel deploy`, `wrangler pages deploy`).
3. **Smoke Test**: Verify the deployed preview URL HTTP status and attach the live preview link to the thread summary.
