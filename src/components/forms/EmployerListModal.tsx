// EmployerListModal.tsx (search + pagination only, ascending sort)
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../services/supabase";

type EmployerRow = {
  EMID: string;
  CPPSID: string;
  OrganizationName: string;
  City: string | null;
  Province: string | null;
  InsuranceProviderIPACode: string | null;
};

const PAGE_SIZE = 10;

export default function EmployerListModal({
  onClose,
  onSelectEmployer,
}: {
  onClose: () => void;
  onSelectEmployer: (row: EmployerRow) => void;
}) {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<EmployerRow[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  // simple debounce so we don't query on every keystroke
  const [search, setSearch] = useState(q);
  useEffect(() => {
    const t = setTimeout(() => setSearch(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const from = useMemo(() => (page - 1) * PAGE_SIZE, [page]);
  const to   = useMemo(() => from + PAGE_SIZE - 1, [from]);

  useEffect(() => {
    const fetchPage = async () => {
      setLoading(true);
      setError(null);
      try {
        let query = supabase
          .from("employermaster")
          .select(
            "EMID, CPPSID, OrganizationName, City, Province, InsuranceProviderIPACode",
            { count: "exact" }
          )
          // always ascending; add second key to keep stable order
          .order("OrganizationName", { ascending: true })
          .order("EMID", { ascending: true })
          .range(from, to);

        if (search.trim()) {
          query = query.or(
            `OrganizationName.ilike.%${search}%,CPPSID.ilike.%${search}%`
          );
        }

        const { data, error, count } = await query;
        if (error) throw error;

        setRows(data ?? []);
        setTotal(count ?? 0);
      } catch (e: any) {
        setError(e.message ?? "Failed to load employers");
      } finally {
        setLoading(false);
      }
    };

    fetchPage();
  }, [from, to, search]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b p-4">
          <h3 className="text-lg font-semibold">Select Employer</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>

        <div className="p-4 space-y-3">
          {/* Search only */}
          <input
            className="input w-full"
            placeholder="Search by organization or CPPSID…"
            value={q}
            onChange={(e) => { setPage(1); setQ(e.target.value); }}
          />

          {/* Table */}
          <div className="overflow-auto rounded border">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">Organization</th>
                  <th className="px-3 py-2 text-left">CPPSID</th>
                  <th className="px-3 py-2 text-left">City</th>
                  <th className="px-3 py-2 text-left">Province</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td className="px-3 py-4" colSpan={5}>Loading…</td></tr>
                )}
                {!loading && rows.length === 0 && (
                  <tr><td className="px-3 py-4" colSpan={5}>No results</td></tr>
                )}
                {!loading && rows.map((r) => (
                  <tr key={r.EMID} className="border-t">
                    <td className="px-3 py-2">{r.OrganizationName}</td>
                    <td className="px-3 py-2">{r.CPPSID}</td>
                    <td className="px-3 py-2">{r.City ?? ""}</td>
                    <td className="px-3 py-2">{r.Province ?? ""}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => onSelectEmployer(r)}
                      >
                        Select
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">
              Showing {rows.length ? from + 1 : 0}–{from + rows.length} of {total}
            </div>
            <div className="flex gap-2">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
              >
                Prev
              </button>
              <span className="text-sm px-2 py-1 rounded bg-gray-100">
                {page} / {totalPages}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
              >
                Next
              </button>
            </div>
          </div>

          {error && (
            <div className="p-2 text-sm text-red-700 bg-red-50 rounded">{error}</div>
          )}
        </div>
      </div>
    </div>
  );
}
