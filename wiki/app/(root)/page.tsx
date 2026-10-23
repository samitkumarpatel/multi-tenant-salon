import { appName, docsRoute } from '@/lib/shared';

// Static hosting can't read Accept-Language, so the browser picks: the first preferred language
// with guides, else English. Keep in step with lib/i18n.ts; Norwegian "no"/"nn" map to "nb".
const SITE_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'da', name: 'Dansk' },
];

const pickLanguage = `(function () {
  var available = ${JSON.stringify(SITE_LANGUAGES.map((l) => l.code))};
  var preferred = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en'];
  var lang = 'en';
  for (var i = 0; i < preferred.length; i++) {
    var code = String(preferred[i]).toLowerCase().split('-')[0];
    if (code === 'no' || code === 'nn') code = 'nb';
    if (available.indexOf(code) !== -1) { lang = code; break; }
  }
  location.replace('/' + lang + '${docsRoute}' + location.hash);
})();`;

export default function Root() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <script dangerouslySetInnerHTML={{ __html: pickLanguage }} />
      <h1 className="text-2xl font-bold">{appName}</h1>
      <ul className="flex gap-4">
        {SITE_LANGUAGES.map((l) => (
          <li key={l.code}>
            <a href={`/${l.code}${docsRoute}`} lang={l.code} className="underline">{l.name}</a>
          </li>
        ))}
      </ul>
    </main>
  );
}
