import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { appName, developerRoute, docsRoute, gitConfig } from './shared';

const SITE_TITLES: Partial<Record<string, string>> = { da: 'Salon SaaS Hjælpecenter' };
export const DEVELOPER_LABEL: Record<string, string> = { en: 'Developer', da: 'Udvikler' };

export function baseOptions(lang: string): BaseLayoutProps {
  return {
    nav: {
      title: SITE_TITLES[lang] ?? appName,
      url: `/${lang}${docsRoute}`,
    },
    links: [{ text: DEVELOPER_LABEL[lang] ?? DEVELOPER_LABEL.en, url: `/${lang}${developerRoute}` }],
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}
