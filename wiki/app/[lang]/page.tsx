import { redirect } from 'next/navigation';
import { docsRoute } from '@/lib/shared';

// /<lang> opens straight on that language's guides.
export default async function LanguageHome({ params }: PageProps<'/[lang]'>) {
  const { lang } = await params;
  redirect(`/${lang}${docsRoute}`);
}
