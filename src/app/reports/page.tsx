import { connection } from "next/server";
import { ReportsView } from "@/components/reports-view";
import { loadConfig } from "@/lib/config";
import { loadReportsPage } from "@/lib/reports/load";
import { parseReportParams } from "@/lib/reports/params";
import { ymdInZone } from "@/lib/timezone";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Reports",
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const params = await searchParams;
  const todayYmd = ymdInZone(new Date(), loadConfig().timezone);
  const { tab, date } = parseReportParams(params, todayYmd);
  const data = await loadReportsPage(tab, date);

  return (
    <ReportsView
      tab={data.tab}
      date={data.date}
      todayYmd={data.todayYmd}
      timeZone={data.timeZone}
      day={data.day}
      week={data.week}
      month={data.month}
      calendar={data.calendar}
      year={data.year}
    />
  );
}
