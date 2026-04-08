import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUser } from "@/lib/auth/get-user";
import {
  deriveAnalyseListRow,
  filterAndSortAnalyseList,
  type AnalyseListDeadlineWarnBadge,
  type AnalyseListDerived,
  type AnalyseListFristFilter,
  type AnalyseListSort,
} from "@/lib/analyseListDerivation";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  const key = serviceKey || anonKey;
  return createClient(url, key);
}

const DEFAULT_PAGE_SIZE = 10;
const FETCH_BATCH = 800;
const MAX_ROWS_SAFETY = 8000;

function parseFrist(s: string | null): AnalyseListFristFilter {
  const v = (s ?? "").trim().toLowerCase();
  if (
    v === "present" ||
    v === "none" ||
    v === "overdue" ||
    v === "today" ||
    v === "d1to3" ||
    v === "d4to7" ||
    v === "within7"
  ) {
    return v;
  }
  return "";
}

function parseSort(s: string | null): AnalyseListSort {
  const v = (s ?? "").trim().toLowerCase();
  if (v === "oldest" || v === "deadline" || v === "favorites_first") return v;
  return "newest";
}

function parseFavorite(s: string | null): "" | "only" {
  return (s ?? "").trim().toLowerCase() === "only" ? "only" : "";
}

export type AnalyseListItemDto = {
  id: string;
  created_at: string;
  project_name: string | null;
  file_name: string | null;
  score: number | null;
  status: string | null;
  listTitle: string;
  metaSegments: string[];
  /** Nur Abgabefrist, nur bei parsebarem Datum und relevanter Fristlage. */
  deadlineWarnBadge: AnalyseListDeadlineWarnBadge | null;
  isFavorite: boolean;
};

function toDto(d: AnalyseListDerived): AnalyseListItemDto {
  return {
    id: d.id,
    created_at: d.created_at,
    project_name: d.project_name,
    file_name: d.file_name,
    score: d.score,
    status: d.status,
    listTitle: d.listTitle,
    metaSegments: d.metaSegments,
    deadlineWarnBadge: d.deadlineWarnBadge,
    isFavorite: d.isFavorite,
  };
}

export async function GET(req: NextRequest) {
  const user = await getUser().catch(() => null);
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet", items: [], total: 0 }, { status: 401 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ items: [], total: 0 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE));

  const q = searchParams.get("q") ?? "";
  const gewerk = searchParams.get("gewerk") ?? "";
  const projektart = searchParams.get("projektart") ?? "";
  const frist = parseFrist(searchParams.get("frist"));
  const sort = parseSort(searchParams.get("sort"));
  const favorite = parseFavorite(searchParams.get("favorite"));

  const rawRows: {
    id: string;
    created_at: string;
    project_name: string | null;
    file_name: string | null;
    score: number | null;
    status: string | null;
    result_json: unknown;
    is_favorite: boolean | null;
  }[] = [];

  let from = 0;
  while (rawRows.length < MAX_ROWS_SAFETY) {
    const to = from + FETCH_BATCH - 1;
    const { data, error } = await supabase
      .from("analyse_runs")
      .select("id, created_at, project_name, file_name, score, status, result_json, is_favorite")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      const isRls = error.message?.includes("row-level security");
      const msg = isRls
        ? "Lesen durch RLS blockiert. SUPABASE_SERVICE_ROLE_KEY setzen oder RLS-Policy für analyse_runs anlegen."
        : error.message;
      return NextResponse.json({ error: msg, items: [], total: 0 }, { status: 500 });
    }
    if (!data?.length) break;
    rawRows.push(...(data as typeof rawRows));
    if (data.length < FETCH_BATCH) break;
    from += FETCH_BATCH;
  }

  const derived = rawRows.map((row) => deriveAnalyseListRow(row));
  const filtered = filterAndSortAnalyseList(derived, { q, gewerk, projektart, frist, sort, favorite });
  const total = filtered.length;
  const sliceFrom = (page - 1) * pageSize;
  const pageItems = filtered.slice(sliceFrom, sliceFrom + pageSize).map(toDto);

  return NextResponse.json({
    items: pageItems,
    total,
    page,
    pageSize,
    truncated: rawRows.length >= MAX_ROWS_SAFETY,
  });
}
