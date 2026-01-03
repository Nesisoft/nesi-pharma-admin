import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import api, { getErrorMessage } from '@/lib/api';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import toast from 'react-hot-toast';
import { ArrowLeftIcon, KeyIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface Pharmacy {
  id: string;
  name: string;
  email: string;
}

interface TierConfig {
  id: string;
  code: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  durationDays: number;
  maxUsers: number | null;
  maxBranches: number | null;
  maxActivations: number | null;
  color: string | null;
  isActive: boolean;
}

const tierColors: Record<string, string> = {
  STANDARD: 'border-blue-500 bg-blue-50',
  PROFESSIONAL: 'border-green-500 bg-green-50',
  ENTERPRISE: 'border-purple-500 bg-purple-50',
};

export default function GenerateLicensePage() {
  const navigate = useNavigate();
  const [selectedTierCode, setSelectedTierCode] = useState<string>('STANDARD');
  const [pharmacyId, setPharmacyId] = useState('');
  const [durationDays, setDurationDays] = useState(365);
  const [maxActivations, setMaxActivations] = useState(1);
  const [notes, setNotes] = useState('');
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkCount, setBulkCount] = useState(5);
  const [generatedLicenses, setGeneratedLicenses] = useState<{ id: string; licenseKey: string; tier: string }[]>([]);

  // Fetch tier configurations from API
  const { data: tierConfigs, isLoading: tiersLoading } = useQuery<TierConfig[]>({
    queryKey: ['tier-configs'],
    queryFn: async () => {
      const response = await api.get('/tier-configs');
      return response.data.data;
    },
  });

  const { data: pharmacies } = useQuery<Pharmacy[]>({
    queryKey: ['pharmacies-list'],
    queryFn: async () => {
      const response = await api.get('/pharmacies?limit=100');
      return response.data.data;
    },
  });

  // Update defaults when tier changes
  useEffect(() => {
    if (tierConfigs) {
      const selectedTier = tierConfigs.find((t) => t.code === selectedTierCode);
      if (selectedTier) {
        setDurationDays(selectedTier.durationDays || 365);
        setMaxActivations(selectedTier.maxActivations || 1);
      }
    }
  }, [selectedTierCode, tierConfigs]);

  const generateMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const endpoint = bulkMode ? '/licenses/generate-bulk' : '/licenses/generate';
      const response = await api.post(endpoint, data);
      return response.data;
    },
    onSuccess: (data) => {
      if (bulkMode) {
        setGeneratedLicenses(data.data.licenses);
        toast.success(`Generated ${data.data.count} licenses!`);
      } else {
        setGeneratedLicenses([{
          id: data.data.id,
          licenseKey: data.data.licenseKey,
          tier: data.data.tier,
        }]);
        toast.success('License generated successfully!');
      }
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const data: Record<string, unknown> = {
      tier: selectedTierCode,
      tierCode: selectedTierCode,
      durationDays,
      maxActivations,
      notes: notes || undefined,
    };

    if (bulkMode) {
      data.count = bulkCount;
    } else if (pharmacyId) {
      data.pharmacyId = pharmacyId;
    }

    generateMutation.mutate(data);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const copyAllLicenses = () => {
    const text = generatedLicenses.map((l) => l.licenseKey).join('\n');
    navigator.clipboard.writeText(text);
    toast.success('All licenses copied!');
  };

  // Filter to only show paid tiers (not BASIC)
  const paidTiers = tierConfigs?.filter((t) => t.code !== 'BASIC' && t.isActive) || [];

  const formatPrice = (price: number, currency: string) => {
    return `${currency} ${price.toLocaleString()}/year`;
  };

  const formatLimit = (value: number | null) => {
    if (value === null || value === -1) return 'Unlimited';
    return value.toString();
  };

  if (tiersLoading) {
    return <div className="flex items-center justify-center h-64"><LoadingSpinner size="lg" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeftIcon className="h-5 w-5 text-gray-500" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Generate License</h1>
          <p className="mt-1 text-sm text-gray-500">
            Create new license keys for pharmacies
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-medium text-gray-900">License Details</h2>
          </div>
          <form onSubmit={handleSubmit} className="card-body space-y-6">
            {/* Bulk Mode Toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Bulk Generation</p>
                <p className="text-sm text-gray-500">Generate multiple licenses at once</p>
              </div>
              <button
                type="button"
                onClick={() => setBulkMode(!bulkMode)}
                className={clsx(
                  'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                  bulkMode ? 'bg-primary-600' : 'bg-gray-200'
                )}
              >
                <span
                  className={clsx(
                    'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                    bulkMode ? 'translate-x-5' : 'translate-x-0'
                  )}
                />
              </button>
            </div>

            {/* Tier Selection - Dynamic from API */}
            <div>
              <label className="label">License Tier</label>
              <div className="grid grid-cols-1 gap-3 mt-2">
                {paidTiers.map((t) => (
                  <button
                    key={t.code}
                    type="button"
                    onClick={() => setSelectedTierCode(t.code)}
                    className={clsx(
                      'p-4 rounded-lg border-2 text-left transition-colors',
                      selectedTierCode === t.code
                        ? (t.color ? `border-2` : tierColors[t.code] || 'border-gray-500 bg-gray-50')
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                    style={selectedTierCode === t.code && t.color ? { borderColor: t.color, backgroundColor: `${t.color}10` } : {}}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900">{t.name}</p>
                        <p className="text-sm text-gray-500">{t.description}</p>
                        <div className="mt-2 flex gap-4 text-xs text-gray-500">
                          <span>Branches: {formatLimit(t.maxBranches)}</span>
                          <span>Users: {formatLimit(t.maxUsers)}</span>
                          <span>Activations: {formatLimit(t.maxActivations)}</span>
                        </div>
                      </div>
                      <span className="text-sm font-medium text-gray-900">{formatPrice(t.price, t.currency)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Bulk Count */}
            {bulkMode && (
              <div>
                <label className="label">Number of Licenses</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={bulkCount}
                  onChange={(e) => setBulkCount(parseInt(e.target.value) || 1)}
                  className="input"
                />
                <p className="mt-1 text-sm text-gray-500">Maximum 100 licenses per batch</p>
              </div>
            )}

            {/* Pharmacy Selection (single mode only) */}
            {!bulkMode && (
              <div>
                <label className="label">Assign to Pharmacy (Optional)</label>
                <select
                  value={pharmacyId}
                  onChange={(e) => setPharmacyId(e.target.value)}
                  className="input"
                >
                  <option value="">No assignment (generate unassigned)</option>
                  {pharmacies?.map((pharmacy) => (
                    <option key={pharmacy.id} value={pharmacy.id}>
                      {pharmacy.name} ({pharmacy.email})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Duration */}
            <div>
              <label className="label">License Duration (Days)</label>
              <input
                type="number"
                min={30}
                max={3650}
                value={durationDays}
                onChange={(e) => setDurationDays(parseInt(e.target.value) || 365)}
                className="input"
              />
              <p className="mt-1 text-sm text-gray-500">Default from tier configuration</p>
            </div>

            {/* Max Activations */}
            <div>
              <label className="label">Maximum Activations</label>
              <input
                type="number"
                min={1}
                max={100}
                value={maxActivations}
                onChange={(e) => setMaxActivations(parseInt(e.target.value) || 1)}
                className="input"
              />
              <p className="mt-1 text-sm text-gray-500">
                Default from tier: {tierConfigs?.find((t) => t.code === selectedTierCode)?.maxActivations || 1} activations
              </p>
            </div>

            {/* Notes */}
            <div>
              <label className="label">Notes (Optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="input"
                placeholder="Internal notes about this license..."
              />
            </div>

            <button
              type="submit"
              disabled={generateMutation.isPending}
              className="btn btn-primary w-full py-3"
            >
              {generateMutation.isPending ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Generating...
                </>
              ) : (
                <>
                  <KeyIcon className="h-5 w-5 mr-2" />
                  Generate {bulkMode ? `${bulkCount} Licenses` : 'License'}
                </>
              )}
            </button>
          </form>
        </div>

        {/* Generated Licenses */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">Generated Licenses</h2>
            {generatedLicenses.length > 1 && (
              <button
                onClick={copyAllLicenses}
                className="btn btn-secondary text-sm"
              >
                <ClipboardDocumentIcon className="h-4 w-4 mr-1" />
                Copy All
              </button>
            )}
          </div>
          <div className="card-body">
            {generatedLicenses.length === 0 ? (
              <div className="text-center py-12">
                <KeyIcon className="mx-auto h-12 w-12 text-gray-300" />
                <p className="mt-4 text-gray-500">
                  Generated licenses will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {generatedLicenses.map((license) => (
                  <div
                    key={license.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <code className="text-sm font-mono font-medium">
                        {license.licenseKey}
                      </code>
                      <p className="text-xs text-gray-500 mt-1">{license.tier}</p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(license.licenseKey)}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded"
                    >
                      <ClipboardDocumentIcon className="h-5 w-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
