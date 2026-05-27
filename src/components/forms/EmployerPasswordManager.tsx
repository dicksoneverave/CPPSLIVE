import React, { useEffect, useMemo, useState } from "react";
import { X, Search, Key, Save, ArrowLeft, AlertTriangle } from "lucide-react";
import { supabase } from "../../services/supabase";
import bcrypt from "bcryptjs";

type EmployerRow = {
  EMID: string;
  CPPSID: string;
  OrganizationName: string;
  Email: string;
};

const PAGE_SIZE = 10;

export default function EmployerPasswordManager({ onClose }: { onClose: () => void }) {
  const [view, setView] = useState<'list' | 'edit'>('list');
  const [selectedEmployer, setSelectedEmployer] = useState<EmployerRow | null>(null);
  
  // List State
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<EmployerRow[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Edit State
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [search, setSearch] = useState(q);
  useEffect(() => {
    const t = setTimeout(() => setSearch(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const from = useMemo(() => (page - 1) * PAGE_SIZE, [page]);
  const to   = useMemo(() => from + PAGE_SIZE - 1, [from]);

  useEffect(() => {
    if (view === 'list') {
      fetchEmployers();
    }
  }, [from, to, search, view]);

  const fetchEmployers = async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from("employermaster")
        .select("EMID, CPPSID, OrganizationName", { count: "exact" })
        .order("OrganizationName", { ascending: true })
        .range(from, to);

      if (search.trim()) {
        query = query.or(`OrganizationName.ilike.%${search}%,CPPSID.ilike.%${search}%`);
      }

      const { data: empData, error: empErr, count } = await query;
      if (empErr) throw empErr;

      const employers = empData ?? [];
      
      // Fetch matching users to get emails
      if (employers.length > 0) {
        const names = employers.map(e => e.OrganizationName);
        const { data: userData, error: userErr } = await supabase
          .from("users")
          .select("email, name")
          .in("name", names)
          .eq("group_id", 15);

        if (!userErr && userData) {
          const userMap = new Map(userData.map(u => [u.name, u.email]));
          setRows(employers.map(e => ({
            ...e,
            Email: userMap.get(e.OrganizationName) || ""
          })));
        } else {
          setRows(employers.map(e => ({ ...e, Email: "" })));
        }
      } else {
        setRows([]);
      }
      
      setTotal(count ?? 0);
    } catch (e: any) {
      setError(e.message ?? "Failed to load employers");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectEmployer = (emp: EmployerRow) => {
    setSelectedEmployer(emp);
    setNewEmail(emp.Email || "");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setSuccess(null);
    setView('edit');
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployer) return;

    setError(null);
    setSuccess(null);

    if (!newEmail.trim()) {
      setError("Email is required");
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      // 1. Find user associated with OrganizationName
      const { data: userRecord, error: userFetchErr } = await supabase
        .from("users")
        .select("id")
        .eq("name", selectedEmployer.OrganizationName)
        .eq("group_id", 15)
        .maybeSingle();

      if (userFetchErr) throw userFetchErr;
      if (!userRecord) throw new Error("Could not find user record matching this employer's name");

      // 2. If email changed, check uniqueness
      if (newEmail.trim() !== selectedEmployer.Email) {
        const { data: existing } = await supabase
          .from("users")
          .select("id")
          .eq("email", newEmail.trim())
          .maybeSingle();
        if (existing) throw new Error("The new email is already in use by another account");
      }

      // 3. Prepare updates
      const userUpdates: any = {};
      if (newEmail.trim() !== selectedEmployer.Email) userUpdates.email = newEmail.trim();
      if (newPassword) {
        const salt = await bcrypt.genSalt(10);
        userUpdates.password = await bcrypt.hash(newPassword, salt);
      }

      // 4. Update Users
      if (Object.keys(userUpdates).length > 0) {
        const { error: updateErr } = await supabase
          .from("users")
          .update(userUpdates)
          .eq("id", userRecord.id);
        if (updateErr) throw updateErr;
      }

      // 5. Update Profiles (if email changed)
      if (newEmail.trim() !== selectedEmployer.Email) {
        await supabase
          .from("profiles")
          .update({ email: newEmail.trim() })
          .eq("id", userRecord.id);
          
        // 6. Update EmployerMaster (if email changed)
        await supabase
          .from("employermaster")
          .update({ Email: newEmail.trim() })
          .eq("EMID", selectedEmployer.EMID);
      }

      setSuccess("Account updated successfully");
      // Update local state in case user stays on edit page
      setSelectedEmployer({ ...selectedEmployer, Email: newEmail.trim() });
      setNewPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      setError(e.message || "Failed to update account");
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-4xl rounded-xl bg-white shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b p-6 bg-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Key className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Employer Password Change</h3>
              <p className="text-sm text-gray-500">Manage employer login credentials</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {view === 'list' ? (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-6 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                  placeholder="Search by organization name, CPPSID, or email..."
                  value={q}
                  onChange={(e) => { setPage(1); setQ(e.target.value); }}
                />
              </div>

              {error && <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">{error}</div>}

              <div className="flex-1 overflow-auto border border-gray-200 rounded-lg shadow-sm">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Organization</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">CPPSID</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email/Username</th>
                      <th className="px-6 py-3 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {loading ? (
                      <tr><td className="px-6 py-10 text-center" colSpan={4}>
                        <div className="flex flex-col items-center gap-2">
                          <div className="h-8 w-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                          <span className="text-gray-500 text-sm font-medium">Loading employers...</span>
                        </div>
                      </td></tr>
                    ) : rows.length === 0 ? (
                      <tr><td className="px-6 py-10 text-center text-gray-500" colSpan={4}>No employers found matching your search.</td></tr>
                    ) : rows.map((r) => (
                      <tr key={r.EMID} className="hover:bg-gray-50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-gray-900">{r.OrganizationName}</div>
                          <div className="text-xs text-gray-400">EMID: {r.EMID}</div>
                        </td>
                        <td className="px-6 py-4 text-sm font-mono text-gray-600">{r.CPPSID}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{r.Email || <span className="italic text-gray-300">No email set</span>}</td>
                        <td className="px-6 py-4 text-right">
                          <button
                            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm"
                            onClick={() => handleSelectEmployer(r)}
                          >
                            <Key className="h-4 w-4" />
                            Manage
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between pt-2 border-t mt-auto">
                <div className="text-sm text-gray-500">
                  Showing <span className="font-medium text-gray-900">{rows.length ? from + 1 : 0}</span> to <span className="font-medium text-gray-900">{from + rows.length}</span> of <span className="font-medium text-gray-900">{total}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium disabled:opacity-50 disabled:bg-gray-50 hover:bg-gray-50 transition-colors"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1 || loading}
                  >
                    Previous
                  </button>
                  <div className="flex items-center px-4 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg">
                    {page} / {totalPages}
                  </div>
                  <button
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium disabled:opacity-50 disabled:bg-gray-50 hover:bg-gray-50 transition-colors"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages || loading}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setView('list')}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
                >
                  <ArrowLeft className="h-6 w-6" />
                </button>
                <div>
                  <h4 className="text-lg font-bold text-gray-900">{selectedEmployer?.OrganizationName}</h4>
                  <p className="text-sm text-gray-500">Change username or password</p>
                </div>
              </div>

              <form onSubmit={handleUpdate} className="max-w-2xl mx-auto space-y-8 bg-gray-50 p-8 rounded-2xl border border-gray-100 shadow-inner">
                {error && <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100 flex items-center gap-3"><AlertTriangle className="h-5 w-5" /> {error}</div>}
                {success && <div className="p-4 bg-green-50 text-green-700 rounded-xl text-sm border border-green-100 flex items-center gap-3"><Save className="h-5 w-5" /> {success}</div>}

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Username / Email Address</label>
                    <input
                      type="email"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none bg-white shadow-sm"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      required
                    />
                    <p className="mt-2 text-xs text-gray-500 italic">This email is used as the login username.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-200">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">New Password</label>
                      <input
                        type="password"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none bg-white shadow-sm"
                        placeholder="Leave blank to keep current"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm Password</label>
                      <input
                        type="password"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none bg-white shadow-sm"
                        placeholder="Confirm new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                  >
                    {loading ? (
                      <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Save className="h-5 w-5" />
                    )}
                    Update Credentials
                  </button>
                  <button
                    type="button"
                    onClick={() => setView('list')}
                    className="px-6 py-3.5 bg-white border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
