import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pgApi } from '../lib/api';
import toast from 'react-hot-toast';

interface PGWithBaseRate {
  id: string;
  name: string;
  code: string;
  baseRate: number;
  isActive: boolean;
}

export default function PGBaseRateManager() {
  const queryClient = useQueryClient();
  const [editingPG, setEditingPG] = useState<string | null>(null);
  const [baseRates, setBaseRates] = useState<Record<string, number>>({});

  const { data: pgs, isLoading } = useQuery<PGWithBaseRate[]>({
    queryKey: ['pgs'],
    queryFn: async () => {
      const res = await pgApi.getPGs();
      return res.data.data;
    },
  });

  const updateBaseRateMutation = useMutation({
    mutationFn: async ({ pgId, baseRate }: { pgId: string; baseRate: number }) => {
      return await pgApi.updateBaseRate(pgId, baseRate);
    },
    onSuccess: (_, variables) => {
      const pg = pgs?.find(p => p.id === variables.pgId);
      toast.success(`Base rate updated for ${pg?.name}`);
      setEditingPG(null);
      queryClient.invalidateQueries({ queryKey: ['pgs'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update base rate');
    },
  });

  const handleEditClick = (pgId: string, currentRate: number) => {
    setEditingPG(pgId);
    setBaseRates(prev => ({ ...prev, [pgId]: currentRate }));
  };

  const handleSave = (pgId: string) => {
    const newRate = baseRates[pgId];
    if (newRate !== undefined && newRate >= 0 && newRate <= 0.1) {
      updateBaseRateMutation.mutate({ pgId, baseRate: newRate });
    } else {
      toast.error('Base rate must be between 0% and 10%');
    }
  };

  const handleCancel = () => {
    setEditingPG(null);
    setBaseRates({});
  };

  if (isLoading) {
    return (
      <div className="bg-[#1a1f2e] rounded-lg shadow-lg p-6">
        <div className="text-white/60">Loading payment gateways...</div>
      </div>
    );
  }

  return (
    <div className="bg-[#1a1f2e] rounded-lg shadow-lg">
      <div className="p-6 border-b border-white/10">
        <h2 className="text-2xl font-bold text-white">Payment Gateway Base Rates</h2>
        <p className="text-white/60 mt-1">
          Set the minimum base rate for each payment gateway (applicable to normal cards)
        </p>
      </div>

      <div className="p-6">
        <div className="grid gap-4">
          {pgs?.map((pg) => {
            const isEditing = editingPG === pg.id;
            const currentRate = isEditing
              ? baseRates[pg.id] ?? pg.baseRate
              : pg.baseRate;

            return (
              <div
                key={pg.id}
                className={`p-4 rounded-lg border ${
                  isEditing
                    ? 'border-blue-500 bg-blue-500/5'
                    : 'border-white/10 bg-white/5'
                } transition-colors`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-white">{pg.name}</h3>
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          pg.isActive
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {pg.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="text-sm text-white/60 mt-1">Code: {pg.code}</div>
                  </div>

                  <div className="flex items-center gap-4">
                    {isEditing ? (
                      <>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.0001"
                            min="0"
                            max="0.1"
                            value={currentRate}
                            onChange={(e) =>
                              setBaseRates(prev => ({
                                ...prev,
                                [pg.id]: parseFloat(e.target.value) || 0,
                              }))
                            }
                            className="w-28 px-3 py-2 bg-black/20 border border-white/10 rounded text-white text-right focus:outline-none focus:border-blue-500"
                          />
                          <div className="text-white font-medium min-w-[80px]">
                            = {(currentRate * 100).toFixed(3)}%
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSave(pg.id)}
                            disabled={updateBaseRateMutation.isPending}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white text-sm font-medium disabled:opacity-50 transition-colors"
                          >
                            {updateBaseRateMutation.isPending ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={handleCancel}
                            disabled={updateBaseRateMutation.isPending}
                            className="px-4 py-2 border border-white/20 rounded text-white text-sm hover:bg-white/5 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-white">
                            {(pg.baseRate * 100).toFixed(3)}%
                          </div>
                          <div className="text-xs text-white/60">Base Rate</div>
                        </div>
                        <button
                          onClick={() => handleEditClick(pg.id, pg.baseRate)}
                          className="px-4 py-2 border border-blue-500 text-blue-400 rounded hover:bg-blue-500/10 text-sm font-medium transition-colors"
                        >
                          Edit Rate
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-white/10">
                  <div className="text-sm text-white/60">
                    <span className="font-medium text-white/80">Note:</span> This base rate
                    applies to normal cards (VISA/Master/RuPay). Other channels use
                    schema-defined rates.
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
