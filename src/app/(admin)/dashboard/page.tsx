'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { FileWarning, Banknote } from 'lucide-react';

// 1. Definisikan tipe data yang jelas
interface MissingReceipt {
  id: string;
  created_at: string;
  qty_bought: number;
  store_name: string;
  total_price: number;
  projects: { name: string };
  materials: { name: string };
}

export default function DashboardBos() {
  // 2. Gunakan useMemo agar client supabase tidak di-recreate setiap render
  const supabase = useMemo(() => createClient(), []);
  
  const [missingReceipts, setMissingReceipts] = useState<MissingReceipt[]>([]);
  const [totalExpenses, setTotalExpenses] = useState<number>(0);

  useEffect(() => {
    // 3. Pindahkan fungsi ke dalam useEffect agar dependency bersih
    async function loadDashboard() {
      const { data: missing } = await supabase
        .from('purchases')
        .select('id, created_at, qty_bought, store_name, total_price, projects(name), materials(name)')
        .eq('receipt_status', 'belum_diterima')
        .order('created_at', { ascending: false });
      
      if (missing) {
        // Cast hasil kembalian Supabase ke tipe yang sudah kita buat
        setMissingReceipts(missing as unknown as MissingReceipt[]);
      }

      const { data: expenses } = await supabase.from('purchases').select('total_price');
      if (expenses) {
        const total = expenses.reduce((acc, curr) => acc + Number(curr.total_price), 0);
        setTotalExpenses(total);
      }
    }
    
    loadDashboard();
  }, [supabase]); // Masukkan supabase sebagai dependency

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold text-slate-800">Dashboard Audit</h1>

      <div className="bg-blue-600 text-white p-6 rounded-2xl shadow-md flex items-center justify-between">
        <div>
          <p className="text-blue-100 font-medium mb-1">Total Belanja Material (Seluruh Proyek)</p>
          <h2 className="text-4xl font-bold">
            Rp {totalExpenses.toLocaleString('id-ID')}
          </h2>
        </div>
        <Banknote size={64} className="text-blue-400 opacity-50" />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-red-50 text-red-800">
          <FileWarning size={24} />
          <h2 className="text-xl font-bold">Daftar Bon / Nota Belum Diterima</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 text-sm border-b">
                <th className="p-4 font-medium">Tanggal</th>
                <th className="p-4 font-medium">Proyek</th>
                <th className="p-4 font-medium">Barang Dibeli</th>
                <th className="p-4 font-medium">Toko</th>
                <th className="p-4 font-medium">Total Harga</th>
              </tr>
            </thead>
            <tbody>
              {missingReceipts.length === 0 ? (
                <tr><td colSpan={5} className="p-6 text-center text-slate-500">Semua bon sudah disetor. Aman!</td></tr>
              ) : (
                missingReceipts.map(row => (
                  <tr key={row.id} className="border-b hover:bg-slate-50">
                    <td className="p-4 text-sm">{new Date(row.created_at).toLocaleDateString('id-ID')}</td>
                    <td className="p-4 font-medium">{row.projects?.name}</td>
                    <td className="p-4">{row.materials?.name} ({row.qty_bought})</td>
                    <td className="p-4">{row.store_name}</td>
                    <td className="p-4 font-bold text-red-600">Rp {Number(row.total_price).toLocaleString('id-ID')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}