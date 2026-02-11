// NEW SCHEMA RATES MODAL - Transaction Channel Based
// This replaces the old PG-based rate system
// Replace the SchemaRatesModal function in AdminDashboard.tsx (lines 3244-3633) with this code

function SchemaRatesModal({ schema, allPGs, onClose }: { schema: any; allPGs: any[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [selectedPG, setSelectedPG] = useState<any>(null);
  const [view, setView] = useState<'pg-list' | 'channels' | 'payout'>('pg-list');
  const [editingChannel, setEditingChannel] = useState<any>(null);
  const [channelRateInput, setChannelRateInput] = useState('');
  
  // Payout configuration states
  const [payoutChargeType, setPayoutChargeType] = useState<'PERCENTAGE' | 'SLAB'>('SLAB');
  const [payoutRate, setPayoutRate] = useState('');
  const [slabs, setSlabs] = useState<Array<{ minAmount: string; maxAmount: string; flatFee: string }>>([
    { minAmount: '0', maxAmount: '5000', flatFee: '10' },
  ]);

  // Fetch all channels for the selected PG
  const { data: channels, isLoading: channelsLoading } = useQuery({
    queryKey: ['channels', selectedPG?.id],
    queryFn: async () => {
      if (!selectedPG) return [];
      const response = await fetch(
        `http://localhost:4100/api/admin/channels?pgId=${selectedPG.id}`,
        { credentials: 'include' }
      );
      if (!response.ok) throw new Error('Failed to fetch channels');
      const result = await response.json();
      return result.data.channels || [];
    },
    enabled: !!selectedPG,
  });

  // Fetch schema payin rates
  const { data: schemaRatesData, refetch: refetchRates } = useQuery({
    queryKey: ['schema-rates', schema.id],
    queryFn: async () => {
      const response = await fetch(
        `http://localhost:4100/api/admin/channels/schemas/${schema.id}/payin-rates`,
        { credentials: 'include' }
      );
      if (!response.ok) throw new Error('Failed to fetch schema rates');
      const result = await response.json();
      return result.data || {};
    },
  });

  // Fetch payout config
  const { data: payoutConfig, refetch: refetchPayout } = useQuery({
    queryKey: ['schema-payout', schema.id, selectedPG?.id],
    queryFn: async () => {
      if (!selectedPG) return null;
      const response = await fetch(
        `http://localhost:4100/api/admin/channels/schemas/${schema.id}/payout-config/${selectedPG.id}`,
        { credentials: 'include' }
      );
      if (!response.ok) return null;
      const result = await response.json();
      return result.data;
    },
    enabled: !!selectedPG,
  });

  // Initialize payout form when payout config loads
  useEffect(() => {
    if (payoutConfig) {
      setPayoutChargeType(payoutConfig.chargeType || 'SLAB');
      if (payoutConfig.chargeType === 'PERCENTAGE') {
        setPayoutRate((payoutConfig.payoutRate * 100).toString());
      }
      if (payoutConfig.slabs && payoutConfig.slabs.length > 0) {
        setSlabs(payoutConfig.slabs.map((s: any) => ({
          minAmount: s.minAmount.toString(),
          maxAmount: s.maxAmount ? s.maxAmount.toString() : '',
          flatFee: s.flatCharge.toString(),
        })));
      }
    }
  }, [payoutConfig]);

  // Mutation for setting channel payin rate
  const setRateMutation = useMutation({
    mutationFn: async ({ channelId, rate }: { channelId: string; rate: number }) => {
      const response = await fetch(
        `http://localhost:4100/api/admin/channels/schemas/${schema.id}/payin-rates`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ channelId, payinRate: rate / 100 }),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to set rate');
      }
      return response.json();
    },
    onSuccess: () => {
      refetchRates();
      queryClient.invalidateQueries({ queryKey: ['admin-schemas'] });
      setEditingChannel(null);
      setChannelRateInput('');
      toast.success('Channel rate updated!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to set rate');
    },
  });

  // Mutation for setting payout config
  const setPayoutMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `http://localhost:4100/api/admin/channels/schemas/${schema.id}/payout-config`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            pgId: selectedPG.id,
            chargeType: payoutChargeType,
            payoutRate: payoutChargeType === 'PERCENTAGE' ? parseFloat(payoutRate) / 100 : null,
            slabs: payoutChargeType === 'SLAB' ? slabs.map(s => ({
              minAmount: parseFloat(s.minAmount) || 0,
              maxAmount: s.maxAmount ? parseFloat(s.maxAmount) : null,
              flatCharge: parseFloat(s.flatFee) || 0,
            })) : [],
          }),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to set payout config');
      }
      return response.json();
    },
    onSuccess: () => {
      refetchPayout();
      queryClient.invalidateQueries({ queryKey: ['admin-schemas'] });
      toast.success('Payout configuration updated!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to set payout config');
    },
  });

  // Helper functions
  const addSlab = () => {
    const lastSlab = slabs[slabs.length - 1];
    const newMin = lastSlab.maxAmount ? (parseFloat(lastSlab.maxAmount) + 0.01).toString() : '0';
    setSlabs([...slabs, { minAmount: newMin, maxAmount: '', flatFee: '10' }]);
  };

  const removeSlab = (index: number) => {
    setSlabs(slabs.filter((_, i) => i !== index));
  };

  const updateSlab = (index: number, field: string, value: string) => {
    const newSlabs = [...slabs];
    newSlabs[index] = { ...newSlabs[index], [field]: value };
    setSlabs(newSlabs);
  };

  const handleSaveChannelRate = () => {
    if (!editingChannel || !channelRateInput) {
      toast.error('Please enter a valid rate');
      return;
    }
    const rate = parseFloat(channelRateInput);
    if (rate < 0) {
      toast.error('Rate must be positive');
      return;
    }
    setRateMutation.mutate({ channelId: editingChannel.id, rate });
  };

  const handleSavePayoutConfig = () => {
    if (payoutChargeType === 'PERCENTAGE' && (!payoutRate || parseFloat(payoutRate) < 0)) {
      toast.error('Please enter a valid payout rate');
      return;
    }
    if (payoutChargeType === 'SLAB' && slabs.length === 0) {
      toast.error('Please add at least one slab');
      return;
    }
    setPayoutMutation.mutate();
  };

  // Get current rate for a channel
  const getChannelRate = (channelId: string) => {
    if (!schemaRatesData?.rates) return null;
    const rateConfig = schemaRatesData.rates.find((r: any) => r.channelId === channelId);
    return rateConfig ? (rateConfig.payinRate * 100).toFixed(2) : null;
  };

  // Group channels by category
  const groupedChannels = channels?.reduce((acc: any, channel: any) => {
    const category = channel.category || 'Other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(channel);
    return acc;
  }, {}) || {};

  // Count configured payin channels for a PG
  const getConfiguredPayinCount = (pgId: string) => {
    if (!schemaRatesData?.rates) return 0;
    const pgChannels = channels?.filter((c: any) => c.pgId === pgId && c.type === 'PAYIN') || [];
    const configuredChannels = pgChannels.filter((c: any) => 
      schemaRatesData.rates.some((r: any) => r.channelId === c.id)
    );
    return configuredChannels.length;
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <motion.div 
        className="bg-[#1a1a2e] rounded-2xl p-6 w-full max-w-4xl border border-white/10 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold">Configure Channel Rates</h3>
            <p className="text-white/60 text-sm mt-1">
              {selectedPG ? `${selectedPG.name} • ` : ''}{schema.name} Schema
            </p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {view === 'pg-list' ? (
          // PG Selection View
          <div>
            <p className="text-white/60 mb-4">Select a Payment Gateway to configure channel rates:</p>
            <div className="grid gap-3">
              {allPGs.map((pg) => {
                const payinCount = channels?.filter((c: any) => c.pgId === pg.id && c.type === 'PAYIN').length || 0;
                const payoutCount = channels?.filter((c: any) => c.pgId === pg.id && c.type === 'PAYOUT').length || 0;
                const configuredPayin = getConfiguredPayinCount(pg.id);
                
                return (
                  <div
                    key={pg.id}
                    className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="font-semibold">{pg.name}</h4>
                        <p className="text-xs text-white/40 font-mono mt-0.5">{pg.code}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => {
                          setSelectedPG(pg);
                          setView('channels');
                        }}
                        className="bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg p-3 text-left transition-all"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-emerald-400">PAYIN Channels</span>
                          <span className="text-xs text-emerald-400/60">{configuredPayin}/{payinCount}</span>
                        </div>
                        <p className="text-xs text-white/40">Configure payin rates per channel</p>
                      </button>
                      
                      <button
                        onClick={() => {
                          setSelectedPG(pg);
                          setView('payout');
                        }}
                        className="bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg p-3 text-left transition-all"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-blue-400">PAYOUT Config</span>
                          <span className="text-xs text-blue-400/60">{payoutCount} channels</span>
                        </div>
                        <p className="text-xs text-white/40">Configure payout slabs</p>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : view === 'channels' ? (
          // Channel Configuration View
          <div className="space-y-6">
            <button 
              onClick={() => {
                setView('pg-list');
                setSelectedPG(null);
              }} 
              className="flex items-center gap-2 text-white/60 hover:text-white"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              Back to gateways
            </button>

            <div className="bg-white/5 rounded-xl p-4">
              <h3 className="font-semibold text-lg mb-1">{selectedPG.name} - PAYIN Channels</h3>
              <p className="text-xs text-white/40">Configure rates for each transaction channel</p>
            </div>

            {channelsLoading ? (
              <div className="text-center py-8 text-white/40">Loading channels...</div>
            ) : (
              <div className="space-y-4">
                {Object.entries(groupedChannels)
                  .filter(([_, channels]: any) => channels.some((c: any) => c.type === 'PAYIN'))
                  .map(([category, categoryChannels]: any) => {
                    const payinChannels = categoryChannels.filter((c: any) => c.type === 'PAYIN');
                    if (payinChannels.length === 0) return null;

                    return (
                      <div key={category} className="bg-white/5 rounded-xl p-4">
                        <h4 className="font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                          {category}
                          <span className="text-xs text-white/40 font-normal">({payinChannels.length} channels)</span>
                        </h4>
                        <div className="space-y-2">
                          {payinChannels.map((channel: any) => {
                            const currentRate = getChannelRate(channel.id);
                            const baseCost = (channel.baseCost * 100).toFixed(2);
                            const isEditing = editingChannel?.id === channel.id;

                            return (
                              <div
                                key={channel.id}
                                className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-all"
                              >
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{channel.name}</span>
                                    <span className="text-xs text-white/40 font-mono">{channel.code}</span>
                                  </div>
                                  <p className="text-xs text-white/40 mt-0.5">
                                    Base Cost: {baseCost}%
                                  </p>
                                </div>

                                {isEditing ? (
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={channelRateInput}
                                      onChange={(e) => setChannelRateInput(e.target.value)}
                                      className="w-24 px-3 py-1.5 bg-white/10 border border-white/20 rounded text-right"
                                      placeholder="0.00"
                                      autoFocus
                                    />
                                    <span className="text-white/60">%</span>
                                    <button
                                      onClick={handleSaveChannelRate}
                                      disabled={setRateMutation.isPending}
                                      className="px-3 py-1.5 bg-emerald-500 text-white rounded text-sm hover:bg-emerald-600 disabled:opacity-50"
                                    >
                                      {setRateMutation.isPending ? 'Saving...' : 'Save'}
                                    </button>
                                    <button
                                      onClick={() => {
                                        setEditingChannel(null);
                                        setChannelRateInput('');
                                      }}
                                      className="px-3 py-1.5 bg-white/10 text-white/60 rounded text-sm hover:bg-white/20"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-4">
                                    <div className="text-right">
                                      <p className="text-xs text-white/50">Current Rate</p>
                                      <p className="font-mono text-lg text-emerald-400">
                                        {currentRate ? `${currentRate}%` : 'Not Set'}
                                      </p>
                                    </div>
                                    <button
                                      onClick={() => {
                                        setEditingChannel(channel);
                                        setChannelRateInput(currentRate || baseCost);
                                      }}
                                      className="p-2 hover:bg-white/10 rounded transition-all"
                                    >
                                      <PencilIcon className="w-4 h-4 text-white/60" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        ) : (
          // Payout Configuration View
          <div className="space-y-6">
            <button 
              onClick={() => {
                setView('pg-list');
                setSelectedPG(null);
              }} 
              className="flex items-center gap-2 text-white/60 hover:text-white"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              Back to gateways
            </button>

            <div className="bg-white/5 rounded-xl p-4">
              <h3 className="font-semibold text-lg mb-1">{selectedPG.name} - PAYOUT Configuration</h3>
              <p className="text-xs text-white/40">Configure payout charges for this gateway</p>
            </div>

            <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
              <h4 className="font-semibold text-blue-400 mb-4">Payout Charges</h4>
              
              <div className="flex items-center gap-4 mb-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="payoutType"
                    checked={payoutChargeType === 'SLAB'}
                    onChange={() => setPayoutChargeType('SLAB')}
                    className="w-4 h-4"
                  />
                  <span>Slab-based (Flat Fee)</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="payoutType"
                    checked={payoutChargeType === 'PERCENTAGE'}
                    onChange={() => setPayoutChargeType('PERCENTAGE')}
                    className="w-4 h-4"
                  />
                  <span>Percentage-based</span>
                </label>
              </div>

              {payoutChargeType === 'PERCENTAGE' ? (
                <div className="flex items-end gap-4">
                  <div className="flex-1">
                    <label className="block text-sm text-white/60 mb-1">Payout Rate (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={payoutRate}
                      onChange={(e) => setPayoutRate(e.target.value)}
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg"
                      placeholder="e.g., 1.5"
                    />
                  </div>
                  <button
                    onClick={handleSavePayoutConfig}
                    disabled={setPayoutMutation.isPending}
                    className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                  >
                    {setPayoutMutation.isPending ? 'Saving...' : 'Save'}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-white/50">
                    Configure flat fee charges based on transaction amount ranges.
                  </p>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="text-left py-2 text-white/50">Min Amount (₹)</th>
                          <th className="text-left py-2 text-white/50">Max Amount (₹)</th>
                          <th className="text-left py-2 text-white/50">Flat Fee (₹)</th>
                          <th className="py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {slabs.map((slab, idx) => (
                          <tr key={idx} className="border-b border-white/5">
                            <td className="py-2">
                              <input
                                type="number"
                                value={slab.minAmount}
                                onChange={(e) => updateSlab(idx, 'minAmount', e.target.value)}
                                className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded"
                                placeholder="0"
                              />
                            </td>
                            <td className="py-2">
                              <input
                                type="number"
                                value={slab.maxAmount}
                                onChange={(e) => updateSlab(idx, 'maxAmount', e.target.value)}
                                className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded"
                                placeholder="Unlimited"
                              />
                            </td>
                            <td className="py-2">
                              <input
                                type="number"
                                value={slab.flatFee}
                                onChange={(e) => updateSlab(idx, 'flatFee', e.target.value)}
                                className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded"
                                placeholder="10"
                              />
                            </td>
                            <td className="py-2">
                              {slabs.length > 1 && (
                                <button
                                  onClick={() => removeSlab(idx)}
                                  className="p-1 text-red-400 hover:bg-red-500/10 rounded"
                                >
                                  <XMarkIcon className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between">
                    <button
                      onClick={addSlab}
                      className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
                    >
                      <PlusIcon className="w-4 h-4" />
                      Add Slab
                    </button>
                    <button
                      onClick={handleSavePayoutConfig}
                      disabled={setPayoutMutation.isPending}
                      className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                    >
                      {setPayoutMutation.isPending ? 'Saving...' : 'Save Payout Config'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end pt-4 mt-6 border-t border-white/5">
          <button onClick={onClose} className="btn-secondary">
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}
