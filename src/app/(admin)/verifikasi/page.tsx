'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AlertTriangle, Check, X, Clock } from 'lucide-react';

// Tipe data final setelah digabung dengan stok
interface RequestWithStock {
  id: string;
  project_id: string;
  material_id: string;
  qty_requested: number;
  requester_name: string;
  projects: { name: string };
  materials: { name: string; unit: string };
  current_stock: number;
}

// Tipe data mentah (raw) dari balikan Supabase sebelum digabung stok
interface RawRequest {
  id: string;
  project_id: string;
  material_id: string;
  qty_requested: number;
  requester_name: string;
  projects: { name: string } | null;
  materials: { name: string; unit: string } | null;
}

export default function VerifikasiPengajuan() {
  const supabase = useMemo(() => createClient(), []);
  const [requests, setRequests] = useState<RequestWithStock[]>([]);

  useEffect(() => {
    let isMounted = true; // Mencegah memory leak jika komponen unmount

    // Pindahkan deklarasi fungsi ke dalam useEffect sesuai standar React
    async function loadRequests() {
      const { data: reqData } = await supabase
        .from('requests')
        .select('id, project_id, material_id, qty_requested, requester_name, projects(name), materials(name, unit)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (!reqData) return;

      // Casting aman menggunakan unknown lalu ke interface spesifik (Bebas dari 'any')
      const rawRequests = reqData as unknown as RawRequest[];

      const requestsWithStock: RequestWithStock[] = await Promise.all(
        rawRequests.map(async (req) => {
          const { data: stockData } = await supabase
            .from('project_stocks')
            .select('current_stock')
            .eq('project_id', req.project_id)
            .eq('material_id', req.material_id)
            .single();
          
          // Mapping manual yang aman untuk TypeScript
          return {
            id: req.id,
            project_id: req.project_id,
            material_id: req.material_id,
            qty_requested: req.qty_requested,
            requester_name: req.requester_name,
            projects: req.projects as { name: string },
            materials: req.materials as { name: string; unit: string },
            current_stock: stockData?.current_stock || 0
          };
        })
      );
      
      if (isMounted) {
        setRequests(requestsWithStock);
      }
    }

    loadRequests();

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  async function updateStatus(id: string, status: string) {
    // 1. Optimistic UI Update: Langsung hapus kartu dari layar agar UI terasa seketika (blazing fast)
    setRequests((prev) => prev.filter((req) => req.id !== id));
    
    // 2. Eksekusi update di background database
    const { error } = await supabase.from('requests').update({ status }).eq('id', id);
    
    if (error) {
      alert('Gagal mengupdate status: ' + error.message);
      // Jika butuh rollback UI, bisa ditambahkan logika refresh otomatis di sini
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-slate-800">Verifikasi Pengajuan Material</h1>
      
      <div className="grid gap-6">
        {requests.length === 0 && <p className="text-slate-500 italic">Tidak ada pengajuan baru.</p>}
        
        {requests.map((req) => (
          <div key={req.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="bg-yellow-100 text-yellow-800 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                  <Clock size={12} /> Menunggu Verifikasi
                </span>
                {req.current_stock > 0 && (
                  <span className="bg-red-100 text-red-700 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 animate-pulse border border-red-300">
                    <AlertTriangle size={14} /> 
                    AWAS: Sisa di lapangan masih {req.current_stock} {req.materials.unit}!
                  </span>
                )}
              </div>
              <h3 className="text-xl font-bold">{req.materials.name} <span className="text-slate-500 text-lg">({req.qty_requested} {req.materials.unit})</span></h3>
              <p className="text-slate-600 mt-1">Proyek: <span className="font-semibold text-slate-800">{req.projects.name}</span></p>
              <p className="text-slate-500 text-sm">Diminta oleh: {req.requester_name}</p>
            </div>

            <div className="flex gap-3 w-full md:w-auto">
              <button onClick={() => updateStatus(req.id, 'rejected')} className="flex-1 md:flex-none bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors">
                <X size={18} /> Tolak
              </button>
              <button onClick={() => updateStatus(req.id, 'approved')} className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors">
                <Check size={18} /> Setujui
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}