import React, { useState, useEffect } from 'react';
import { rawFetch } from '../api';
import { motion, AnimatePresence } from 'framer-motion';
import { BedDouble, Info } from 'lucide-react';

const Beds = () => {
  const [beds, setBeds] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    rawFetch('/beds/')
      .then(res => res.json())
      .then(data => { setBeds(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(err => { console.error(err); setLoading(false); });
  }, []);

  const getStatusColor = (status) => {
    switch(status) {
      case 'Available': return 'bg-success border-success text-success';
      case 'Occupied': return 'bg-emergency border-emergency text-emergency';
      case 'Cleaning': return 'bg-primary border-primary text-primary';
      default: return 'bg-warning border-warning text-warning';
    }
  };

  // 🔥 NEW FUNCTION: Mark a bed as clean!
  const markAvailable = (bedId, currentStatus) => {
    if (currentStatus !== 'Cleaning') return; // Only allow clicking on beds that are cleaning

    rawFetch(`/beds/${bedId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Available' })
    })
      .then(res => res.json())
      .then(() => {
        // Instantly update the UI
        setBeds(prev => prev.map(b => b.id === bedId ? { ...b, status: 'Available' } : b));
      })
      .catch(console.error);
  };

  const wards = [...new Set(beds.map(b => b.ward))];

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="p-3 bg-primary/10 rounded-xl">
          <BedDouble className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold text-text-primary">Bed Management</h1>
          <p className="text-text-secondary">Auto-Allocation AI Agent Grid Map</p>
        </div>
      </div>

      <div className="flex space-x-4 mb-6 text-sm font-medium">
         <span className="flex items-center"><div className="w-3 h-3 rounded-full bg-success mr-2"></div> Available</span>
         <span className="flex items-center"><div className="w-3 h-3 rounded-full bg-emergency mr-2"></div> Occupied</span>
         <span className="flex items-center"><div className="w-3 h-3 rounded-full bg-primary mr-2"></div> Cleaning</span>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-8">
           <div className="h-48 bg-surface-secondary rounded-2xl w-full"></div>
           <div className="h-48 bg-surface-secondary rounded-2xl w-full"></div>
        </div>
      ) : (
        <div className="space-y-8">
          {wards.map((wardName, wIdx) => (
            <div key={wardName} className="glass-panel p-6 rounded-2xl shadow-sm">
              <h3 className="text-lg font-bold text-text-primary mb-6 flex items-center">{wardName} Ward</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <AnimatePresence>
                  {beds.filter(b => b.ward === wardName).map((bed, i) => {
                    const colorClass = getStatusColor(bed.status);
                    return (
                      <motion.div 
                        key={bed.id}
                        initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}
                        // 🔥 ADDED ONCLICK AND HOVER LOGIC HERE
                        onClick={() => markAvailable(bed.id, bed.status)}
                        className={`p-4 rounded-xl border border-opacity-30 flex flex-col items-center justify-center transition-all ${bed.status === 'Cleaning' ? 'cursor-pointer hover:scale-105 hover:shadow-lg' : 'cursor-default'} ${colorClass.split(' ')[1]} bg-surface relative overflow-hidden`}
                      >
                        <div className={`absolute inset-0 bg-opacity-10 ${colorClass.split(' ')[0]}`}></div>
                        <BedDouble className={`w-8 h-8 mb-2 z-10 ${colorClass.split(' ')[2]}`} />
                        <span className="text-text-primary font-mono font-bold z-10">{bed.bed_number}</span>
                        <span className="text-[10px] uppercase tracking-wide text-text-secondary font-bold mt-1 z-10">
                          {bed.status === 'Cleaning' ? 'Click to Clean' : bed.status}
                        </span>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
export default Beds;