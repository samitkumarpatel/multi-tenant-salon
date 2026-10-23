# .

This is a Next.js application generated with
[Create Fumadocs](https://github.com/fuma-nama/fumadocs).

Run development server:

```bash
npm run dev
# or
pnpm dev
# or
yarn dev
```

Open http://localhost:3000 with your browser to see the result.

## Explore

In the project, you can see:

- `lib/source.ts`: Code for content source adapter, [`loader()`](https://fumadocs.dev/docs/headless/source-api) provides the interface to access your content.
- `lib/layout.shared.tsx`: Shared options for layouts, optional but preferred to keep.

| Route                     | Description                                            |
| ------------------------- | ------------------------------------------------------ |
| `app/(home)`              | The route group for your landing page and other pages. |
| `app/docs`                | The documentation layout and pages.                    |
| `app/api/search/route.ts` | The Route Handler for search.                          |

### Fumadocs MDX

Collections are defined with the [Macro API](https://fumadocs.dev/docs/mdx/macro) in `lib/source.ts`.

Read the [Introduction](https://fumadocs.dev/docs/mdx) for further details.

## Learn More

To learn more about Next.js and Fumadocs, take a look at the following
resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js
  features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
- [Fumadocs](https://fumadocs.dev) - learn about Fumadocs

## Languages

Guides live at `/<lang>/docs/…` in the same languages as the apps (`en`, `da`, `sv`, `nb`, `fr`, `de`).
Only the languages listed in `lib/i18n.ts` are built; the others are redirected to English in
`public/_redirects`.

- **Translate a page:** add `page.<lang>.mdx` next to `page.mdx` (and `meta.<lang>.json` for a section
  title). Link other guides as `/<lang>/docs/…`. A page without a translation shows the English one.
- **Add a language:** add its code to `lib/i18n.ts` (plus its UI strings in `i18nUI`), to
  `SITE_LANGUAGES` in `app/(root)/page.tsx`, and remove its line from `public/_redirects`.
- **Keep UI labels as the app shows them:** use the app's own translation from
  `frontend/packages/i18n/src/messages.ts`; a label the app doesn't translate stays in English.
