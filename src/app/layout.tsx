import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { connection } from "next/server";
import { AppShell } from "@/components/app-shell";
import { appearanceStyle } from "@/lib/appearance";
import { getAppName, loadAppearance } from "@/lib/appearance-store";
import { isDesktopApp } from "@/lib/desktop";
import { loadWorkspaceTree } from "@/lib/workspace/folders";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export async function generateMetadata(): Promise<Metadata> {
  const name = getAppName();
  return {
    title: {
      default: name,
      template: `%s — ${name}`,
    },
    description: "Local Zettelkasten DSA tracker",
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  await connection();
  const appearance = loadAppearance();
  const appName = getAppName();
  const tree = await loadWorkspaceTree();
  const desktop = await isDesktopApp();
  const fontClass = `${jetbrainsMono.variable} ${inter.variable}`;

  return (
    <html
      lang="en"
      data-theme={appearance.colorTheme}
      data-code-theme={appearance.codeTheme}
      className={desktop ? `${fontClass} desktop-app` : fontClass}
      style={appearanceStyle(appearance) as CSSProperties}
    >
      <body className="antialiased">
        <AppShell appName={appName} tree={tree}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
