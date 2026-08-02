import Link from 'next/link';
import { HardHat, ShieldCheck } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <div className="text-center mb-10">
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">
          Sistem Rekap & Audit Material
        </h1>
        <p className="text-slate-500">Pilih portal masuk sesuai dengan peran Anda</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 w-full max-w-4xl">
        {/* Card Portal Mandor */}
        <Link href="/pengajuan" className="group block">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 hover:border-blue-500 hover:shadow-md transition-all duration-300 h-full flex flex-col items-center text-center">
            <div className="bg-blue-100 text-blue-600 p-4 rounded-full mb-6 group-hover:scale-110 transition-transform">
              <HardHat size={48} />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Portal Lapangan</h2>
            <p className="text-slate-600">
              Khusus untuk Mandor & Tukang. Ajukan permintaan material baru dari lapangan dengan cepat.
            </p>
          </div>
        </Link>

        {/* Card Portal Admin */}
        <Link href="/dashboard" className="group block">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 hover:border-slate-800 hover:shadow-md transition-all duration-300 h-full flex flex-col items-center text-center">
            <div className="bg-slate-100 text-slate-800 p-4 rounded-full mb-6 group-hover:scale-110 transition-transform">
              <ShieldCheck size={48} />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Portal Bos & Admin</h2>
            <p className="text-slate-600">
              Verifikasi pengajuan, input data pembelian material, dan pantau dashboard audit.
            </p>
          </div>
        </Link>
      </div>
      
      <div className="mt-12 text-sm text-slate-400">
        &copy; {new Date().getFullYear()} Internal System Kontraktor
      </div>
    </div>
  );
}