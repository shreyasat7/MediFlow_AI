import React, { useState, useEffect } from 'react';
import { rawFetch } from '../api';
import { motion } from 'framer-motion';
import { Receipt, CheckCircle, Clock, ShieldAlert, Download } from 'lucide-react';

const Billing = () => {
  const [bills, setBills] = useState([]);
  
  useEffect(() => {
    rawFetch('/billing/')
      .then(res => res.json())
      .then(data => setBills(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, []);

  const handleClearDues = (billId) => {
    rawFetch(`/billing/${billId}/pay`, {
      method: 'PATCH',
    })
      .then(res => res.json())
      .then(() => {
        // Update the UI instantly without reloading the page
        setBills(prevBills => 
          prevBills.map(bill => 
            bill.id === billId ? { ...bill, payment_status: 'Paid' } : bill
          )
        );
      })
      .catch(console.error);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="p-3 bg-primary/10 rounded-xl">
          <Receipt className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold text-text-primary">Billing & Discharge</h1>
          <p className="text-text-secondary">Financial Overview & Clearance Agent</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {bills.length === 0 ? (
          <div className="col-span-3 text-center py-12 text-text-secondary font-medium glass-panel rounded-2xl">
            No pending bills. When a patient is marked as "Done" in the Doctor Queue, their auto-generated bill will appear here.
          </div>
        ) : (
          bills.map((bill, i) => (
            <motion.div 
              key={bill.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="glass-panel p-6 rounded-2xl shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden"
            >
              <div className={`absolute top-0 right-0 p-4 font-bold text-xs pl-6 pr-6 transform translate-x-1/4 -translate-y-1/4 rotate-45 ${
                    bill.payment_status === 'Paid' ? 'bg-success text-white' : 
                    bill.payment_status === 'Insurance' ? 'bg-primary text-white' : 'bg-warning text-white'
                  }`}>
                  {bill.payment_status}
              </div>

              <div>
                <div className="flex justify-between items-start mb-6 pt-2">
                  <div>
                    <h3 className="font-bold text-xl text-text-primary">{bill.patient_name}</h3>
                    <p className="text-sm font-mono text-text-secondary mt-1">{bill.patient_id}</p>
                  </div>
                </div>
                
                <div className="space-y-3 mb-6">
                  <div className="text-xs text-text-secondary uppercase font-bold tracking-wider">Itemized Breakdown</div>
                  {bill.items.split(',').map((item, idx) => (
                     <div key={idx} className="flex items-center text-sm text-text-primary border-b border-border-color pb-2 last:border-0 last:pb-0">
                       <span className="w-1.5 h-1.5 rounded-full bg-primary/50 mr-2"></span> {item.trim()}
                     </div>
                  ))}
                </div>
              </div>

              <div className="mt-auto">
                 <div className="flex justify-between items-end bg-surface-secondary p-4 rounded-xl mb-4">
                   <span className="text-sm font-medium text-text-secondary">Total Due</span>
                   <span className="text-3xl font-display font-bold text-text-primary">Rs. {bill.total_amount}.00</span>
                 </div>
                 
                 <div className="flex space-x-3">
                   <button className="flex-1 py-2.5 rounded-lg border border-primary/20 text-primary hover:bg-primary/5 transition-colors font-medium text-sm disabled:opacity-50 flex items-center justify-center cursor-pointer">
                      <Download className="w-4 h-4 mr-2" /> PDF Copy
                   </button>
                   {bill.payment_status !== "Paid" && (
                     <button 
                       onClick={() => handleClearDues(bill.id)} 
                       className="flex-1 py-2.5 bg-primary text-white rounded-lg font-medium shadow-md hover:shadow-lg transition-all cursor-pointer"
                     >
                       Clear Dues
                     </button>
                   )}
                 </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};
export default Billing;