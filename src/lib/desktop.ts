import { headers } from "next/headers";

export async function isDesktopApp(): Promise<boolean> {
  const headerList = await headers();
  return headerList.get("user-agent")?.includes("Electron") === true;
}
