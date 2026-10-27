import { createGetUrl } from 'fumadocs-core/source';

export const appName = 'Salon SaaS Help Center';
export const docsRoute = '/docs';
export const developerRoute = '/developer';
export const docsImageRoute = '/og/docs';
export const docsContentRoute = '/llms.mdx/docs';

// fill this with your actual GitHub info, for example:
export const gitConfig = {
  user: 'samitkumarpatel',
  repo: 'multi-tenant-salon',
  branch: 'main',
};

const getContentUrl = createGetUrl(docsContentRoute);

export function getPageMarkdownUrl(page: { slugs: string[]; locale?: string }) {
  const segments = [page.locale ?? 'en', ...page.slugs, 'content.md'];

  return { segments, url: getContentUrl(segments) };
}

const getImageUrl = createGetUrl(docsImageRoute);

export function getPageImageUrl(page: { slugs: string[]; locale?: string }) {
  const segments = [page.locale ?? 'en', ...page.slugs, 'image.png'];

  return { segments, url: getImageUrl(segments) };
}
