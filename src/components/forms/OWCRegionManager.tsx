import React, { useState, useEffect } from 'react';
import { X, Search, Plus, Edit2, Trash2, Eye, Save, ArrowLeft, AlertTriangle, Globe } from 'lucide-react';
import { supabase } from '../../services/supabase';

interface Region {
  ID: number;
  DKey: string;
  DValue: string;
  DType: string;
}

interface OWCRegionManagerProps {
  onClose: () => void;
  initialView?: 'list' | 'add' | 'edit' | 'view';
}

const OWCRegionManager: React.FC<OWCRegionManagerProps> = ({ 
  onClose,
  initialView = 'list'
}) => {
  const [view, setView] = useState<'list' | 'add' | 'edit' | 'view'>(initialView);
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [regionToDelete, setRegionToDelete] = useState<Region | null>(null);

  const [formData, setFormData] = useState({
    DKey: '',
    DValue: ''
  });

  useEffect(() => {
    fetchRegions();
  }, []);

  const fetchRegions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('dictionary')
        .select('*')
        .eq('DType', 'ProvinceRegion')
        .order('DValue', { ascending: true });

      if (error) throw error;
      setRegions(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAdd = () => {
    setFormData({
      DKey: '',
      DValue: ''
    });
    setView('add');
  };

  const handleEdit = (region: Region) => {
    setSelectedRegion(region);
    setFormData({
      DKey: region.DKey || '',
      DValue: region.DValue || ''
    });
    setView('edit');
  };

  const handleView = (region: Region) => {
    setSelectedRegion(region);
    setFormData({
      DKey: region.DKey || '',
      DValue: region.DValue || ''
    });
    setView('view');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setError(null);

    try {
      const payload = {
        DKey: formData.DKey.trim(),
        DValue: formData.DValue.trim(),
        DType: 'ProvinceRegion'
      };

      if (view === 'add') {
        const { error } = await supabase
          .from('dictionary')
          .insert([payload]);
        if (error) throw error;
      } else if (view === 'edit' && selectedRegion) {
        const { error } = await supabase
          .from('dictionary')
          .update(payload)
          .eq('ID', selectedRegion.ID);
        if (error) throw error;
      }

      await fetchRegions();
      setView('list');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const confirmDelete = (region: Region) => {
    setRegionToDelete(region);
    setShowDeleteConfirm(true);
  };

  const handleDelete = async () => {
    if (!regionToDelete) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('dictionary')
        .delete()
        .eq('ID', regionToDelete.ID);

      if (error) throw error;
      await fetchRegions();
      setShowDeleteConfirm(false);
      setRegionToDelete(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredRegions = regions.filter(r => 
    r.DValue?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.DKey?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Globe className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">
              {view === 'list' && 'Region Management'}
              {view === 'add' && 'Add New Region'}
              {view === 'edit' && 'Edit Region'}
              {view === 'view' && 'View Region Details'}
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

          {view === 'list' ? (
            <div className="flex-1 flex flex-col min-h-0 p-6 space-y-4 overflow-hidden">
              <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by region name or code..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <button
                  onClick={handleAdd}
                  className="flex items-center gap-2 px-4 py-2 bg-[#8B2500] text-white rounded-lg hover:bg-[#A03000] transition-colors whitespace-nowrap"
                >
                  <Plus className="h-5 w-5" />
                  Add New Region
                </button>
              </div>

              <div className="flex-1 overflow-auto border border-gray-200 rounded-lg shadow-sm">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Region Name</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Code / Key</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {loading ? (
                      <tr>
                        <td colSpan={3} className="px-6 py-10 text-center text-gray-500">
                          <div className="flex flex-col items-center gap-2">
                            <div className="h-8 w-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                            <span>Loading regions...</span>
                          </div>
                        </td>
                      </tr>
                    ) : filteredRegions.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-6 py-10 text-center text-gray-500">No regions found.</td>
                      </tr>
                    ) : filteredRegions.map((r) => (
                      <tr key={r.ID} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{r.DValue}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{r.DKey}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                          <button onClick={() => handleView(r)} title="View Details" className="text-gray-400 hover:text-primary transition-colors">
                            <Eye className="h-5 w-5" />
                          </button>
                          <button onClick={() => handleEdit(r)} title="Edit Record" className="text-blue-400 hover:text-blue-600 transition-colors">
                            <Edit2 className="h-5 w-5" />
                          </button>
                          <button onClick={() => confirmDelete(r)} title="Delete Record" className="text-red-400 hover:text-red-600 transition-colors">
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-6 space-y-6">
              <button 
                onClick={() => setView('list')}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-2 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to List
              </button>

              <form onSubmit={handleSubmit} className="max-w-2xl mx-auto w-full space-y-6 bg-gray-50 p-8 rounded-xl border border-gray-100">
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Region Name</label>
                    <input
                      type="text"
                      name="DValue"
                      placeholder="e.g. Highlands Region"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none disabled:bg-gray-100"
                      value={formData.DValue}
                      onChange={handleInputChange}
                      disabled={view === 'view'}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Region Code / Key</label>
                    <input
                      type="text"
                      name="DKey"
                      placeholder="e.g. HR"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none disabled:bg-gray-100 font-mono"
                      value={formData.DKey}
                      onChange={handleInputChange}
                      disabled={view === 'view'}
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setView('list')}
                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    {view === 'view' ? 'Close' : 'Cancel'}
                  </button>
                  {view !== 'view' && (
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="flex items-center gap-2 px-8 py-2 bg-[#8B2500] text-white rounded-lg hover:bg-[#A03000] transition-colors disabled:opacity-50 shadow-md"
                    >
                      {actionLoading ? (
                        <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Save className="h-5 w-5" />
                      )}
                      {view === 'add' ? 'Save Region' : 'Update Region'}
                    </button>
                  )}
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && regionToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 transform animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-4 text-red-600 mb-4">
              <div className="p-3 bg-red-50 rounded-full">
                <AlertTriangle className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold">Delete Region?</h3>
            </div>
            
            <p className="text-gray-600 mb-6 leading-relaxed">
              Are you sure you want to delete the region 
              <span className="font-bold text-gray-900 ml-1">
                "{regionToDelete.DValue}"
              </span>? 
              This will remove it from the system dictionary and cannot be undone.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Back
              </button>
              <button
                onClick={handleDelete}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-bold shadow-lg shadow-red-200 disabled:opacity-50 flex items-center justify-center"
              >
                {actionLoading ? (
                  <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Proceed'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OWCRegionManager;
