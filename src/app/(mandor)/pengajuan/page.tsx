'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { HardHat, Send, CheckCircle2 } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  location: string;
}

interface Material {
  id: string;
  name: string;
  unit: string;
}

export default function PengajuanTukang() {
  const supabase = useMemo(() => createClient(), []);
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [projectId, setProjectId] = useState('');
  const [materialId, setMaterialId] = useState('');
  const [qty, setQty] = useState('');
  const [requesterName, setRequesterName] = useState('');

  useEffect(() => {
    async function fetchData() {
      const { data: p } = await supabase.from('projects').select('id, name, location').eq('status', 'active');
      const { data: m } = await supabase.from('materials').select('id, name, unit');
      
      if (p) setProjects(p as Project[]);
      if (m) setMaterials(m as Material[]);
    }
    fetchData();
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.from('requests').insert({
      project_id: projectId,
      material_id: materialId,
      qty_requested: Number(qty),
      requester_name: requesterName,
      status: 'pending'
    });

    setLoading(false);
    if (!error) {
      setSuccess(true);
      setProjectId(''); setMaterialId(''); setQty(''); setRequesterName('');
      setTimeout(() => setSuccess(false), 3000);
    } else {
      alert('Gagal mengirim pengajuan. Coba lagi.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 flex justify-center items-start pt-10">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center gap-3 mb-6 border-b pb-4">
          <div className="bg-blue-600 p-3 rounded-full text-white">
            <HardHat size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Minta Material</h1>
            <p className="text-sm text-slate-500">Portal Mandor Lapangan</p>
          </div>
        </div>

        {success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4 flex items-center gap-2">
            <CheckCircle2 size={20} />
            <p>Pengajuan berhasil dikirim ke Admin!</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nama Mandor/Tukang</label>
            <input required type="text" value={requesterName} onChange={(e) => setRequesterName(e.target.value)} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Cth: Pak Budi" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Pilih Proyek</label>
            <select required value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-full border p-3 rounded-lg bg-white outline-none">
              <option value="">-- Pilih Proyek --</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name} - {p.location}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Pilih Material</label>
            <select required value={materialId} onChange={(e) => setMaterialId(e.target.value)} className="w-full border p-3 rounded-lg bg-white outline-none">
              <option value="">-- Pilih Barang --</option>
              {materials.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Jumlah Dibutuhkan</label>
            <input required type="number" min="0.1" step="any" value={qty} onChange={(e) => setQty(e.target.value)} className="w-full border p-3 rounded-lg outline-none" placeholder="Cth: 10" />
          </div>
          <button disabled={loading} type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg flex justify-center items-center gap-2 transition-all">
            {loading ? 'Mengirim...' : <><Send size={20} /> Kirim Pengajuan</>}
          </button>
        </form>
      </div>
    </div>
  );
}