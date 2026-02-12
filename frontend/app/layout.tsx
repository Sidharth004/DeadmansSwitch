import type { Metadata } from "next";
import "@solana/wallet-adapter-react-ui/styles.css";
import "./globals.css";
import { AppWalletProvider } from "@/components/wallet-provider";

export const metadata: Metadata = {
  title: "Dead Man's Switch",
  description: "Trustless crypto inheritance on Solana",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppWalletProvider>{children}</AppWalletProvider>
      </body>
    </html>
  );
}
