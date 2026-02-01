'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { schemaApi, pgApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import toast from 'react-hot-toast';
import {
  ChartBarIcon,
  PlusIcon,
  XMarkIcon,
  CheckCircleIcon,
  CreditCardIcon,
} from '@heroicons/react/24/outline';

export default function SchemasPage() {
  const { user } = useAuthStore();
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    defaultPayinRate: '',
    defaultPayoutRate: '',
  });
  const [creating, setCreating] = useState(false);

  const { data: schemasData, isLoading, refetch } = useQuery({
    queryKey: ['schemas'],
    queryFn: () => schemaApi.getSchemas(),
  });

  const { data: pgsData } = useQuery({
    queryKey: ['pgs'],
    queryFn: () => pgApi.getPGs(),
  });

  const schemas = schemasData?.data?.data || schemasData?.data || [];
  const pgs = pgsData?.data?.data || pgsData?.data || [];

  const handleCreateSchema = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setCreating(true);
      await schemaApi.createSchema({
        name: formData.name,
        description: formData.description,
        defaultPayinRate: parseFloat(formData.defaultPayinRate) || undefined,
        defaultPayoutRate: parseFloat(formData.defaultPayoutRate) || undefined,
      });
      toast.success('Schema created successfully!');
      setShowModal(false);
      setFormData({
        name: '',
        description: '',
        defaultPayinRate: '',
        defaultPayoutRate: '',
      });
      refetch();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create schema');
    } finally {
      setCreating(false);
    }
  };

  // Handle both array and object permissions
  const userPerms = Array.isArray(user?.permissions) ? user?.permissions[0] : user?.permissions;
  const canCreateSchema = user?.role === 'ADMIN' || userPerms?.canCreateSchema;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h1 className="text-2xl font-bold">Schemas</h1>
          <p className="text-white/50">Manage rate schemas for your users</p>
        </div>
        {canCreateSchema && (
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <PlusIcon className="w-5 h-5" />
            Create Schema
          </button>
        )}
      </div>

      {/* Schema Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
        </div>
      ) : schemas.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-12 text-center"
        >
          <ChartBarIcon className="w-16 h-16 mx-auto mb-4 text-white/20" />
          <h3 className="text-xl font-semibold mb-2">No Schemas Yet</h3>
          <p className="text-white/50 mb-4">Create your first schema to define custom rates for your users.</p>
          {canCreateSchema && (
            <button
              onClick={() => setShowModal(true)}
              className="btn-primary"
            >
              Create First Schema
            </button>
          )}
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {schemas.map((schema: any, index: number) => (
            <motion.div
              key={schema.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="glass rounded-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="p-6 bg-gradient-to-br from-primary-500/10 to-accent-500/10 border-b border-white/5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-500/20 flex items-center justify-center">
                    <ChartBarIcon className="w-5 h-5 text-primary-400" />
                  </div>
                  <div>
                    <h3 className="font-bold">{schema.name}</h3>
                    <p className="text-xs text-white/50">{schema._count?.users || 0} users</p>
                  </div>
                </div>
                {schema.description && (
                  <p className="text-sm text-white/60">{schema.description}</p>
                )}
              </div>

              {/* Default Rates */}
              <div className="p-6 space-y-4">
                <h4 className="text-sm font-medium text-white/50">Default Rates</h4>
                <div className="flex gap-4">
                  <div className="flex-1 bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-white/50 mb-1">Payin</p>
                    <p className="font-semibold text-emerald-400">
                      {schema.defaultPayinRate}%
                    </p>
                  </div>
                  <div className="flex-1 bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-white/50 mb-1">Payout</p>
                    <p className="font-semibold text-orange-400">
                      {schema.defaultPayoutRate}%
                    </p>
                  </div>
                </div>

                {/* PG Rates */}
                {schema.pgRates && schema.pgRates.length > 0 && (
                  <div className="pt-4 border-t border-white/5">
                    <h4 className="text-sm font-medium text-white/50 mb-3">PG-Specific Rates</h4>
                    <div className="space-y-2">
                      {schema.pgRates.slice(0, 3).map((rate: any) => (
                        <div key={rate.id} className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 text-white/70">
                            <CreditCardIcon className="w-4 h-4" />
                            {rate.paymentGateway?.name || 'Unknown'}
                          </span>
                          <div className="flex gap-3">
                            <span className="text-emerald-400">{rate.payinRate}%</span>
                            <span className="text-white/30">/</span>
                            <span className="text-orange-400">{rate.payoutRate}%</span>
                          </div>
                        </div>
                      ))}
                      {schema.pgRates.length > 3 && (
                        <p className="text-xs text-white/40">
                          +{schema.pgRates.length - 3} more rates
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Schema Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-lg"
          >
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <ChartBarIcon className="w-6 h-6 text-primary-400" />
                Create New Schema
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSchema} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Schema Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                  placeholder="e.g., Gold, Platinum, Enterprise"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                  placeholder="Describe this schema..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">Default Payin Rate (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.defaultPayinRate}
                    onChange={(e) => setFormData({ ...formData, defaultPayinRate: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                    placeholder="e.g., 1.5"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">Default Payout Rate (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.defaultPayoutRate}
                    onChange={(e) => setFormData({ ...formData, defaultPayoutRate: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                    placeholder="e.g., 1.0"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 btn-primary"
                >
                  {creating ? 'Creating...' : 'Create Schema'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

