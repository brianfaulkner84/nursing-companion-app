export const metadata = {
  title: "Nursing Companion",
  description: "Practice question companion",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "sans-serif", maxWidth: 480, margin: "0 auto", padding: "1.5rem" }}>
        {children}
      </body>
    </html>
  );
}
