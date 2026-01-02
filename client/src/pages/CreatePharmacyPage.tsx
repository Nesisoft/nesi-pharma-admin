import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api, { getErrorMessage } from '@/lib/api';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import toast from 'react-hot-toast';
import { ArrowLeftIcon, BuildingStorefrontIcon } from '@heroicons/react/24/outline';

export default function CreatePharmacyPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    region: '',
    country: 'Ghana',
    registrationNumber: '',
    status: 'ACTIVE',
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await api.post('/pharmacies', data);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success('Pharmacy created successfully!');
      queryClient.invalidateQueries({ queryKey: ['pharmacies'] });
      navigate(`/pharmacies/${data.data.id}`);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Pharmacy name is required');
      return;
    }

    if (!formData.email.trim()) {
      toast.error('Email is required');
      return;
    }

    createMutation.mutate(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const regions = [
    'Greater Accra',
    'Ashanti',
    'Western',
    'Central',
    'Eastern',
    'Northern',
    'Upper East',
    'Upper West',
    'Volta',
    'Bono',
    'Bono East',
    'Ahafo',
    'Western North',
    'Oti',
    'North East',
    'Savannah',
  ];

  const countries = [
    'Ghana',
    'Nigeria',
    'South Africa',
    'Kenya',
    'Tanzania',
    'Uganda',
    'Rwanda',
    'Ethiopia',
    'Cameroon',
    'Ivory Coast',
    'Senegal',
    'Togo',
    'Benin',
    'Burkina Faso',
    'Mali',
    'Niger',
    'Guinea',
    'Sierra Leone',
    'Liberia',
    'Gambia',
    'Egypt',
    'Morocco',
    'Algeria',
    'Tunisia',
    'Libya',
    'Sudan',
    'Zimbabwe',
    'Zambia',
    'Botswana',
    'Namibia',
    'Mozambique',
    'Angola',
    'Democratic Republic of Congo',
    'Republic of Congo',
    'Gabon',
    'Equatorial Guinea',
    'Central African Republic',
    'Chad',
    'Mauritania',
    'Somalia',
    'Djibouti',
    'Eritrea',
    'South Sudan',
    'Malawi',
    'Madagascar',
    'Mauritius',
    'Seychelles',
    'Comoros',
    'Cape Verde',
    'Sao Tome and Principe',
    'Eswatini',
    'Lesotho',
  ];

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
          <h1 className="text-2xl font-bold text-gray-900">Add New Pharmacy</h1>
          <p className="mt-1 text-sm text-gray-500">
            Register a new pharmacy in the system
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="card-header">
              <h2 className="text-lg font-medium text-gray-900">Pharmacy Information</h2>
            </div>
            <form onSubmit={handleSubmit} className="card-body space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label htmlFor="name" className="label">
                    Pharmacy Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="input"
                    placeholder="Enter pharmacy name"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="email" className="label">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="input"
                    placeholder="pharmacy@example.com"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="label">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="input"
                    placeholder="0201234567"
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <label htmlFor="address" className="label">
                  Address
                </label>
                <textarea
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  rows={2}
                  className="input"
                  placeholder="Street address"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="city" className="label">
                    City
                  </label>
                  <input
                    type="text"
                    id="city"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    className="input"
                    placeholder="City"
                  />
                </div>

                <div>
                  <label htmlFor="region" className="label">
                    Region
                  </label>
                  <select
                    id="region"
                    name="region"
                    value={formData.region}
                    onChange={handleChange}
                    className="input"
                  >
                    <option value="">Select region</option>
                    {regions.map((region) => (
                      <option key={region} value={region}>
                        {region}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="country" className="label">
                    Country
                  </label>
                  <select
                    id="country"
                    name="country"
                    value={formData.country}
                    onChange={handleChange}
                    className="input"
                  >
                    {countries.map((country) => (
                      <option key={country} value={country}>
                        {country}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Registration */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="registrationNumber" className="label">
                    Registration Number
                  </label>
                  <input
                    type="text"
                    id="registrationNumber"
                    name="registrationNumber"
                    value={formData.registrationNumber}
                    onChange={handleChange}
                    className="input"
                    placeholder="Pharmacy Council registration number"
                  />
                </div>

                <div>
                  <label htmlFor="status" className="label">
                    Initial Status
                  </label>
                  <select
                    id="status"
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="input"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="PENDING">Pending</option>
                  </select>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-4 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="btn btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="btn btn-primary flex-1"
                >
                  {createMutation.isPending ? (
                    <>
                      <LoadingSpinner size="sm" className="mr-2" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <BuildingStorefrontIcon className="h-5 w-5 mr-2" />
                      Create Pharmacy
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900">Tips</h3>
            </div>
            <div className="card-body">
              <ul className="space-y-3 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-primary-600 font-bold">•</span>
                  <span>The email address will be used for license activation notifications</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-600 font-bold">•</span>
                  <span>Registration number should match the official Pharmacy Council records</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-600 font-bold">•</span>
                  <span>You can assign a license to this pharmacy after creation</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900">Status Options</h3>
            </div>
            <div className="card-body">
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="font-medium text-gray-900">Active</dt>
                  <dd className="text-gray-500">Pharmacy can use assigned licenses immediately</dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-900">Pending</dt>
                  <dd className="text-gray-500">Pharmacy needs verification before activation</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
