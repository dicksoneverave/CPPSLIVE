import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Shield, 
  TrendingUp, 
  Activity, 
  BarChart3, 
  PieChart as PieChartIcon, 
  Map as MapIcon,
  DollarSign,
  Clock,
  ExternalLink,
  ChevronRight,
  Settings,
  AlertCircle
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Cell,
  PieChart,
  Pie,
  Legend
} from 'recharts';
import { supabase } from '../../services/supabase';

interface Stats {
  totalClaims: number;
  awardedClaims: number;
  totalEmployers: number;
  totalCompensation: number;
}

interface ChartData {
  name: string;
  value: number;
}

interface ClaimRecord {
  CCWDID: number;
  CCWDWorkerFirstName: string;
  CCWDWorkerLastName: string;
  CCWDCompensationAmount: number;
  IRN: string;
}

interface SystemParam {
  DKey: string;
  DValue: string;
}

interface ActivityRecord {
  DisplayIRN: string;
  IncidentDate: string;
  IncidentType: string;
  UpdatedDate: string;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

interface OWCAdminAnalyticsProps {
  onDrillDown?: (filterType: 'incidentType' | 'province', filterValue: string) => void;
}

const OWCAdminAnalytics: React.FC<OWCAdminAnalyticsProps> = ({ onDrillDown }) => {

  const [stats, setStats] = useState<Stats>({
    totalClaims: 0,
    awardedClaims: 0,
    totalEmployers: 0,
    totalCompensation: 0
  });
  const [typeData, setTypeData] = useState<ChartData[]>([]);
  const [provinceData, setProvinceData] = useState<ChartData[]>([]);
  const [highValueClaims, setHighValueClaims] = useState<ClaimRecord[]>([]);
  const [systemParams, setSystemParams] = useState<SystemParam[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityRecord[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      
      // 1. Fetch KPI Counts
      const [
        { count: claimsCount },
        { count: awardedCount },
        { count: employerCount },
        { data: compData },
        { data: highValueData },
        { data: paramData },
        { data: activityData }
      ] = await Promise.all([
        supabase.from('form1112master').select('*', { count: 'exact', head: true }),
        supabase.from('claimcompensationworkerdetails').select('*', { count: 'exact', head: true }),
        supabase.from('employermaster').select('*', { count: 'exact', head: true }),
        supabase.from('claimcompensationworkerdetails').select('CCWDCompensationAmount'),
        supabase.from('claimcompensationworkerdetails').select('CCWDID, CCWDWorkerFirstName, CCWDWorkerLastName, CCWDCompensationAmount, IRN').order('CCWDCompensationAmount', { ascending: false }).limit(5),
        supabase.from('dictionary').select('DKey, DValue').eq('DType', 'SystemParameter').limit(5),
        supabase.from('form1112master').select('DisplayIRN, IncidentDate, IncidentType').order('IncidentDate', { ascending: false }).limit(5)
      ]);

      const totalComp = (compData || []).reduce((sum, item) => sum + (Number(item.CCWDCompensationAmount) || 0), 0);

      setStats({
        totalClaims: claimsCount || 0,
        awardedClaims: awardedCount || 0,
        totalEmployers: employerCount || 0,
        totalCompensation: totalComp
      });

      setHighValueClaims(highValueData || []);
      setSystemParams(paramData || []);
      setRecentActivity(activityData || []);

      // 2. Fetch Incident Type Data
      const { data: typeResults } = await supabase
        .from('form1112master')
        .select('IncidentType');
      
      if (typeResults) {
        const counts: Record<string, number> = {};
        typeResults.forEach(r => {
          const t = r.IncidentType || 'Unknown';
          counts[t] = (counts[t] || 0) + 1;
        });
        setTypeData(Object.entries(counts).map(([name, value]) => ({ name, value })));
      }

      // 3. Fetch Province Data
      const { data: provinceResults } = await supabase
        .from('form1112master')
        .select('IncidentProvince');
      
      if (provinceResults) {
        const counts: Record<string, number> = {};
        provinceResults.forEach(r => {
          const p = r.IncidentProvince || 'Unknown';
          counts[p] = (counts[p] || 0) + 1;
        });
        const sorted = Object.entries(counts)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 8); // Top 8 provinces
        setProvinceData(sorted);
      }

    } catch (err: any) {
      console.error('Error fetching analytics:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white p-6 rounded-2xl border border-gray-100 h-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           <div className="bg-white p-6 rounded-2xl border border-gray-100 h-[400px]" />
           <div className="bg-white p-6 rounded-2xl border border-gray-100 h-[400px]" />
        </div>
      </div>
    );
  }

  const kpis = [
    { 
      label: 'Total Claims', 
      value: stats.totalClaims.toLocaleString(), 
      icon: TrendingUp, 
      color: 'blue',
      trend: '+12% from last month' 
    },
    { 
      label: 'Awarded Claims', 
      value: stats.awardedClaims.toLocaleString(), 
      icon: Shield, 
      color: 'green',
      trend: '84% success rate' 
    },
    { 
      label: 'Total Paid Out', 
      value: `K ${stats.totalCompensation.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, 
      icon: DollarSign, 
      color: 'amber',
      trend: 'Financial stability: High' 
    },
    { 
      label: 'Active Employers', 
      value: stats.totalEmployers.toLocaleString(), 
      icon: Users, 
      color: 'purple',
      trend: '+5 new this week' 
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {kpis.map((kpi, idx) => (
          <div key={idx} className="group relative bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
            <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 bg-${kpi.color}-50 rounded-full opacity-50 group-hover:scale-110 transition-transform`} />
            <div className="relative flex items-center gap-4">
              <div className={`p-3 bg-${kpi.color}-100 rounded-xl text-${kpi.color}-600`}>
                <kpi.icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">{kpi.label}</p>
                <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
              </div>
            </div>
            <p className="mt-4 text-xs font-medium text-gray-400">{kpi.trend}</p>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Claims by Type */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-primary" />
              <h3 className="font-bold text-gray-800">Claims by Incident Type</h3>
            </div>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={typeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {typeData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={COLORS[index % COLORS.length]} 
                      onClick={() => onDrillDown?.('incidentType', entry.name)}
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                    />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Claims by Province */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <MapIcon className="h-5 w-5 text-primary" />
              <h3 className="font-bold text-gray-800">Top Provinces by Claims</h3>
            </div>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={provinceData} layout="vertical" margin={{ left: 40, right: 20 }}>
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  tick={{ fontSize: 12, fontWeight: 500 }} 
                  axisLine={false}
                  tickLine={false}
                  width={100}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar 
                  dataKey="value" 
                  radius={[0, 4, 4, 0]} 
                  barSize={20}
                  onClick={(data) => onDrillDown?.('province', data.name)}
                  className="cursor-pointer"
                >
                  {provinceData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={COLORS[0]} 
                      opacity={1 - (index * 0.1)} 
                      className="hover:opacity-70 transition-opacity"
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tables Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* High Value Claims */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                <DollarSign className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-gray-800">High-Value Awards</h3>
            </div>
            <span className="text-[10px] font-black uppercase text-gray-400">Top 5 Records</span>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50/50 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                <tr>
                  <th className="px-6 py-3">Worker Name</th>
                  <th className="px-6 py-3">Amount</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {highValueClaims.map((claim) => (
                  <tr key={claim.CCWDID} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <p className="font-bold text-gray-900">{claim.CCWDWorkerFirstName} {claim.CCWDWorkerLastName}</p>
                      <p className="text-xs text-gray-400 font-mono">{claim.IRN}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-black text-blue-600">K {claim.CCWDCompensationAmount.toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-primary transition-colors" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* System Activity & Parameters */}
        <div className="space-y-8">
          {/* Recent Activity */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                  <Clock className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-gray-800">Recent Claim Activity</h3>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {recentActivity.map((activity, i) => (
                <div key={i} className="flex items-center justify-between gap-4 p-3 hover:bg-gray-50 rounded-xl transition-colors border border-transparent hover:border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${activity.IncidentType === 'Death' ? 'bg-rose-500' : 'bg-blue-500'}`} />
                    <div>
                      <p className="text-sm font-bold text-gray-900">{activity.DisplayIRN}</p>
                      <p className="text-xs text-gray-500">{activity.IncidentType} case</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-gray-400">{new Date(activity.IncidentDate).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* System Health / Parameters */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
             <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                  <Settings className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-gray-800">System Governance</h3>
              </div>
              <div className="flex items-center gap-1 text-[10px] font-black uppercase text-green-600">
                <div className="w-1.5 h-1.5 bg-green-600 rounded-full animate-pulse" />
                Healthy
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4">
                {systemParams.length > 0 ? systemParams.map((param, i) => (
                  <div key={i} className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{param.DKey.replace(/_/g, ' ')}</p>
                    <p className="text-sm font-bold text-gray-900">{param.DValue}</p>
                  </div>
                )) : (
                  <div className="col-span-2 py-8 text-center text-gray-400 flex flex-col items-center">
                    <AlertCircle className="h-8 w-8 mb-2 opacity-20" />
                    <p className="text-sm font-medium">No active system parameters found.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OWCAdminAnalytics;
