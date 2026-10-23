import '../global.css';

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en">
      <body className="flex flex-col min-h-screen">{children}</body>
    </html>
  );
}
