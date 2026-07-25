"use client";

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

const NAV_LINKS = [
  { href: '/intelligence', label: 'Intelligence', mobileVisible: true },
  { href: '/analytics', label: 'Analytics', mobileVisible: true },
  { href: '/reports', label: 'Reports', mobileVisible: true },
  { href: '/arena', label: 'Arena', mobileVisible: true },
  { href: '/chat', label: 'Ask AI ✨', mobileVisible: true, highlight: true },
];

export default function NavHeader() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Close on Escape
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileOpen(false);
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  function isActive(href: string) {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  return (
    <header className="border-b border-rs sticky top-0 z-50" style={{ background: 'hsla(230,20%,5%,0.85)', backdropFilter: 'blur(20px) saturate(1.3)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14 sm:h-[58px]">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group" aria-label="rAsh Score Home">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center shadow-lg shadow-primary-500/20 group-hover:shadow-primary-500/30 transition-shadow">
              <span className="text-white font-bold text-xs sm:text-sm">rS</span>
            </div>
            <span className="font-bold text-base sm:text-lg text-white hidden sm:block">
              rAsh <span className="text-rs-secondary">Score</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1 text-[13px]" aria-label="Main navigation">
            <Link
              href="/"
              className={`px-3 py-1.5 rounded-lg transition-all ${
                isActive('/') && pathname === '/'
                  ? 'text-white bg-white/[0.06]'
                  : 'text-rs-secondary hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              Home
            </Link>
            {NAV_LINKS.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  isActive(link.href)
                    ? link.highlight ? 'text-purple-300 bg-purple-500/10' : 'text-white bg-white/[0.06]'
                    : link.highlight ? 'text-purple-400 hover:text-purple-300 hover:bg-purple-500/[0.06]' : 'text-rs-secondary hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                {link.label}
              </Link>
            ))}

            <div className="w-px h-5 bg-white/[0.06] mx-1.5" />

            <Link
              href="/dashboard"
              className={`px-4 py-1.5 rounded-lg font-medium text-sm transition-all ${
                isActive('/dashboard')
                  ? 'bg-gradient-to-r from-primary-500 to-purple-500 text-white shadow-lg shadow-primary-500/25'
                  : 'bg-white/[0.05] text-white hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.1]'
              }`}
            >
              🇮🇳 India rAsh Index
            </Link>
          </nav>

          {/* Mobile: CTA + Hamburger */}
          <div className="flex items-center gap-2.5 md:hidden">
            <Link
              href="/dashboard"
              className="px-3 py-1.5 bg-gradient-to-r from-primary-500 to-purple-600 text-white rounded-lg font-medium text-xs shadow-lg shadow-primary-500/20"
            >
              🇮🇳 Index
            </Link>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-2 text-rs-secondary hover:text-white transition-colors rounded-lg hover:bg-white/[0.04]"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 top-14 z-50 md:hidden">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          
          {/* Menu Panel */}
          <nav className="relative border-b shadow-2xl" style={{ background: 'var(--rs-bg-elevated)', borderColor: 'var(--rs-border)' }} aria-label="Mobile navigation">
            <div className="px-4 py-3 space-y-0.5">
              <Link
                href="/"
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  pathname === '/' ? 'bg-white/[0.06] text-white' : 'text-rs-secondary hover:text-white hover:bg-white/[0.03]'
                }`}
              >
                Home
              </Link>
              {NAV_LINKS.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    isActive(link.href)
                      ? link.highlight
                        ? 'bg-purple-500/10 text-purple-300'
                        : 'bg-white/[0.06] text-white'
                      : link.highlight
                        ? 'text-purple-400 hover:text-purple-300 hover:bg-purple-500/[0.04]'
                        : 'text-rs-secondary hover:text-white hover:bg-white/[0.03]'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/dashboard"
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive('/dashboard')
                    ? 'bg-primary-500/10 text-primary-400'
                    : 'text-rs-secondary hover:bg-white/[0.03]'
                }`}
              >
                🇮🇳 India rAsh Index
              </Link>
            </div>
            
            <div className="px-8 py-3 border-t" style={{ borderColor: 'var(--rs-border)' }}>
              <p className="text-[10px] font-mono" style={{ color: 'var(--rs-text-muted)' }}>rashscore.live</p>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
