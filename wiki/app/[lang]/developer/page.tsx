import { HomeLayout } from 'fumadocs-ui/layouts/home';
import type { Metadata } from 'next';
import { ApiReference } from '@/components/api-reference';
import { baseOptions } from '@/lib/layout.shared';

const TOKEN_URL = 'https://auth.salonsaas.org/oauth2/token';
const API_URL = 'https://api.salonsaas.org';

const COPY: Record<string, { title: string; intro: string; accessTitle: string; steps: string[]; limits: string; scopesTitle: string }> = {
  en: {
    title: 'Developer',
    intro: 'The REST API behind Salon SaaS: public booking and shop endpoints, the salon owner API and the staff portal. Owner and staff endpoints need a bearer token; platform-management endpoints are not listed.',
    accessTitle: 'Read your salon’s data from your own software',
    steps: [
      'In the salon admin app, open Developer and create an API client. Choose a name and what it may read.',
      'Copy the client id and secret straight away. The secret is shown once; you can rotate it later.',
      'Exchange them for an access token, which lasts 15 minutes, and call the API with it:',
    ],
    limits: 'An API client belongs to one salon and is read-only. It can call only the GET endpoints under /api/salon-admin/{your salon id}/ that its scopes allow; any other salon, endpoint or change is refused with 403. Revoking a client stops new tokens at once; a token already issued stops working within 15 minutes.',
    scopesTitle: 'Scopes',
  },
  da: {
    title: 'Udvikler',
    intro: 'REST-API’et bag Salon SaaS: offentlige endpoints til booking og shop, salonejerens API og personaleportalen. Ejer- og personaleendpoints kræver et bearer-token; endpoints til platformadministration er ikke med her. API-referencen er på engelsk.',
    accessTitle: 'Læs din salons data fra din egen software',
    steps: [
      'Åbn Udvikler i salonens administrationsapp, og opret en API-klient. Vælg et navn og hvad den må læse.',
      'Kopiér klient-id og hemmelighed med det samme. Hemmeligheden vises kun én gang; du kan senere skifte den.',
      'Byt dem til et adgangstoken, der gælder i 15 minutter, og kald API’et med det:',
    ],
    limits: 'En API-klient hører til én salon og kan kun læse. Den kan kun kalde de GET-endpoints under /api/salon-admin/{dit salon-id}/ som dens scopes tillader; alt andet afvises med 403. Hvis du tilbagekalder en klient, udstedes der straks ikke flere tokens; et token, der allerede er udstedt, holder op med at virke inden for 15 minutter.',
    scopesTitle: 'Scopes',
  },
};

const SCOPES: [string, string][] = [
  ['bookings:read', 'GET /booking'],
  ['services:read', 'GET /services'],
  ['staff:read', 'GET /staff, /staff/{id}/availability'],
  ['ratings:read', 'GET /ratings'],
  ['orders:read', 'GET /shop/orders, /shop/products, /shop/inventory'],
  ['customers:read', 'GET /customers (personal data)'],
  ['loyalty:read', 'GET /loyalty, /loyalty/rewards, /loyalty/members, /loyalty/member (personal data)'],
];

const EXAMPLE = `curl -u CLIENT_ID:CLIENT_SECRET \\
  -d grant_type=client_credentials -d scope=services:read \\
  ${TOKEN_URL}

curl -H "Authorization: Bearer ACCESS_TOKEN" \\
  ${API_URL}/api/salon-admin/YOUR_SALON_ID/services`;

export async function generateMetadata({ params }: PageProps<'/[lang]/developer'>): Promise<Metadata> {
  const { lang } = await params;
  return { title: `${(COPY[lang] ?? COPY.en).title} · API reference` };
}

export default async function DeveloperPage({ params }: PageProps<'/[lang]/developer'>) {
  const { lang } = await params;
  const copy = COPY[lang] ?? COPY.en;
  return (
    <HomeLayout {...baseOptions(lang)}>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <h1 className="text-3xl font-bold">{copy.title}</h1>
        <p className="mt-2 mb-8 max-w-3xl text-fd-muted-foreground">{copy.intro}</p>
        <section className="mb-8 max-w-3xl space-y-3">
          <h2 className="text-xl font-semibold">{copy.accessTitle}</h2>
          <ol className="list-decimal space-y-1 pl-5">
            {copy.steps.map((step) => <li key={step}>{step}</li>)}
          </ol>
          <pre className="overflow-x-auto rounded-lg border bg-fd-card p-4 text-xs"><code>{EXAMPLE}</code></pre>
          <p className="text-fd-muted-foreground">{copy.limits}</p>
          <h3 className="pt-2 text-base font-semibold">{copy.scopesTitle}</h3>
          <table className="w-full text-sm">
            <tbody>
              {SCOPES.map(([scope, endpoints]) => (
                <tr key={scope} className="border-b">
                  <td className="py-1.5 pr-4 font-mono text-xs">{scope}</td>
                  <td className="py-1.5 text-fd-muted-foreground">{endpoints}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <ApiReference specUrl="/openapi/OAS.json" />
      </main>
    </HomeLayout>
  );
}
