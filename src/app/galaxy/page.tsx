"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';

// ── Types ───────────────────────────────────────────────────────────
interface BrandStar {
  brand: string;
  industry_id: string;
  industry_name: string;
  score: number;
  recommendation: number;
  sentiment: number;
  prominence: number;
  accuracy: number;
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  radius: number;
  twinklePhase: number;
  twinkleSpeed: number;
  orbitAngle: number;
  orbitSpeed: number;
}

interface BackgroundStar {
  x: number;
  y: number;
  r: number;
  alpha: number;
  twinkle: number;
}

const INDUSTRY_COLORS: Record<string, string> = {
  technology: '#6366f1',
  automotive: '#f59e0b',
  ecommerce: '#10b981',
  fashion: '#ec4899',
  'food-beverage': '#f97316',
  healthcare: '#06b6d4',
  finance: '#8b5cf6',
  telecom: '#3b82f6',
  entertainment: '#e11d48',
  travel: '#14b8a6',
  energy: '#eab308',
  fmcg: '#22c55e',
  realestate: '#a855f7',
  edtech: '#0ea5e9',
  logistics: '#64748b',
  'consumer-electronics': '#7c3aed',
  'mobile-phones': '#2563eb',
  'home-appliances': '#059669',
  'two-wheelers': '#dc2626',
};

function getColor(id: string): string {
  return INDUSTRY_COLORS[id] || '#6366f1';
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const v = parseInt(hex.slice(1), 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}

export default function GalaxyPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<BrandStar[]>([]);
  const bgStarsRef = useRef<BackgroundStar[]>([]);
  const mouseRef = useRef({ x: -9999, y: -9999, active: false });
  const hoveredRef = useRef<BrandStar | null>(null);
  const animFrameRef = useRef<number>(0);
  const timeRef = useRef(0);
  const [hovered, setHovered] = useState<BrandStar | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ brands: 0, industries: 0 });

  // Generate background stars
  const generateBgStars = useCallback((w: number, h: number) => {
    const stars: BackgroundStar[] = [];
    for (let i = 0; i < 300; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.3 + Math.random() * 1.2,
        alpha: 0.1 + Math.random() * 0.4,
        twinkle: Math.random() * Math.PI * 2,
      });
    }
    bgStarsRef.current = stars;
  }, []);

  // Fetch data
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/intelligence');
        if (!res.ok) return;
        const data = await res.json();

        const allStars: BrandStar[] = [];
        const industries = (data.industryLeaderboard || []).filter((i: { avg_score: number }) => i.avg_score > 0);

        const brandPromises = industries.map(async (ind: { industry_id: string; industry_name: string }) => {
          try {
            const bRes = await fetch(`/api/brands?industry=${ind.industry_id}&top=10`);
            if (!bRes.ok) return [];
            const bData = await bRes.json();
            return (bData.brands || []).map((b: {
              brand: string; score: number;
              recommendation: number; sentiment: number;
              prominence: number; accuracy: number;
            }) => ({
              brand: b.brand, industry_id: ind.industry_id, industry_name: ind.industry_name,
              score: b.score, recommendation: b.recommendation || 0,
              sentiment: b.sentiment || 0, prominence: b.prominence || 0, accuracy: b.accuracy || 0,
            }));
          } catch { return []; }
        });

        const allBrands = (await Promise.all(brandPromises)).flat().filter((b: { score: number }) => b.score > 0);

        // Layout: spread industries in a wide ring
        const W = window.innerWidth;
        const H = window.innerHeight;
        const cx = W / 2;
        const cy = H / 2;
        const ringRadius = Math.min(cx, cy) * 0.6;

        industries.forEach((ind: { industry_id: string }, iIdx: number) => {
          const angle = (iIdx / industries.length) * Math.PI * 2 - Math.PI / 2;
          const clusterCX = cx + Math.cos(angle) * ringRadius;
          const clusterCY = cy + Math.sin(angle) * ringRadius;

          const indBrands = allBrands.filter((b: { industry_id: string }) => b.industry_id === ind.industry_id);
          indBrands.forEach((b: {
            brand: string; industry_id: string; industry_name: string;
            score: number; recommendation: number; sentiment: number;
            prominence: number; accuracy: number;
          }, bIdx: number) => {
            // Spiral placement within cluster
            const bAngle = (bIdx / Math.max(indBrands.length, 1)) * Math.PI * 2;
            const dist = 15 + bIdx * 5 + Math.random() * 25;
            const x = clusterCX + Math.cos(bAngle) * dist;
            const y = clusterCY + Math.sin(bAngle) * dist;

            allStars.push({
              ...b, x, y, baseX: x, baseY: y,
              radius: 1.5 + (b.score / 100) * 4.5,
              twinklePhase: Math.random() * Math.PI * 2,
              twinkleSpeed: 0.3 + Math.random() * 1.5,
              orbitAngle: bAngle,
              orbitSpeed: 0.0002 + Math.random() * 0.0006,
            });
          });
        });

        starsRef.current = allStars;
        setStats({ brands: allStars.length, industries: industries.length });
        generateBgStars(W, H);
        setLoading(false);
      } catch (e) {
        console.error('Galaxy load error:', e);
        setLoading(false);
      }
    }
    load();
  }, [generateBgStars]);

  // Animation
  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const stars = starsRef.current;
    const bgStars = bgStarsRef.current;
    const mouse = mouseRef.current;
    timeRef.current += 1;
    const t = timeRef.current;

    // ── Clear fully ──
    ctx.fillStyle = '#05050c';
    ctx.fillRect(0, 0, W, H);

    // ── Background stars ──
    for (const bg of bgStars) {
      const twinkle = 0.5 + 0.5 * Math.sin(t * 0.015 + bg.twinkle);
      ctx.beginPath();
      ctx.arc(bg.x, bg.y, bg.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200, 210, 255, ${bg.alpha * twinkle})`;
      ctx.fill();
    }

    // ── Industry nebula glows ──
    const industryGroups: Record<string, { cx: number; cy: number; count: number }> = {};
    for (const s of stars) {
      if (!industryGroups[s.industry_id]) industryGroups[s.industry_id] = { cx: 0, cy: 0, count: 0 };
      industryGroups[s.industry_id].cx += s.x;
      industryGroups[s.industry_id].cy += s.y;
      industryGroups[s.industry_id].count++;
    }

    for (const [id, g] of Object.entries(industryGroups)) {
      const avgX = g.cx / g.count;
      const avgY = g.cy / g.count;
      const rgb = hexToRgb(getColor(id));
      const grad = ctx.createRadialGradient(avgX, avgY, 0, avgX, avgY, 100);
      grad.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.06)`);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(avgX, avgY, 100, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Constellation lines (same industry, close stars) ──
    ctx.lineWidth = 0.4;
    for (let i = 0; i < stars.length; i++) {
      for (let j = i + 1; j < stars.length; j++) {
        if (stars[i].industry_id !== stars[j].industry_id) continue;
        const dx = stars[i].x - stars[j].x;
        const dy = stars[i].y - stars[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 50) {
          const alpha = (1 - dist / 50) * 0.12;
          const rgb = hexToRgb(getColor(stars[i].industry_id));
          ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
          ctx.beginPath();
          ctx.moveTo(stars[i].x, stars[i].y);
          ctx.lineTo(stars[j].x, stars[j].y);
          ctx.stroke();
        }
      }
    }

    // ── Update & draw stars ──
    let newHovered: BrandStar | null = null;

    for (const star of stars) {
      // Gentle orbit
      star.orbitAngle += star.orbitSpeed;
      star.x = star.baseX + Math.cos(star.orbitAngle) * 4;
      star.y = star.baseY + Math.sin(star.orbitAngle) * 4;

      // Gentle mouse repulsion (push away, not attract)
      if (mouse.active) {
        const dx = star.x - mouse.x;
        const dy = star.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120 && dist > 1) {
          const force = (120 - dist) / 120 * 8;
          star.x += (dx / dist) * force;
          star.y += (dy / dist) * force;
        }
      }

      // Twinkle
      const twinkle = 0.6 + 0.4 * Math.sin(t * 0.02 * star.twinkleSpeed + star.twinklePhase);
      const r = star.radius * (0.9 + twinkle * 0.2);
      const color = getColor(star.industry_id);
      const rgb = hexToRgb(color);

      // Check hover
      if (mouse.active) {
        const dx = mouse.x - star.x;
        const dy = mouse.y - star.y;
        if (Math.sqrt(dx * dx + dy * dy) < Math.max(r * 3, 12)) {
          newHovered = star;
        }
      }

      const isHovered = newHovered === star;

      // Outer glow for bright stars
      if (star.score >= 65 || isHovered) {
        const glowSize = isHovered ? r * 8 : r * 4;
        const glowAlpha = isHovered ? 0.25 : 0.08;
        const glow = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, glowSize);
        glow.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${glowAlpha})`);
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(star.x, star.y, glowSize, 0, Math.PI * 2);
        ctx.fill();
      }

      // Star body
      ctx.beginPath();
      ctx.arc(star.x, star.y, isHovered ? r * 1.8 : r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${twinkle})`;
      ctx.fill();

      // White core for high-score stars
      if (star.score >= 55) {
        ctx.beginPath();
        ctx.arc(star.x, star.y, r * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${twinkle * 0.5})`;
        ctx.fill();
      }
    }

    // ── Hovered star label (drawn AFTER all stars) ──
    if (newHovered) {
      const s = newHovered;
      ctx.font = 'bold 12px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';

      // Background pill
      const text = s.brand;
      const textW = ctx.measureText(text).width;
      const pillX = s.x - textW / 2 - 8;
      const pillY = s.y - s.radius * 3 - 20;
      ctx.fillStyle = 'rgba(10, 10, 20, 0.85)';
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, textW + 16, 22, 6);
      ctx.fill();
      ctx.strokeStyle = getColor(s.industry_id) + '40';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = 'white';
      ctx.fillText(text, s.x, pillY + 15);

      // Score badge
      ctx.font = '10px Inter, system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText(`${s.score}/100 · ${s.industry_name}`, s.x, pillY + 34);
    }

    if (newHovered !== hoveredRef.current) {
      hoveredRef.current = newHovered;
      setHovered(newHovered);
    }

    animFrameRef.current = requestAnimationFrame(animate);
  }, []);

  // Canvas setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(dpr, dpr);
      generateBgStars(window.innerWidth, window.innerHeight);
    };

    resize();
    window.addEventListener('resize', resize);

    const handleMouse = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY, active: true };
    };
    const handleLeave = () => {
      mouseRef.current = { ...mouseRef.current, active: false };
    };

    canvas.addEventListener('mousemove', handleMouse);
    canvas.addEventListener('mouseleave', handleLeave);
    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', handleMouse);
      canvas.removeEventListener('mouseleave', handleLeave);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [animate, generateBgStars]);

  const handleClick = useCallback(() => {
    if (hoveredRef.current) {
      window.location.href = `/brand/${encodeURIComponent(hoveredRef.current.brand)}`;
    }
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#05050c]" style={{ cursor: hovered ? 'pointer' : 'default' }}>
      <canvas ref={canvasRef} className="absolute inset-0" onClick={handleClick} />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-[#05050c]">
          <div className="text-center">
            <div className="w-16 h-16 border-[3px] border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-6" />
            <p className="text-sm" style={{ color: 'var(--rs-text-secondary)' }}>Generating brand universe...</p>
          </div>
        </div>
      )}

      {/* Title */}
      <div className="absolute top-20 left-5 z-10 pointer-events-none">
        <h1 className="text-lg font-bold text-white/70">Brand Galaxy</h1>
        <p className="text-[10px] mt-0.5" style={{ color: 'var(--rs-text-muted)' }}>{stats.brands} stars · {stats.industries} nebulae</p>
      </div>

      {/* Nav */}
      <div className="absolute top-20 right-5 z-10 flex gap-2">
        <Link href="/dashboard" className="text-[10px] hover:text-white transition-colors bg-black/50 border border-white/[0.06] px-2.5 py-1.5 rounded-lg backdrop-blur-sm" style={{ color: 'var(--rs-text-muted)' }}>
          Dashboard
        </Link>
        <Link href="/intelligence" className="text-[10px] hover:text-white transition-colors bg-black/50 border border-white/[0.06] px-2.5 py-1.5 rounded-lg backdrop-blur-sm" style={{ color: 'var(--rs-text-muted)' }}>
          Intelligence
        </Link>
      </div>

      {/* Legend */}
      <div className="absolute bottom-5 left-5 z-10 pointer-events-none">
        <div className="flex flex-wrap gap-x-3 gap-y-1 max-w-sm">
          {Object.entries(INDUSTRY_COLORS).filter(([id]) =>
            starsRef.current.some(s => s.industry_id === id)
          ).slice(0, 12).map(([id, color]) => (
            <div key={id} className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 3px ${color}` }} />
              <span className="text-[8px] capitalize" style={{ color: 'var(--rs-text-muted)' }}>{id.replace(/-/g, ' ')}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Hovered brand detail card */}
      {hovered && (
        <div className="absolute bottom-5 right-5 z-10 bg-black/80 border border-white/10 rounded-xl p-4 backdrop-blur-md w-52 pointer-events-none">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: getColor(hovered.industry_id), boxShadow: `0 0 6px ${getColor(hovered.industry_id)}` }} />
            <h3 className="text-xs font-bold text-white truncate">{hovered.brand}</h3>
          </div>
          <p className="text-[9px] mb-2" style={{ color: 'var(--rs-text-muted)' }}>{hovered.industry_name}</p>

          <div className="flex items-baseline gap-1 mb-3">
            <span className="text-xl font-bold text-white tabular-nums">{hovered.score}</span>
            <span className="text-[9px]" style={{ color: 'var(--rs-text-muted)' }}>/100</span>
          </div>

          <div className="space-y-1">
            {[
              { l: 'Rec', v: hovered.recommendation, m: 40 },
              { l: 'Sent', v: hovered.sentiment, m: 30 },
              { l: 'Prom', v: hovered.prominence, m: 20 },
              { l: 'Acc', v: hovered.accuracy, m: 10 },
            ].map(d => (
              <div key={d.l} className="flex items-center gap-2">
                <span className="text-[8px] w-6" style={{ color: 'var(--rs-text-muted)' }}>{d.l}</span>
                <div className="flex-1 h-1 bg-white/[0.05] rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{
                    width: `${(d.v / d.m) * 100}%`,
                    backgroundColor: getColor(hovered.industry_id),
                  }} />
                </div>
                <span className="text-[8px] tabular-nums w-6 text-right" style={{ color: 'var(--rs-text-muted)' }}>{d.v}</span>
              </div>
            ))}
          </div>
          <p className="text-[8px] mt-2 text-center" style={{ color: 'var(--rs-text-faint)' }}>click star to explore →</p>
        </div>
      )}
    </div>
  );
}
