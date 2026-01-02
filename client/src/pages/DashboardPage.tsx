import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import {
  KeyIcon,
  BuildingStorefrontIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { format } from 'date-fns';

interface DashboardStats {
  licenses: {
    total: number;
    active: number;
    byTier: Record<string, number>;
    generatedLast30Days: number;
    expiringSoon: number;
  };
  pharmacies: {
    total: number;
    active: number;
    createdLast30Days: number;
  };
  activations: {
    total: number;
    last7Days: number;
    last30Days: number;
  };
  verifications: {
    last7Days: number;
    last30Days: number;
  };
}

interface TrendData {
  date: string;
  total: number;
  STANDARD: number;
  PROFESSIONAL: number;
  ENTERPRISE: number;
}

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const response = await api.get('/dashboard/stats');
      return response.data.data;
    },
  });

  const { data: licenseTrends } = useQuery<TrendData[]>({
    queryKey: ['license-trends'],
    queryFn: async () => {
      const response = await api.get('/dashboard/license-trends?days=14');
      return response.data.data;
    },
  });

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const statCards = [
    {
      name: 'Total Licenses',
      value: stats?.licenses.total || 0,
      icon: KeyIcon,
      color: 'bg-blue-500',
      change: `+${stats?.licenses.generatedLast30Days || 0} this month`,
    },
    {
      name: 'Active Licenses',
      value: stats?.licenses.active || 0,
      icon: CheckCircleIcon,
      color: 'bg-green-500',
      change: `${Math.round(((stats?.licenses.active || 0) / (stats?.licenses.total || 1)) * 100)}% of total`,
    },
    {
      name: 'Total Pharmacies',
      value: stats?.pharmacies.total || 0,
      icon: BuildingStorefrontIcon,
      color: 'bg-purple-500',
      change: `+${stats?.pharmacies.createdLast30Days || 0} this month`,
    },
    {
      name: 'Expiring Soon',
      value: stats?.licenses.expiringSoon || 0,
      icon: ExclamationTriangleIcon,
      color: 'bg-yellow-500',
      change: 'Next 30 days',
    },
  ];

  const tierData = stats?.licenses.byTier
    ? Object.entries(stats.licenses.byTier).map(([tier, count]) => ({
        tier,
        count,
      }))
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Overview of your license management system
          </p>
        </div>
        <Link to="/licenses/generate" className="btn btn-primary">
          <PlusIcon className="h-5 w-5 mr-2" />
          Generate License
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <div key={stat.name} className="card overflow-hidden">
            <div className="p-5">
              <div className="flex items-center">
                <div className={`flex-shrink-0 rounded-lg p-3 ${stat.color}`}>
                  <stat.icon className="h-6 w-6 text-white" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      {stat.name}
                    </dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900">
                        {stat.value.toLocaleString()}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
              <div className="mt-4 text-sm text-gray-500">{stat.change}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* License Generation Trend */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <ArrowTrendingUpIcon className="h-5 w-5 mr-2 text-gray-400" />
              License Generation Trend
            </h3>
            <p className="mt-1 text-sm text-gray-500">Last 14 days</p>
          </div>
          <div className="card-body">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={licenseTrends || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => format(new Date(value), 'MMM d')}
                    stroke="#9ca3af"
                    fontSize={12}
                  />
                  <YAxis stroke="#9ca3af" fontSize={12} />
                  <Tooltip
                    labelFormatter={(value) => format(new Date(value), 'MMM d, yyyy')}
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Licenses by Tier */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <KeyIcon className="h-5 w-5 mr-2 text-gray-400" />
              Licenses by Tier
            </h3>
            <p className="mt-1 text-sm text-gray-500">Distribution of license types</p>
          </div>
          <div className="card-body">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tierData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" stroke="#9ca3af" fontSize={12} />
                  <YAxis dataKey="tier" type="category" stroke="#9ca3af" fontSize={12} width={100} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Stats */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card">
          <div className="card-body">
            <h3 className="text-sm font-medium text-gray-500">Activations (7 days)</h3>
            <p className="mt-2 text-3xl font-semibold text-gray-900">
              {stats?.activations.last7Days || 0}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {stats?.activations.last30Days || 0} in last 30 days
            </p>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <h3 className="text-sm font-medium text-gray-500">Verifications (7 days)</h3>
            <p className="mt-2 text-3xl font-semibold text-gray-900">
              {stats?.verifications.last7Days || 0}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {stats?.verifications.last30Days || 0} in last 30 days
            </p>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <h3 className="text-sm font-medium text-gray-500">Active Pharmacies</h3>
            <p className="mt-2 text-3xl font-semibold text-gray-900">
              {stats?.pharmacies.active || 0}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {Math.round(((stats?.pharmacies.active || 0) / (stats?.pharmacies.total || 1)) * 100)}% of total
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
