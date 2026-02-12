import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { rateApi, pgApi } from '../lib/api';
import toast from 'react-hot-toast';

interface ChannelRate {
  channelId: string;
  channelName: string;
  channelCode: string;
  category: string;
  cardNetwork: string;
  cardType: string;
  currentRate: number;
  schemaRate: number;
  minRate: number;
  isCustomRate: boolean;
  assignedById?: string;
}

interface Props {
  userId: string;
  pgId: string;
  pgName: string;
  onClose: () => void;
}

export default function ChannelRateManager({ userId, pgId, pgName, onClose }: Props) {
  const queryClient = useQueryClient();
  const [rates, setRates] = useState<Record<string, number>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const { data: channelRates, isLoading } = useQuery<ChannelRate[]>({
    queryKey: ['channelRates', userId, pgId],
    queryFn: async () => {
      const res = await rateApi.getUserChannelRates(userId, pgId);
      return res.data.data;
    },
  });

  useEffect(() => {
    if (channelRates) {
      const initialRates: Record<string, number> = {};
      channelRates.forEach(cr => {
        initialRates[cr.channelId] = cr.currentRate;
      });
      setRates(initialRates);
    }
  }, [channelRates]);

  const bulkUpdateMutation = useMutation({
    mutationFn: async () => {
      const updates = Object.entries(rates)
        .filter(([channelId, rate]) => {
          const original = channelRates?.find(cr => cr.channelId === channelId);
          return original && rate !== original.currentRate;
        })
        .map(([channelId, payinRate]) => ({ channelId, payinRate }));

      if (updates.length === 0) {
        throw new Error('No changes to save');
      }

      return await rateApi.bulkUpdateChannelRates(userId, pgId, updates);
    },
    onSuccess: () => {
      toast.success('Channel rates updated successfully');
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ['channelRates', userId, pgId] });
      queryClient.invalidateQueries({ queryKey: ['childrenRates'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update rates');
    },
  });

  const handleRateChange = (channelId: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setRates(prev => ({ ...prev, [channelId]: numValue }));
    setHasChanges(true);
  };

  const handleSave = () => {
    bulkUpdateMutation.mutate();
  };

  const handleReset = () => {
    if (channelRates) {
      const initialRates: Record<string, number> = {};
      channelRates.forEach(cr => {
        initialRates[cr.channelId] = cr.currentRate;
      });
      setRates(initialRates);
      setHasChanges(false);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-[#1a1f2e] rounded-lg p-6 max-w-5xl w-full mx-4">
          <div className="text-center text-white">Loading channel rates...</div>
        </div>
      </div>
    );
  }

  const groupedChannels = channelRates?.reduce((acc, channel) => {
    const key = channel.category;
    if (!acc[key]) acc[key] = [];
    acc[key].push(channel);
    return acc;
  }, {} as Record<string, ChannelRate[]>);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto p-4">
      <div className="bg-[#1a1f2e] rounded-lg shadow-xl max-w-6xl w-full my-8">
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-white">
                Manage Channel Rates
              </h2>
              <p className="text-white/60 mt-1">
                {pgName} - Per channel rate configuration
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white/60 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {groupedChannels && Object.entries(groupedChannels).map(([category, channels]) => (
            <div key={category} className="mb-6">
              <h3 className="text-lg font-semibold text-white mb-3 pb-2 border-b border-white/10">
                {category}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {channels.map((channel) => {
                  const currentRate = rates[channel.channelId] || channel.currentRate;
                  const hasChanged = currentRate !== channel.currentRate;
                  const isBelowMin = currentRate < channel.minRate;

                  return (
                    <div
                      key={channel.channelId}
                      className={`p-4 rounded-lg border ${
                        hasChanged
                          ? 'border-blue-500 bg-blue-500/5'
                          : channel.isCustomRate
                          ? 'border-green-500/50 bg-green-500/5'
                          : 'border-white/10 bg-white/5'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <div className="font-medium text-white">{channel.channelName}</div>
                          <div className="text-sm text-white/60">
                            {channel.cardNetwork} - {channel.cardType}
                          </div>
                        </div>
                        {channel.isCustomRate && !hasChanged && (
                          <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">
                            Custom
                          </span>
                        )}
                        {hasChanged && (
                          <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">
                            Modified
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                        <div>
                          <span className="text-white/60">Schema Rate:</span>
                          <span className="text-white ml-1">{(channel.schemaRate * 100).toFixed(2)}%</span>
                        </div>
                        <div>
                          <span className="text-white/60">Min Rate:</span>
                          <span className="text-white ml-1">{(channel.minRate * 100).toFixed(2)}%</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.001"
                          min={channel.minRate}
                          max="0.1"
                          value={currentRate}
                          onChange={(e) => handleRateChange(channel.channelId, e.target.value)}
                          className={`flex-1 px-3 py-2 bg-black/20 border ${
                            isBelowMin ? 'border-red-500' : 'border-white/10'
                          } rounded text-white focus:outline-none focus:border-blue-500`}
                        />
                        <div className="text-white font-medium min-w-[80px] text-right">
                          = {(currentRate * 100).toFixed(2)}%
                        </div>
                      </div>

                      {isBelowMin && (
                        <div className="mt-2 text-xs text-red-400">
                          Rate cannot be below minimum ({(channel.minRate * 100).toFixed(2)}%)
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 bg-black/20 flex justify-between items-center">
          <div className="text-white/60 text-sm">
            {hasChanges ? (
              <span className="text-yellow-400">You have unsaved changes</span>
            ) : (
              <span>No changes made</span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleReset}
              disabled={!hasChanges}
              className="px-4 py-2 border border-white/20 rounded hover:bg-white/5 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Reset
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 border border-white/20 rounded hover:bg-white/5 text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges || bulkUpdateMutation.isPending}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {bulkUpdateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
