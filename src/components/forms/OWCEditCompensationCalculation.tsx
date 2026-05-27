import React, { useState, useEffect } from 'react';
import { X, Search, Save, ArrowLeft, AlertTriangle, Calculator, User, FileText } from 'lucide-react';
import { supabase } from '../../services/supabase';

interface WorkerRecord {
  IRN: string;
  DisplayIRN: string;
  FirstName: string;
  LastName: string;
}

interface CompensationDetails {
  CCWDCompensationAmount: number;
  CCWDMedicalExpenses: number;
  CCWDMiscExpenses: number;
  CCWDDeductions: number;
  CCWDDeductionsNotes: string;
  CCWDFindings: string;
  CCWDRecommendations: string;
}

interface OWCEditCompensationCalculationProps {
  onClose: () => void;
}

const OWCEditCompensationCalculation: React.FC<OWCEditCompensationCalculationProps> = ({ onClose }) => {
  const [view, setView] = useState<'search' | 'edit'>('search');
  const [searchTerm, setSearchTerm] = useState('');
  const [workers, setWorkers] = useState<WorkerRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedWorker, setSelectedWorker] = useState<WorkerRecord | null>(null);
  const [isExisting, setIsExisting] = useState(false);
  const [currentRecordId, setCurrentRecordId] = useState<number | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const [formData, setFormData] = useState<CompensationDetails>({
    CCWDCompensationAmount: 0,
    CCWDMedicalExpenses: 0,
    CCWDMiscExpenses: 0,
    CCWDDeductions: 0,
    CCWDDeductionsNotes: '',
    CCWDFindings: '',
    CCWDRecommendations: ''
  });

  // Real-time search effect
  useEffect(() => {
    if (view === 'search') {
      const timer = setTimeout(() => {
        if (searchTerm.trim().length >= 2) {
          fetchWorkers();
        } else {
          setWorkers([]);
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [searchTerm, view]);

  const fetchWorkers = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('workerirn')
        .select('IRN, DisplayIRN, FirstName, LastName')
        .or(`DisplayIRN.ilike.%${searchTerm}%,FirstName.ilike.%${searchTerm}%,LastName.ilike.%${searchTerm}%`)
        .limit(20);

      if (error) throw error;
      setWorkers(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleWorkerSelect = async (worker: WorkerRecord) => {
    setSelectedWorker(worker);
    setLoading(true);
    setError(null);
    try {
      const sanitizedIRN = String(worker.IRN).replace(/\D/g, '');
      const { data, error } = await supabase
        .from('claimcompensationworkerdetails')
        .select('*')
        .eq('IRN', sanitizedIRN)
        .limit(1);

      if (error) throw error;

      const record = data && data.length > 0 ? data[0] : null;

      if (record) {
        setIsExisting(true);
        setCurrentRecordId(record.CCWDID);
        setFormData({
          CCWDCompensationAmount: record.CCWDCompensationAmount || 0,
          CCWDMedicalExpenses: record.CCWDMedicalExpenses || 0,
          CCWDMiscExpenses: record.CCWDMiscExpenses || 0,
          CCWDDeductions: record.CCWDDeductions || 0,
          CCWDDeductionsNotes: record.CCWDDeductionsNotes || '',
          CCWDFindings: record.CCWDFindings || '',
          CCWDRecommendations: record.CCWDRecommendations || ''
        });
      } else {
        setIsExisting(false);
        setCurrentRecordId(null);
        setFormData({
          CCWDCompensationAmount: 0,
          CCWDMedicalExpenses: 0,
          CCWDMiscExpenses: 0,
          CCWDDeductions: 0,
          CCWDDeductionsNotes: '',
          CCWDFindings: '',
          CCWDRecommendations: ''
        });
      }
      setView('edit');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? 0 : Number(value)) : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setError(null);

    try {
      if (!selectedWorker) throw new Error("No worker selected.");

      const sanitizedIRN = String(selectedWorker.IRN).replace(/\D/g, '');
      const numericIRN = Number(sanitizedIRN);

      const payload: any = {
        IRN: numericIRN,
        CCWDWorkerFirstName: selectedWorker.FirstName,
        CCWDWorkerLastName: selectedWorker.LastName,
        CCWDCompensationAmount: Number(formData.CCWDCompensationAmount) || 0,
        CCWDMedicalExpenses: Number(formData.CCWDMedicalExpenses) || 0,
        CCWDMiscExpenses: Number(formData.CCWDMiscExpenses) || 0,
        CCWDDeductions: Number(formData.CCWDDeductions) || 0,
        CCWDDeductionsNotes: String(formData.CCWDDeductionsNotes || '').trim(),
        CCWDFindings: String(formData.CCWDFindings || '').trim(),
        CCWDRecommendations: String(formData.CCWDRecommendations || '').trim()
      };

      if (isExisting && currentRecordId) {
        const { data, error } = await supabase
          .from('claimcompensationworkerdetails')
          .update(payload)
          .eq('CCWDID', currentRecordId)
          .select();

        if (error) throw error;
        if (!data || data.length === 0) throw new Error("Update failed: Record not found.");
      } else {
        const { error } = await supabase
          .from('claimcompensationworkerdetails')
          .insert([payload]);
        if (error) throw error;
      }

      // Success - go back to search
      setView('search');
      setSearchTerm('');
      setSelectedWorker(null);
      setShowSuccessModal(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Calculator className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">
              {view === 'search' ? 'Edit Compensation Calculation' : `Edit Details: ${selectedWorker?.FirstName} ${selectedWorker?.LastName}`}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {error && (
            <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              {error}
            </div>
          )}

          {view === 'search' ? (
            <div className="flex-1 flex flex-col min-h-0 p-6 space-y-4 overflow-hidden">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by Display IRN, First Name or Last Name..."
                  className="w-full pl-12 pr-4 py-4 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none text-lg transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="flex-1 overflow-auto border border-gray-100 rounded-xl bg-gray-50/50">
                {loading && (
                  <div className="flex flex-col items-center justify-center h-full py-12 text-gray-500">
                    <div className="h-10 w-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
                    <p className="font-medium">Searching for workers...</p>
                  </div>
                )}

                {!loading && searchTerm.trim().length > 0 && workers.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full py-12 text-gray-400">
                    <User className="h-12 w-12 mb-4 opacity-20" />
                    <p className="text-lg">No workers found matching your search.</p>
                  </div>
                )}

                {!loading && workers.length > 0 && (
                  <div className="divide-y divide-gray-200">
                    {workers.map((worker) => (
                      <button
                        key={worker.IRN}
                        onClick={() => handleWorkerSelect(worker)}
                        className="w-full flex items-center justify-between p-4 hover:bg-white hover:shadow-md transition-all group text-left"
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-white rounded-lg border border-gray-100 group-hover:border-primary/30 group-hover:text-primary transition-colors shadow-sm">
                            <User className="h-6 w-6" />
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 text-lg">
                              {worker.FirstName} {worker.LastName}
                            </p>
                            <p className="text-sm text-gray-500 font-mono">{worker.DisplayIRN}</p>
                          </div>
                        </div>
                        <div className="px-4 py-2 rounded-lg bg-gray-100 text-gray-600 font-bold text-sm group-hover:bg-primary group-hover:text-white transition-all shadow-sm">
                          Select Worker
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {!loading && searchTerm.trim().length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full py-12 text-gray-400">
                    <Search className="h-12 w-12 mb-4 opacity-20" />
                    <p className="text-lg">Type at least 2 characters to start searching.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="p-6 border-b bg-gray-50 flex items-center justify-between">
                <button
                  onClick={() => setView('search')}
                  className="flex items-center gap-2 text-primary font-bold hover:gap-3 transition-all"
                >
                  <ArrowLeft className="h-5 w-5" />
                  Back to Search
                </button>
                <div className="flex items-center gap-2 px-3 py-1 bg-white border rounded-full text-sm font-medium text-gray-600 shadow-sm">
                  <FileText className="h-4 w-4" />
                  {selectedWorker?.DisplayIRN}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8">
                <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-8">
                  {/* Financial Section */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 bg-gray-50/50 border-b flex items-center gap-2">
                      <Calculator className="h-5 w-5 text-primary" />
                      <h3 className="font-bold text-gray-800">Financial Calculations</h3>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="block text-sm font-bold text-gray-700">Compensation Amount</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">K</span>
                          <input
                            type="number"
                            step="0.01"
                            name="CCWDCompensationAmount"
                            className="w-full pl-8 pr-4 py-3 border-2 border-gray-100 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold text-lg"
                            value={formData.CCWDCompensationAmount}
                            onChange={handleInputChange}
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-bold text-gray-700">Medical Expenses</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">K</span>
                          <input
                            type="number"
                            step="0.01"
                            name="CCWDMedicalExpenses"
                            className="w-full pl-8 pr-4 py-3 border-2 border-gray-100 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold text-lg"
                            value={formData.CCWDMedicalExpenses}
                            onChange={handleInputChange}
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-bold text-gray-700">Misc. Expenses</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">K</span>
                          <input
                            type="number"
                            step="0.01"
                            name="CCWDMiscExpenses"
                            className="w-full pl-8 pr-4 py-3 border-2 border-gray-100 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold text-lg"
                            value={formData.CCWDMiscExpenses}
                            onChange={handleInputChange}
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-bold text-gray-700">Deductions</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">K</span>
                          <input
                            type="number"
                            step="0.01"
                            name="CCWDDeductions"
                            className="w-full pl-8 pr-4 py-3 border-2 border-gray-100 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold text-lg text-red-600"
                            value={formData.CCWDDeductions}
                            onChange={handleInputChange}
                            required
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Notes & Recommendations Section */}
                  <div className="grid grid-cols-1 gap-8">
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-gray-700">Deduction Notes</label>
                      <textarea
                        name="CCWDDeductionsNotes"
                        rows={3}
                        className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all resize-none"
                        placeholder="Explain any deductions here..."
                        value={formData.CCWDDeductionsNotes}
                        onChange={handleInputChange}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-gray-700">Findings</label>
                      <textarea
                        name="CCWDFindings"
                        rows={4}
                        className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all resize-none"
                        placeholder="Detail your findings here..."
                        value={formData.CCWDFindings}
                        onChange={handleInputChange}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-gray-700">Recommendations</label>
                      <textarea
                        name="CCWDRecommendations"
                        rows={4}
                        className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all resize-none font-medium"
                        placeholder="State your recommendations here..."
                        value={formData.CCWDRecommendations}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="flex justify-end gap-4 pt-8">
                    <button
                      type="button"
                      onClick={() => setView('search')}
                      className="px-8 py-3 border-2 border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="flex items-center gap-2 px-12 py-3 bg-primary text-white rounded-xl font-bold hover:shadow-lg hover:shadow-primary/30 transition-all disabled:opacity-50"
                    >
                      {actionLoading ? (
                        <div className="h-6 w-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Save className="h-6 w-6" />
                      )}
                      Save Calculation
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-8 transform animate-in zoom-in-95 duration-200 text-center">
            <div className="mx-auto w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-6">
              <Save className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Saved Successfully!</h3>
            <p className="text-gray-600 mb-8">
              The compensation calculation details have been updated in the system.
            </p>
            <button
              onClick={() => setShowSuccessModal(false)}
              className="w-full py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all shadow-lg shadow-green-100"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OWCEditCompensationCalculation;
