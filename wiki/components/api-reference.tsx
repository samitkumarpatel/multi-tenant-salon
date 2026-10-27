'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';

// Pinned, with the same integrity hashes as oas/index.html.
const SWAGGER_VERSION = '5.4.2';
const CDN = `https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/${SWAGGER_VERSION}`;

declare global {
  interface Window {
    SwaggerUIBundle?: (config: Record<string, unknown>) => unknown;
  }
}

/** Read-only API reference: renders the generated spec and never lets a visitor send requests from the page. */
export function ApiReference({ specUrl }: { specUrl: string }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!ready || !window.SwaggerUIBundle) return;
    window.SwaggerUIBundle({
      url: specUrl,
      dom_id: '#api-reference',
      deepLinking: true,
      docExpansion: 'list',
      defaultModelsExpandDepth: -1,
      supportedSubmitMethods: [],
    });
  }, [ready, specUrl]);

  return (
    <>
      <link rel="stylesheet" href={`${CDN}/swagger-ui.css`}
        integrity="sha512-9ZJfeEZ6DAr3pstOThylJAyPbhr+BXMiyPsiCWmozVeJrcInppRXLZ9sUOL64n7H7DHsdDlSCRI3qk5/clvnXA=="
        crossOrigin="anonymous" referrerPolicy="no-referrer" />
      <Script src={`${CDN}/swagger-ui-bundle.js`} strategy="afterInteractive" crossOrigin="anonymous"
        integrity="sha512-l5/LYUvqCJKr9NblefbJPkYEpD3yUiOOXiLUKlibcIbVynsY3UopPYBr0xisoV8By8MulIth7yTLc+KOVt6YeQ=="
        onReady={() => setReady(true)} />
      {/* Swagger UI has no dark theme; keep it on a white card in either site theme. */}
      <div id="api-reference" className="rounded-xl bg-white p-2 text-slate-900" />
      <noscript><p>JavaScript is required to browse the API reference.</p></noscript>
    </>
  );
}
