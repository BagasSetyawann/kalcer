import React, { useState } from 'react';
import { Bell, Eye, EyeOff, LogIn, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase.js';

export default function LoginPage() {
  const [mode, setMode]           = useState('login'); // 'login' | 'forgot'
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
      // Login berhasil → App.jsx akan mendeteksi via onAuthStateChange
    } catch (err) {
      setError(
        err.message === 'Invalid login credentials'
          ? 'Email atau password salah. Periksa kembali dan coba lagi.'
          : err.message
      );
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!email) { setError('Masukkan email Anda terlebih dahulu.'); return; }
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (authError) throw authError;
      setSuccess(`Link reset password telah dikirim ke ${email}. Periksa kotak masuk Anda.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-gray-100 rounded-full opacity-60" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gray-100 rounded-full opacity-60" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo / Brand */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-black rounded-2xl shadow-xl mb-4">
            <Bell className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">KALCER</h1>
          <p className="text-sm text-gray-500 mt-1">
            {mode === 'login' ? 'Masuk ke akun Anda' : 'Reset Password'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">

          {/* Error / Success banners */}
          {error && (
            <div className="flex items-start space-x-2.5 bg-red-50 border border-red-200 rounded-xl p-3.5 mb-5">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 leading-relaxed">{error}</p>
            </div>
          )}
          {success && (
            <div className="flex items-start space-x-2.5 bg-green-50 border border-green-200 rounded-xl p-3.5 mb-5">
              <CheckCircle className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
              <p className="text-xs text-green-700 leading-relaxed">{success}</p>
            </div>
          )}

          {/* ── LOGIN FORM ── */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-5">
              {/* Email */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                  Email
                </label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@contoh.com"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-black focus:bg-white transition-all"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 pr-11 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-black focus:bg-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Forgot password link */}
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => { setMode('forgot'); setError(''); setSuccess(''); }}
                  className="text-xs text-gray-500 hover:text-black transition-colors underline underline-offset-2"
                >
                  Lupa password?
                </button>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center space-x-2 py-3 bg-black hover:bg-gray-800 disabled:bg-gray-300 text-white text-sm font-semibold rounded-xl transition-all active:scale-[0.98] shadow-sm"
              >
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Masuk...</span></>
                  : <><LogIn className="w-4 h-4" /><span>Masuk</span></>
                }
              </button>
            </form>
          )}

          {/* ── FORGOT PASSWORD FORM ── */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                  Email Akun
                </label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@contoh.com"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-black focus:bg-white transition-all"
                />
                <p className="text-xs text-gray-400 mt-2">
                  Kami akan mengirimkan link reset password ke email ini.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || !!success}
                className="w-full flex items-center justify-center space-x-2 py-3 bg-black hover:bg-gray-800 disabled:bg-gray-300 text-white text-sm font-semibold rounded-xl transition-all active:scale-[0.98] shadow-sm"
              >
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Mengirim...</span></>
                  : <span>Kirim Link Reset</span>
                }
              </button>

              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
                className="w-full py-2 text-xs text-gray-500 hover:text-black transition-colors"
              >
                ← Kembali ke Login
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6">
          KALCER — Kalender Cerdas Reminder
        </p>
      </div>
    </div>
  );
}
