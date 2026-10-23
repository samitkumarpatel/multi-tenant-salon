import { redirect } from 'next/navigation';
import { docsRoute } from '@/lib/shared';

// The site opens straight on the guides. On Cloudflare Pages `public/_redirects`
// answers `/` with a real 301; this covers `next dev` and the exported index.html.
export default function HomePage() {
  redirect(docsRoute);
}
