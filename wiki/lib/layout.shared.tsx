import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { appName, docsRoute, gitConfig } from './shared';

const SITE_TITLES: Partial<Record<string, string>> = { da: 'Salon SaaS Hjælpecenter' };

export function baseOptions(lang: string): BaseLayoutProps {
  return {
    nav: {
      title: SITE_TITLES[lang] ?? appName,
      url: `/${lang}${docsRoute}`,
    },
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}
