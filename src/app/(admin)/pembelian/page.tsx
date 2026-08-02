'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Receipt, UploadCloud } from 'lucide-react';

// 1. Tipe data eksplisit
interface ApprovedRequest {
  id: string;
  project_id: string;
  material_id: string;
  qty_requested: number;
  projects: { name: string };
  materials: { name: string; unit: string };
}

export default function CatatPembelian() {
  const supabase = useMemo(() => createClient(), []);
  
  const [approvedRequests, setApprovedRequests] = useState<ApprovedRequest[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [selectedReq, setSelectedReq] = useState('');
  const [storeName, setStoreName] = useState('');
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  useEffect(() => {
    async function getApproved() {
      const { data } = await supabase
        .from('requests')
        .select('id, project_id, material_id, qty_requested, projects(name), materials(name, unit)')
        .eq('status', 'approved');
      
      if (data) {
        setApprovedRequests(data as unknown as ApprovedRequest[]);
      }
    }
    getApproved();
  }, [supabase]);

  const handleUpload = async (file: File) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `receipts/${fileName}`; 

    const { error: uploadError } = await supabase.storage.from('receipts').upload(filePath, file);
    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('receipts').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReq) return alert('Pilih request yang disetujui');
    
    setLoading(true);
    try {
      let photoUrl = null;
      let statusBon = 'belum_diterima';

      if (receiptFile) {
        photoUrl = await handleUpload(receiptFile);
        statusBon = 'sudah_diterima';
      }

      const request = approvedRequests.find(r => r.id === selectedReq);
      if (!request) throw new Error('Data pengajuan tidak ditemukan');

      const { error } = await supabase.from('purchases').insert({
        request_id: request.id,
        project_id: request.project_id,
        material_id: request.material_id,
        store_name: storeName,
        price_per_unit: Number(pricePerUnit),
        qty_bought: request.qty_requested,
        receipt_status: statusBon,
        receipt_photo_url: photoUrl
      });

      if (error) throw error;
      
      await supabase.from('requests').update({ status: 'completed' }).eq('id', request.id);
      
      alert('Pembelian berhasil dicatat! Stok proyek otomatis bertambah.');
      window.location.reload();
    } catch (err: unknown) {
      // 2. Penanganan `any` error diganti menjadi `unknown` yang lebih aman di TypeScript
      if (err instanceof Error) {
        alert('Terjadi kesalahan: ' + err.message);
      } else {
        alert('Terjadi kesalahan yang tidak diketahui.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <h1 className="text-2xl font-bold flex items-center gap-2 mb-6 text-slate-800">
          <Receipt /> Catat Pembelian Material
        </h1>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold mb-2">Pilih Pengajuan (Yang Disetujui)</label>
            <select required value={selectedReq} onChange={e => setSelectedReq(e.target.value)} className="w-full border p-3 rounded-lg bg-slate-50 outline-none">
              <option value="">-- Pilih Pengajuan --</option>
              {approvedRequests.map(req => (
                <option key={req.id} value={req.id}>
                  {req.materials.name} ({req.qty_requested} {req.materials.unit}) - {req.projects.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-2">Nama Toko / Supplier</label>
              <input required type="text" value={storeName} onChange={e => setStoreName(e.target.value)} className="w-full border p-3 rounded-lg outline-none" placeholder="Cth: TB Bangun Jaya" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Harga Satuan (Rp)</label>
              <input required type="number" value={pricePerUnit} onChange={e => setPricePerUnit(e.target.value)} className="w-full border p-3 rounded-lg outline-none" placeholder="Cth: 50000" />
            </div>
          </div>

          <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:bg-slate-50 transition-colors">
            <UploadCloud className="mx-auto text-slate-400 mb-2" size={32} />
            <label className="block text-sm font-semibold mb-1 cursor-pointer text-blue-600">
              Upload Foto Bon/Nota (Opsional)
              <input type="file" accept="image/*" className="hidden" onChange={e => setReceiptFile(e.target.files?.[0] || null)} />
            </label>
            <p className="text-xs text-slate-500">
              {receiptFile ? `File terpilih: ${receiptFile.name}` : 'Jika bon belum ada, biarkan kosong'}
            </p>
          </div>

          <button disabled={loading} type="submit" className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 px-4 rounded-lg transition-all">
            {loading ? 'Menyimpan & Uploading...' : 'Simpan Pembelian'}
          </button>
        </form>
      </div>
    </div>
  );
}