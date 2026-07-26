# Gharnish Studio (inside gharnish-site)

AI furniture production, built natively into this site — static page + Cloudflare
Pages Functions, same pattern as the rest of the app.

## Files
- `site/studio.html` — the Studio app (Dashboard → Upload → Details → Reference
  Lock → Produce → Results → Publish). Vanilla HTML/JS, Supabase-JS from CDN,
  same login as manager.html.
- `functions/studio/generate.js` — `POST /studio/generate`. Generates one view
  with OpenAI gpt-image-1, anchored to the locked reference photo (image-first),
  enforces the studio rules (white bg, centered, 12–15% margin, 1:1), uploads to
  the `studio-outputs` bucket, records it. Auth: Supabase token, like `/ai/*`.
- `functions/studio/publish.js` — `POST /studio/publish`. Upserts the finished
  product into `gharnish_products` (the catalog integration).

## Required Cloudflare env (Pages → Settings → Variables and secrets)
- `OPENAI_API_KEY` (secret) — OpenAI key with gpt-image-1 access
- `SUPABASE_SERVICE_ROLE_KEY` (secret) — for storage upload + catalog writes
- (`ANTHROPIC_API_KEY` is already set for the existing `/ai/*` functions)

## Supabase (already applied to the Gharnish App project)
Tables `studio_projects`, `studio_generated_images`, `studio_prompt_templates`
and buckets `studio-uploads`, `studio-outputs`. Migration SQL is in the Studio
prototype repo; nothing else in this site's DB usage changes.

Open at `/studio.html`.
