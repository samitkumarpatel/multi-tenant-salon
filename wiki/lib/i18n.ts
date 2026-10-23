import { defineI18n } from 'fumadocs-core/i18n';
import { defineI18nUI } from 'fumadocs-ui/i18n';

/**
 * Languages that have translated guides, using the same codes as the apps (@salon/i18n).
 * A page without a translation falls back to English. When you add a language here, also
 * add it to SITE_LANGUAGES in app/(root)/page.tsx and drop its line from public/_redirects.
 */
export const i18n = defineI18n({
  languages: ['en', 'da'],
  defaultLanguage: 'en',
  parser: 'dot',
  hideLocale: 'never',
});

export type Lang = (typeof i18n.languages)[number];

export const i18nUI = defineI18nUI(i18n, {
  en: {
    displayName: 'English',
  },
  da: {
    displayName: 'Dansk',
    'Search(search trigger)': 'Søg',
    'Search(search dialog)': 'Søg',
    'Open Search(search trigger)(aria-label)': 'Åbn søgning',
    'Close Search(search dialog)(aria-label)': 'Luk søgning',
    'No results found(search dialog)': 'Ingen resultater',
    'Search failed(search dialog)': 'Søgningen mislykkedes',
    'Search failed, showing results for {query}(search dialog)': 'Søgningen mislykkedes, viser resultater for {query}',
    'On this page(table of contents)': 'På denne side',
    'No Headings(table of contents)': 'Ingen overskrifter',
    'Table of Contents(inline table of contents)': 'Indhold',
    'Next Page(pagination)': 'Næste side',
    'Previous Page(pagination)': 'Forrige side',
    'Last updated on(page footer)': 'Sidst opdateret',
    'Edit on GitHub(edit page)': 'Rediger på GitHub',
    'Choose a language(language switcher)': 'Vælg sprog',
    'Choose a language(language switcher)(aria-label)': 'Vælg sprog',
    'Language(language switcher)': 'Sprog',
    'Theme(site menu)': 'Tema',
    'Toggle Theme(theme switcher)(aria-label)': 'Skift tema',
    'Light(theme switcher)(aria-label)': 'Lyst',
    'Dark(theme switcher)(aria-label)': 'Mørkt',
    'System(theme switcher)(aria-label)': 'System',
    'Open Sidebar(aria-label)': 'Åbn sidepanel',
    'Close Sidebar(aria-label)': 'Luk sidepanel',
    'Open Sidebar(sidebar)(aria-label)': 'Åbn sidepanel',
    'Close Sidebar(sidebar)(aria-label)': 'Luk sidepanel',
    'Collapse Sidebar(sidebar)(aria-label)': 'Skjul sidepanel',
    'Hide Sidebar(sidebar)': 'Skjul sidepanel',
    'Show Sidebar(sidebar)': 'Vis sidepanel',
    'Toggle Menu(home layout header)(aria-label)': 'Vis/skjul menu',
    'Copy Markdown(page actions)': 'Kopier som Markdown',
    'Copied Markdown(page actions)': 'Markdown kopieret',
    'View as Markdown(page actions)': 'Vis som Markdown',
    'Open(page actions)': 'Åbn',
    'Copy Text(code block)(aria-label)': 'Kopier tekst',
    'Copied Text(code block)(aria-label)': 'Tekst kopieret',
    'Copy Anchor Link(heading anchor)(aria-label)': 'Kopier link til afsnit',
    'Copied Anchor Link(heading anchor)(aria-label)': 'Link kopieret',
    'Page Not Found(404 not found page)': 'Siden blev ikke fundet',
    'The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.(404 not found page)':
      'Siden, du leder efter, er måske fjernet, har skiftet navn eller er midlertidigt utilgængelig.',
    'Back to Home(404 not found page)': 'Til forsiden',
  },
});
