'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { rateApi, userApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import toast from 'react-hot-toast';

interface PGRate {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  supportedTypes: string;
  minPayinRate: number;
  minPayoutRate: number;
}

interface ChildUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  businessName: string;
  rates: Array<{
    id: string;
    pgId: string;
    payinRate: number;
    payoutRate: number;
    isEnabled: boolean;
    paymentGateway: {
      id: string;
      name: string;
      code: string;
    };
  }>;
}

export default function RateManagementPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedPG, setSelectedPG] = useState<PGRate | null>(null);
  const [payinRate, setPayinRate] = useState('');
  const [payoutRate, setPayoutRate] = useState('');

  // Check if user can assign rates (WL, MD, or Admin)
  const canAssignRates = user?.role === 'ADMIN' || user?.role === 'WHITE_LABEL' || user?.role === 'MASTER_DISTRIBUTOR';

  // Fetch my rates
  const { data: myRates, isLoading: myRatesLoading } = useQuery({
    queryKey: ['my-rates'],
    queryFn: () => rateApi.getMyRates(),
  });

  // Fetch available PGs for assignment
  const { data: availablePGs, isLoading: pgsLoading } = useQuery({
    queryKey: ['available-pgs-for-assignment'],
    queryFn: () => rateApi.getAvailablePGsForAssignment(),
    enabled: canAssignRates,
  });

  // Fetch children with their rates
  const { data: childrenData, isLoading: childrenLoading, refetch: refetchChildren } = useQuery({
    queryKey: ['children-rates'],
    queryFn: () => rateApi.getChildrenRates(),
    enabled: canAssignRates,
  });

  const myRatesData = myRates?.data?.data || [];
  const pgsData: PGRate[] = availablePGs?.data?.data || [];
  const children: ChildUser[] = childrenData?.data?.data || [];

  // Assign rate mutation
  const assignMutation = useMutation({
    mutationFn: ({ targetUserId, pgId, payinRate, payoutRate }: { targetUserId: string; pgId: string; payinRate: number; payoutRate: number }) =>
      rateApi.assignRate(targetUserId, pgId, payinRate, payoutRate),
    onSuccess: () => {
      toast.success('Rate assigned successfully!');
      queryClient.invalidateQueries({ queryKey: ['children-rates'] });
      setShowAssignModal(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to assign rate');
    },
  });

  const resetForm = () => {
    setSelectedPG(null);
    setPayinRate('');
    setPayoutRate('');
  };

  const openAssignModal = (childId: string, pg?: PGRate, existingRate?: any) => {
    setSelectedChild(childId);
    if (pg) {
      setSelectedPG(pg);
      setPayinRate(existingRate?.payinRate ? (existingRate.payinRate * 100).toString() : (pg.minPayinRate * 100).toString());
      setPayoutRate(existingRate?.payoutRate ? (existingRate.payoutRate * 100).toString() : (pg.minPayoutRate * 100).toString());
    }
    setShowAssignModal(true);
  };

  const handleAssign = () => {
    if (!selectedChild || !selectedPG) return;
    
    const payinRateNum = parseFloat(payinRate) / 100;
    
    if (payinRateNum < selectedPG.minPayinRate) {
      toast.error(`Payin rate cannot be less than your base rate (${(selectedPG.minPayinRate * 100).toFixed(2)}%)`);
      return;
    }
    
    // Payout rate is managed at schema level by admin, not by hierarchy users
    // Send 0 for payoutRate - backend will handle appropriately
    assignMutation.mutate({
      targetUserId: selectedChild,
      pgId: selectedPG.id,
      payinRate: payinRateNum,
      payoutRate: 0, // Payout rates managed at schema level
    });
  };

  if (!canAssignRates) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-6">My Rates</h1>
          
          {/* Show user's own rates */}
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Payment Gateway Rates</h2>
            <p className="text-gray-400 mb-4">These are the rates you are charged for transactions.</p>
            
            {myRatesLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500"></div>
              </div>
            ) : myRatesData.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                No payment gateways assigned. Contact your parent entity to get PG access.
              </div>
            ) : (
              <div className="grid gap-4">
                {myRatesData.map((rate: any) => (
                  <div key={rate.id} className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-white font-medium">{rate.paymentGateway.name}</h3>
                        <p className="text-gray-400 text-sm">{rate.paymentGateway.code}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-emerald-400 font-mono">
                          Payin: {(rate.payinRate * 100).toFixed(2)}%
                        </div>
                        <div className="text-blue-400 font-mono text-sm">
                          Payout: {(rate.payoutRate * 100).toFixed(2)}%
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      Assigned by: {rate.assignedBy?.email || 'Admin'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white">Rate Management</h1>
          <p className="text-gray-400 mt-1">Assign rates to your downstream entities</p>
        </div>

        {/* My Base Rates Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6"
        >
          <h2 className="text-xl font-semibold text-white mb-4">📊 My Base Rates (Cost)</h2>
          <p className="text-gray-400 text-sm mb-4">
            These are the rates you pay. You can assign rates higher than these to your children.
          </p>
          
          {pgsLoading ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-emerald-500"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pgsData.map((pg) => (
                <div
                  key={pg.id}
                  className="bg-gradient-to-br from-emerald-500/10 to-blue-500/10 rounded-xl p-4 border border-emerald-500/20"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-white font-medium">{pg.name}</h3>
                    <span className={`px-2 py-1 rounded text-xs ${pg.isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                      {pg.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-400">Payin:</span>
                      <span className="text-emerald-400 font-mono ml-2">{(pg.minPayinRate * 100).toFixed(2)}%</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Payout:</span>
                      <span className="text-blue-400 font-mono ml-2">{(pg.minPayoutRate * 100).toFixed(2)}%</span>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    {pg.supportedTypes}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Children Rates Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6"
        >
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-xl font-semibold text-white">👥 Downstream Entity Rates</h2>
              <p className="text-gray-400 text-sm">Manage rates for your children entities</p>
            </div>
            <button
              onClick={() => refetchChildren()}
              className="text-gray-400 hover:text-white transition-colors"
            >
              🔄 Refresh
            </button>
          </div>
          
          {childrenLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500"></div>
            </div>
          ) : children.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p>No downstream entities found.</p>
              <p className="text-sm mt-1">Create users to assign rates to them.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {children.map((child) => (
                <div
                  key={child.id}
                  className="bg-white/5 rounded-xl border border-white/10 overflow-hidden"
                >
                  {/* Child Header */}
                  <div className="p-4 bg-gradient-to-r from-slate-800/50 to-transparent flex justify-between items-center">
                    <div>
                      <h3 className="text-white font-medium">
                        {child.firstName} {child.lastName}
                        {child.businessName && <span className="text-gray-400 ml-2">({child.businessName})</span>}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-gray-400 text-sm">{child.email}</span>
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          child.role === 'MASTER_DISTRIBUTOR' ? 'bg-purple-500/20 text-purple-400' :
                          child.role === 'DISTRIBUTOR' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-cyan-500/20 text-cyan-400'
                        }`}>
                          {child.role.replace('_', ' ')}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          child.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {child.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Assigned Rates */}
                  <div className="p-4">
                    {child.rates.length === 0 ? (
                      <p className="text-gray-400 text-sm mb-3">No PG rates assigned yet.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
                        {child.rates.map((rate) => (
                          <div
                            key={rate.id}
                            className={`rounded-lg p-3 border ${
                              rate.isEnabled 
                                ? 'bg-emerald-500/10 border-emerald-500/30' 
                                : 'bg-red-500/10 border-red-500/30'
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <span className="text-white font-medium text-sm">{rate.paymentGateway.name}</span>
                              <span className={`text-xs ${rate.isEnabled ? 'text-emerald-400' : 'text-red-400'}`}>
                                {rate.isEnabled ? '✓ Enabled' : '✗ Disabled'}
                              </span>
                            </div>
                            <div className="flex gap-4 mt-2 text-xs">
                              <div>
                                <span className="text-gray-400">Payin:</span>
                                <span className="text-emerald-400 font-mono ml-1">{(rate.payinRate * 100).toFixed(2)}%</span>
                              </div>
                              <div>
                                <span className="text-gray-400">Payout:</span>
                                <span className="text-blue-400 font-mono ml-1">{(rate.payoutRate * 100).toFixed(2)}%</span>
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                const pg = pgsData.find(p => p.id === rate.paymentGateway.id);
                                if (pg) openAssignModal(child.id, pg, rate);
                              }}
                              className="mt-2 text-xs text-gray-400 hover:text-white transition-colors"
                            >
                              ✏️ Edit Rate
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Assign New Rate Button */}
                    <div className="flex gap-2 flex-wrap">
                      {pgsData.filter(pg => !child.rates.some(r => r.paymentGateway.id === pg.id)).map(pg => (
                        <button
                          key={pg.id}
                          onClick={() => openAssignModal(child.id, pg)}
                          className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg text-xs hover:bg-emerald-500/30 transition-colors"
                        >
                          + Assign {pg.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Commission Preview Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6"
        >
          <h2 className="text-xl font-semibold text-white mb-4">💰 Commission Calculator</h2>
          <p className="text-gray-400 text-sm mb-4">
            Preview how commissions will be distributed for a transaction.
          </p>
          <CommissionCalculator pgs={pgsData} />
        </motion.div>
      </div>

      {/* Assign Rate Modal */}
      <AnimatePresence>
        {showAssignModal && selectedChild && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={() => setShowAssignModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-800 rounded-2xl p-6 w-full max-w-md border border-white/10"
            >
              <h3 className="text-xl font-bold text-white mb-4">
                Assign Rate
              </h3>
              
              {/* PG Selection */}
              {!selectedPG && (
                <div className="mb-4">
                  <label className="block text-gray-400 text-sm mb-2">Select Payment Gateway</label>
                  <div className="grid gap-2">
                    {pgsData.map(pg => (
                      <button
                        key={pg.id}
                        onClick={() => {
                          setSelectedPG(pg);
                          setPayinRate((pg.minPayinRate * 100).toString());
                          setPayoutRate((pg.minPayoutRate * 100).toString());
                        }}
                        className="p-3 bg-white/5 rounded-lg border border-white/10 hover:border-emerald-500/50 transition-colors text-left"
                      >
                        <div className="font-medium text-white">{pg.name}</div>
                        <div className="text-xs text-gray-400">Min: {(pg.minPayinRate * 100).toFixed(2)}%</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {selectedPG && (
                <>
                  <div className="mb-4 p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/30">
                    <div className="font-medium text-white">{selectedPG.name}</div>
                    <div className="text-xs text-gray-400">
                      Your base rate: Payin {(selectedPG.minPayinRate * 100).toFixed(2)}% | Payout {(selectedPG.minPayoutRate * 100).toFixed(2)}%
                    </div>
                  </div>
                  
                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="block text-gray-400 text-sm mb-2">
                        Payin Rate (%) <span className="text-gray-500">Min: {(selectedPG.minPayinRate * 100).toFixed(2)}%</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min={(selectedPG.minPayinRate * 100)}
                        value={payinRate}
                        onChange={(e) => setPayinRate(e.target.value)}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 outline-none"
                        placeholder="e.g., 1.5"
                      />
                      {payinRate && parseFloat(payinRate) > selectedPG.minPayinRate * 100 && (
                        <div className="text-xs text-emerald-400 mt-1">
                          Your profit: {(parseFloat(payinRate) - selectedPG.minPayinRate * 100).toFixed(2)}%
                        </div>
                      )}
                    </div>
                    
                    {/* Payout Rate - Only Admin can set, others see info message */}
                    <div>
                      <label className="block text-gray-400 text-sm mb-2">
                        Payout Rate
                      </label>
                      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
                        <p className="text-blue-300 text-sm">
                          <strong>Note:</strong> Payout charges are managed at the Schema level (Gold/Platinum) by Admin using slab-based rates.
                        </p>
                        <p className="text-blue-400/70 text-xs mt-1">
                          Payout fees are automatically applied based on transaction amount ranges.
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowAssignModal(false)}
                      className="flex-1 py-3 px-4 bg-white/5 text-white rounded-xl hover:bg-white/10 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAssign}
                      disabled={assignMutation.isPending}
                      className="flex-1 py-3 px-4 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors disabled:opacity-50"
                    >
                      {assignMutation.isPending ? 'Assigning...' : 'Assign Rate'}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Commission Calculator Component
function CommissionCalculator({ pgs }: { pgs: PGRate[] }) {
  const [selectedPG, setSelectedPG] = useState('');
  const [amount, setAmount] = useState('10000');
  const [type, setType] = useState<'PAYIN' | 'PAYOUT'>('PAYIN');
  
  const { data: preview, isLoading, refetch } = useQuery({
    queryKey: ['commission-preview', selectedPG, amount, type],
    queryFn: () => rateApi.previewCommissions(selectedPG, parseFloat(amount), type),
    enabled: !!selectedPG && !!amount && parseFloat(amount) > 0,
  });

  const previewData = preview?.data?.data;

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="space-y-4">
        <div>
          <label className="block text-gray-400 text-sm mb-2">Payment Gateway</label>
          <select
            value={selectedPG}
            onChange={(e) => setSelectedPG(e.target.value)}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:border-emerald-500/50 outline-none"
          >
            <option value="">Select PG</option>
            {pgs.map(pg => (
              <option key={pg.id} value={pg.id}>{pg.name}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-gray-400 text-sm mb-2">Transaction Amount (₹)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:border-emerald-500/50 outline-none"
            placeholder="10000"
          />
        </div>
        
        <div>
          <label className="block text-gray-400 text-sm mb-2">Transaction Type</label>
          <div className="flex gap-2">
            <button
              onClick={() => setType('PAYIN')}
              className={`flex-1 py-2 rounded-lg transition-colors ${type === 'PAYIN' ? 'bg-emerald-500 text-white' : 'bg-white/5 text-gray-400'}`}
            >
              Payin
            </button>
            <button
              onClick={() => setType('PAYOUT')}
              className={`flex-1 py-2 rounded-lg transition-colors ${type === 'PAYOUT' ? 'bg-blue-500 text-white' : 'bg-white/5 text-gray-400'}`}
            >
              Payout
            </button>
          </div>
        </div>
      </div>
      
      <div className="bg-white/5 rounded-xl p-4 border border-white/10">
        <h4 className="text-white font-medium mb-3">Commission Breakdown</h4>
        
        {!selectedPG ? (
          <p className="text-gray-400 text-sm">Select a PG to preview commissions</p>
        ) : isLoading ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-emerald-500"></div>
          </div>
        ) : previewData ? (
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Your Rate:</span>
              <span className="text-emerald-400 font-mono">{(previewData.initiatorRate * 100).toFixed(2)}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">PG Base Rate:</span>
              <span className="text-gray-300 font-mono">{(previewData.pgBaseRate * 100).toFixed(2)}%</span>
            </div>
            <div className="flex justify-between text-sm border-t border-white/10 pt-2">
              <span className="text-gray-400">Total Commission Pool:</span>
              <span className="text-yellow-400 font-mono">₹{previewData.totalCommissionAmount.toFixed(2)}</span>
            </div>
            
            {previewData.breakdown.length > 0 && (
              <div className="mt-4 pt-3 border-t border-white/10">
                <p className="text-gray-400 text-xs mb-2">Distribution:</p>
                <div className="space-y-2">
                  {previewData.breakdown.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-white">
                        {item.userName} <span className="text-gray-500">({item.role})</span>
                      </span>
                      <span className="text-emerald-400 font-mono">₹{item.commissionAmount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-gray-400 text-sm">Enter amount to see breakdown</p>
        )}
      </div>
    </div>
  );
}

