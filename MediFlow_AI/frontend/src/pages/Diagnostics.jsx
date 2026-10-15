import React, { useState, useEffect } from 'react';
import { rawFetch } from '../api';
import { motion, AnimatePresence } from 'framer-motion';
import { ActivitySquare, Search, FileText, CheckCircle, Clock, X } from 'lucide-react';

const Diagnostics = () => {
  const [tests, setTests] = useState([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTest, setNewTest] = useState({ patient_id: '', patient_name: '', test_name: 'Blood Test' });

  const fetchTests = () => {
    rawFetch('/diagnostics/')
      .then(res => res.json())
      .then(data => setTests(Array.isArray(data) ? data : []))
      .catch(console.error);
  };

  useEffect(() => {
    fetchTests();
  }, []);

  const scheduleTest = (e) => {
    e.preventDefault();
    rawFetch('/diagnostics/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTest)
    })
      .then(res => res.json())
      .then(() => {
        setIsModalOpen(false);
        setNewTest({ patient_id: '', patient_name: '', test_name: 'Blood Test' });
        fetchTests();
      })
      .catch(console.error);
  };

  const toggleStatus = (id, currentStatus) => {
    // Stop the function if it's already completed
    if (currentStatus === 'Completed') return;

    // Define the correct pipeline
    let nextStatus = 'Pending';
    if (currentStatus === 'Pending') nextStatus = 'In Progress';
    if (currentStatus === 'In Progress') nextStatus = 'Ready';
    if (currentStatus === 'Ready') nextStatus = 'Completed';

    rawFetch(`/diagnostics/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus })
    })
      .then(() => fetchTests())
      .catch(console.error);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="p-3 bg-primary/10 rounded-xl">
          <ActivitySquare className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold text-text-primary">Diagnostics Scheduling</h1>
          <p className="text-text-secondary">AI Suggested Tests & Lab Flow Tracker</p>
        </div>
      </div>
      
      <div className="flex space-x-4 mb-6">
         <div className="flex-1 relative">
            <Search className="w-5 h-5 absolute left-3 top-3 text-text-secondary" />
            <input 
              type="text" placeholder="Search patient ID or symptoms to auto-suggest tests..." 
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border-color bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-primary transition-all"
            />
         </div>
         <button onClick={() => setIsModalOpen(true)} className="px-6 py-2.5 bg-primary text-white rounded-lg font-medium shadow-md hover:shadow-lg transition-all cursor-pointer">
           Schedule Test
         </button>
      </div>

      <div className="glass-panel p-6 rounded-2xl overflow-hidden">
        <h3 className="text-lg font-semibold text-text-primary mb-4">Central Lab Queue</h3>
        <table className="w-full text-sm text-left">
          <thead className="text-xs uppercase bg-surface-secondary text-text-secondary">
            <tr>
              <th className="px-4 py-3 rounded-tl-lg">Patient ID</th>
              <th className="px-4 py-3">Patient Name</th>
              <th className="px-4 py-3">Test Requested</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="text-text-primary">
            {tests.length === 0 ? (
               <tr><td colSpan="4" className="text-center py-12 text-text-secondary font-medium">No tests scheduled today. The Master AI has not assigned any pending diagnostics.</td></tr>
            ) : tests.map((t, i) => (
              <motion.tr initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} transition={{delay: i*0.1}} key={t.id} className="border-b border-border-color hover:bg-surface-secondary transition-colors">
                <td className="px-4 py-4 font-mono font-medium">{t.patient_id}</td>
                <td className="px-4 py-4 font-medium">{t.patient_name}</td>
                <td className="px-4 py-4">
                  <div className="flex items-center">
                    <FileText className="w-4 h-4 mr-2 text-text-secondary" /> {t.test_name}
                  </div>
                </td>
                <td className="px-4 py-4 font-semibold">
                  <button 
                    onClick={() => toggleStatus(t.id, t.status)} 
                    disabled={t.status === 'Completed'}
                    className={`flex items-center transition-opacity ${t.status === 'Completed' ? 'cursor-default opacity-60' : 'hover:opacity-80 cursor-pointer'}`}
                  >
                    {t.status === 'Pending' && <span className="flex items-center text-warning"><Clock className="w-4 h-4 mr-1"/> Pending</span>}
                    {t.status === 'In Progress' && <span className="flex items-center text-primary"><ActivitySquare className="w-4 h-4 mr-1 animate-spin"/> In Progress</span>}
                    {t.status === 'Ready' && <span className="flex items-center text-success"><CheckCircle className="w-4 h-4 mr-1"/> Ready</span>}
                    {t.status === 'Completed' && <span className="flex items-center text-text-secondary"><CheckCircle className="w-4 h-4 mr-1"/> Completed</span>}
                  </button>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Schedule Test Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface glass-panel p-6 rounded-2xl shadow-xl w-full max-w-md relative"
            >
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="absolute top-4 right-4 text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              
              <h2 className="text-xl font-bold text-text-primary mb-6">Schedule Test</h2>
              
              <form onSubmit={scheduleTest} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Patient ID</label>
                  <input 
                    type="text" 
                    required
                    value={newTest.patient_id}
                    onChange={e => setNewTest({...newTest, patient_id: e.target.value})}
                    className="w-full px-4 py-2 rounded-lg border border-border-color bg-surface-secondary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g. P-1001"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Patient Name</label>
                  <input 
                    type="text" 
                    required
                    value={newTest.patient_name}
                    onChange={e => setNewTest({...newTest, patient_name: e.target.value})}
                    className="w-full px-4 py-2 rounded-lg border border-border-color bg-surface-secondary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g. John Doe"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Test Name</label>
                  <select 
                    value={newTest.test_name}
                    onChange={e => setNewTest({...newTest, test_name: e.target.value})}
                    className="w-full px-4 py-2 rounded-lg border border-border-color bg-surface-secondary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {['Blood Test', 'Urine Test', 'X-Ray', 'MRI', 'CT Scan', 'ECG', 'Ultrasound', 'CBC', 'Blood Pressure Check', 'Glucose Test'].map(test => (
                      <option key={test} value={test}>{test}</option>
                    ))}
                  </select>
                </div>

                <div className="pt-4">
                  <button type="submit" className="w-full py-2.5 bg-primary text-white rounded-lg font-medium shadow-md hover:shadow-lg transition-all cursor-pointer">
                    Schedule
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
export default Diagnostics;