"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Login() {
    const router = useRouter();
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (e) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch('http://localhost:9000/user/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Login failed');

            // Store token typically in localStorage (or cookies)
            localStorage.setItem('auth_token', data.token);
            
            // Redirect to a protected route like dashboard
            router.push('/dashboard');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4 font-sans text-stone-100">
            <div className="max-w-md w-full relative group">
                <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600 opacity-20 blur-xl group-hover:opacity-30 transition duration-700"></div>
                
                <div className="relative bg-[#09090b] border border-zinc-800 rounded-2xl shadow-2xl p-8 backdrop-blur-sm">
                    <div className="text-center mb-8">
                        <div className="inline-block p-3 rounded-full bg-emerald-500/10 mb-4">
                            <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <h2 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-400">
                            Welcome Back
                        </h2>
                        <p className="text-zinc-500 mt-2 text-sm">Please log in to your account</p>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 rounded-lg bg-red-950/50 border border-red-900 text-red-400 text-sm animate-pulse">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-zinc-400 mb-1">Email</label>
                            <input 
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                required
                                className="w-full px-4 py-2.5 rounded-xl bg-zinc-900/50 border border-zinc-800 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all placeholder:text-zinc-600"
                                placeholder="you@example.com"
                            />
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-sm font-medium text-zinc-400">Password</label>
                                <a href="#" className="text-xs text-emerald-500 hover:text-emerald-400 transition-colors">Forgot password?</a>
                            </div>
                            <input 
                                type="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                required
                                className="w-full px-4 py-2.5 rounded-xl bg-zinc-900/50 border border-zinc-800 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all placeholder:text-zinc-600"
                                placeholder="••••••••"
                            />
                        </div>

                        <button 
                            type="submit" 
                            disabled={loading}
                            className="w-full py-3 px-4 rounded-xl font-medium text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 focus:ring-4 focus:ring-emerald-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-[0.98] mt-2"
                        >
                            {loading ? 'Authenticating...' : 'Sign in'}
                        </button>
                    </form>

                    <div className="mt-8 text-center text-sm text-zinc-500 border-t border-zinc-800 pt-6">
                        Don't have an account?{' '}
                        <Link href="/signup" className="text-emerald-400 font-medium hover:text-emerald-300 transition-colors">
                            Sign up now
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
