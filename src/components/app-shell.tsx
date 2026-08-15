import { AppNav } from "./app-nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ctp-crust text-ctp-text">
      <AppNav />
      <div className="mx-auto max-w-[1080px] px-5 pb-16 pt-6">{children}</div>
    </div>
  );
}
