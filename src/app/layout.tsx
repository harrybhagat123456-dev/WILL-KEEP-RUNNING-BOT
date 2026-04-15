import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Keep-Alive Ping Bot",
  description: "Keeps your services alive with regular pings",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#0f172a", color: "#f1f5f9" }}>
        {children}
      </body>
    </html>
  );
}
