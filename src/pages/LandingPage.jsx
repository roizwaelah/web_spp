import { useState } from 'react'
import { ArrowRight, Building2, CreditCard, FileCheck2, MessageCircleMore, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { roleLabel } from '../utils'

export default function LandingPage() {
  const { login, loading } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: 'admin@madrasah.id', password: 'password' })
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const user = await login(form.email, form.password)
      navigate(user.role === 'parent' ? '/orang-tua' : '/admin')
    } catch (err) {
      setError(err?.response?.data?.message || 'Login gagal')
    }
  }

  return (
    <div className="min-h-screen bg-slate-800 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_420px]">
          <div className="rounded-[32px] border border-white/10 bg-gradient-to-br from-emerald-700 via-teal-700 to-sky-700 p-8 shadow-xl">
            <div className="inline-flex rounded-2xl bg-white/10 px-4 py-2 text-sm font-semibold tracking-wide">SPP Madrasah Online</div>
            <h1 className="mt-6 max-w-3xl text-3xl font-black leading-tight lg:text-[2.8rem]">
              Website pembayaran SPP 
              <span className="text-emerald-100"> MA Darussalam Cilongok</span>
            </h1>
            <p className="mt-5 max-w-2xl text-[1.05rem] text-emerald-50/95 lg:text-xl">
              Dibangun dengan Vite React + Tailwind CSS + PHP + MySQL untuk kebutuhan admin, bendahara/TU, dan orang tua siswa.
            </p>
          </div>

          <div className="rounded-[32px] border border-slate-200/80 bg-slate-50 p-6 text-slate-900 shadow-xl">
            <h2 className="text-[1.9rem] font-bold">Masuk ke portal</h2>
            <p className="mt-2 text-[0.98rem] text-slate-600">Gunakan akun Admin, Bendahara/TU, atau Orang Tua.</p>

            <form className="mt-6 space-y-4" onSubmit={submit}>
              {error && <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
              <div>
                <label className="label">Email</label>
                <input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <label className="label">Password</label>
                <input type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
              <button className="btn-primary w-full" disabled={loading}>
                {loading ? 'Memproses...' : <>Masuk <ArrowRight size={18} /></>}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
