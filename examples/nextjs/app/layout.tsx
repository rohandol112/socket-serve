export const metadata = {
  title: 'socket-serve Next.js Example',
  description: 'Demo of socket-serve with Next.js App Router',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
