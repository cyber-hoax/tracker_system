import { headers } from "next/headers";

export async function isDesktopApp(): Promise<boolean> {
  const ua = (await headers()).get("user-agent") ?? "";
  return ua.includes("Electron") || ua.includes("DailyRoutineNative");
}
