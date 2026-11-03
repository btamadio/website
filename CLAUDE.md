# brianamadio.com

Astro static site (Cloudflare Pages). Content is Markdown; avoid touching components.

- New blog post: add `src/content/blog/<slug>.md` (title, description, pubDate).
- New project: add `src/content/projects/<slug>.md` (see schema in `src/content.config.ts`). Each project page needs: problem, architecture diagram, demo or replayable trace, eval numbers, tradeoffs/failures, repo + blog links.
- Every public demo: server-side keys, per-IP rate limit, hard spend cap, replayed runs by default.
- Check: `npm run build` must pass.

## Agent skills

### Issue tracker

GitHub Issues on btamadio/website (`gh` CLI; needs `GH_TOKEN` from `.env`). See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `GLOSSARY.md` + `docs/adr/`. See `docs/agents/domain.md`.
