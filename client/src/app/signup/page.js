"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Signup() {
    const router = useRouter();
    const [formData, setFormData] = useState({ username: '', email: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleChange = (e) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const res = await fetch('http://localhost:9000/user/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Signup failed');

            setSuccess('Account created successfully! Redirecting to login...');
            setTimeout(() => router.push('/login'), 2000);
            
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4 font-sans text-stone-100">
            <div className="max-w-md w-full relative">
                {/* Decorative element */}
                <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-600 opacity-20 blur-xl"></div>
                
                <div className="relative bg-[#09090b] border border-zinc-800 rounded-2xl shadow-2xl p-8 backdrop-blur-sm">
                    <div className="text-center mb-8">
                        <h2 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">
                            Create Account
                        </h2>
                        <p className="text-zinc-500 mt-2 text-sm">Join the platform to get started</p>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 rounded-lg bg-red-950/50 border border-red-900 text-red-400 text-sm animate-pulse">
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="mb-4 p-3 rounded-lg bg-emerald-950/50 border border-emerald-900 text-emerald-400 text-sm">
                            {success}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-zinc-400 mb-1">Username</label>
                            <input 
                                type="text"
                                name="username"
                                value={formData.username}
                                onChange={handleChange}
                                required
                                className="w-full px-4 py-2.5 rounded-xl bg-zinc-900/50 border border-zinc-800 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-zinc-600"
                                placeholder="Your username"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-400 mb-1">Email</label>
                            <input 
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                required
                                className="w-full px-4 py-2.5 rounded-xl bg-zinc-900/50 border border-zinc-800 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-zinc-600"
                                placeholder="you@example.com"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-400 mb-1">Password</label>
                            <input 
                                type="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                required
                                className="w-full px-4 py-2.5 rounded-xl bg-zinc-900/50 border border-zinc-800 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-zinc-600"
                                placeholder="••••••••"
                            />
                        </div>

                        <button 
                            type="submit" 
                            disabled={loading}
                            className="w-full py-3 px-4 rounded-xl font-medium text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 focus:ring-4 focus:ring-indigo-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-[0.98]"
                        >
                            {loading ? 'Creating account...' : 'Sign up'}
                        </button>
                    </form>

                    <div className="mt-8 text-center text-sm text-zinc-500">
                        Already have an account?{' '}
                        <Link href="/login" className="text-indigo-400 font-medium hover:text-indigo-300 transition-colors">
                            Log in
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
