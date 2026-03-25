import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import '../styles/Landing.css';

// ── Scroll reveal hook ────────────────────────────────────────────────────────
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.lp-reveal');
    const io = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('lp-visible'); }),
      { threshold: 0.12 }
    );
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);
}

// ── Data ──────────────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: '🤖', title: 'AI-Powered Questions', glow: '#6366f1',
    bg: 'rgba(99,102,241,0.12)', tag: 'Core', tagColor: 'rgba(99,102,241,0.2)', tagText: '#a5b4fc',
    desc: 'Gemini AI generates role-specific, adaptive questions tailored to your resume and job description in real time.',
  },
  {
    icon: '🎙️', title: 'Voice & Text Modes', glow: '#8b5cf6',
    bg: 'rgba(139,92,246,0.12)', tag: 'Interactive', tagColor: 'rgba(139,92,246,0.2)', tagText: '#c4b5fd',
    desc: 'Answer naturally by speaking or typing. Our speech recognition captures every word with high accuracy.',
  },
  {
    icon: '📊', title: 'Instant Performance Report', glow: '#06b6d4',
    bg: 'rgba(6,182,212,0.12)', tag: 'Analytics', tagColor: 'rgba(6,182,212,0.2)', tagText: '#67e8f9',
    desc: 'Get a detailed post-interview report with scores, strengths, improvements, and AI judge feedback.',
  },
  {
    icon: '👥', title: 'Mock Panel Interview', glow: '#10b981',
    bg: 'rgba(16,185,129,0.12)', tag: 'Realistic', tagColor: 'rgba(16,185,129,0.2)', tagText: '#6ee7b7',
    desc: 'Face a 3-member AI panel — Technical Lead, Hiring Manager, and HR — with cross-questioning dynamics.',
  },
  {
    icon: '🏆', title: 'Contest & Leaderboard', glow: '#f59e0b',
    bg: 'rgba(245,158,11,0.12)', tag: 'Competitive', tagColor: 'rgba(245,158,11,0.2)', tagText: '#fcd34d',
    desc: 'Compete in timed coding contests, climb the leaderboard, and benchmark yourself against peers.',
  },
  {
    icon: '🔒', title: 'Proctored Sessions', glow: '#ec4899',
    bg: 'rgba(236,72,153,0.12)', tag: 'Secure', tagColor: 'rgba(236,72,153,0.2)', tagText: '#f9a8d4',
    desc: 'Webcam monitoring, tab-switch detection, and session recording ensure a realistic exam environment.',
  },
];

const MODES = [
  {
    icon: '🏢', title: 'Company-Specific Interview',
    desc: 'Simulate interviews tailored to top companies like Google, Amazon, and Microsoft.',
    bg: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))',
    border: 'rgba(99,102,241,0.3)', color: '#a5b4fc', badge: 'Popular', badgeBg: 'rgba(99,102,241,0.3)',
  },
  {
    icon: '👥', title: 'Mock Panel Interview',
    desc: 'Three AI interviewers, real-time cross-questions, and a full performance report.',
    bg: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(6,182,212,0.1))',
    border: 'rgba(16,185,129,0.3)', color: '#6ee7b7', badge: 'New', badgeBg: 'rgba(16,185,129,0.3)',
  },
  {
    icon: '💻', title: 'Coding Challenge',
    desc: 'Solve algorithmic problems with live code execution and AI-driven hints.',
    bg: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(239,68,68,0.1))',
    border: 'rgba(245,158,11,0.3)', color: '#fcd34d', badge: 'Live', badgeBg: 'rgba(245,158,11,0.3)',
  },
  {
    icon: '🎯', title: 'Domain Simulation',
    desc: 'Immersive role-play scenarios for DevOps, AI/ML, Cloud, Cybersecurity, and more.',
    bg: 'linear-gradient(135deg, rgba(236,72,153,0.15), rgba(139,92,246,0.1))',
    border: 'rgba(236,72,153,0.3)', color: '#f9a8d4', badge: 'Immersive', badgeBg: 'rgba(236,72,153,0.3)',
  },
];

const STEPS = [
  { num: '01', icon: '📄', title: 'Upload Resume or JD', desc: 'Paste your job description or upload your resume. Intervora reads it instantly.' },
  { num: '02', icon: '⚙️', title: 'Choose Interview Mode', desc: 'Pick from company-specific, panel, coding, or simulation modes.' },
  { num: '03', icon: '🎤', title: 'Start Your Interview', desc: 'Answer AI-generated questions by voice or text in a realistic environment.' },
  { num: '04', icon: '📈', title: 'Get Your Report', desc: 'Receive a detailed performance report with scores, feedback, and action items.' },
];

const TESTIMONIALS = [
  {
    stars: '★★★★★', avatar: 'AK', avatarBg: 'rgba(99,102,241,0.2)', avatarColor: '#a5b4fc',
    text: '"Intervora\'s panel interview mode is incredibly realistic. The cross-questioning from three AI interviewers helped me prepare for my Google L5 interview. Got the offer!"',
    name: 'Arjun K.', role: 'Software Engineer @ Google',
  },
  {
    stars: '★★★★★', avatar: 'PS', avatarBg: 'rgba(16,185,129,0.2)', avatarColor: '#6ee7b7',
    text: '"The AI-generated questions were spot-on for my data science role. The performance report showed exactly where I was weak. Landed my dream job at a top fintech."',
    name: 'Priya S.', role: 'Data Scientist @ Stripe',
  },
  {
    stars: '★★★★★', avatar: 'MR', avatarBg: 'rgba(245,158,11,0.2)', avatarColor: '#fcd34d',
    text: '"The coding contest feature is addictive. I went from struggling with medium LeetCode to solving hards confidently. The leaderboard keeps me motivated every day."',
    name: 'Marcus R.', role: 'Backend Engineer @ Meta',
  },
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function LandingPage() {
  useReveal();
  const heroRef = useRef<HTMLDivElement>(null);

  // Parallax subtle effect on hero
  useEffect(() => {
    const handleScroll = () => {
      if (heroRef.current) {
        heroRef.current.style.transform = `translateY(${window.scrollY * 0.15}px)`;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="lp-root">
      {/* Animated Background */}
      <div className="lp-bg">
        <div className="lp-bg-grid" />
        <div className="lp-bg-orb lp-bg-orb-1" />
        <div className="lp-bg-orb lp-bg-orb-2" />
        <div className="lp-bg-orb lp-bg-orb-3" />
      </div>

      {/* Navbar */}
      <nav className="lp-nav">
        <Link to="/" className="lp-nav-logo">
          <div className="lp-nav-logo-icon">✦</div>
          <span className="lp-nav-logo-text"><span>Inter</span>vora</span>
        </Link>
        <div className="lp-nav-links">
          <a href="#features" className="lp-nav-link">Features</a>
          <a href="#modes" className="lp-nav-link">Interview Modes</a>
          <a href="#how" className="lp-nav-link">How It Works</a>
          <a href="#testimonials" className="lp-nav-link">Reviews</a>
        </div>
        <div className="lp-nav-actions">
          <Link to="/login" className="lp-btn-ghost">Sign In</Link>
          <Link to="/signup" className="lp-btn-primary">Get Started →</Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="lp-hero">
        <div ref={heroRef}>
          <div className="lp-hero-badge">
            <span className="lp-hero-badge-dot" />
            By Avanish Cowkur
          </div>
          <h1 className="lp-hero-title">
            <span className="lp-hero-title-line1">Your Interview Buddy,</span>
            <span className="lp-hero-title-line2">Intervora</span>
          </h1>
          <p className="lp-hero-sub">
            AI-powered mock interviews that adapt to your role, company, and skill level.
            Practice smarter, get hired faster.
          </p>
          <div className="lp-hero-actions">
            <Link to="/signup" className="lp-btn-hero lp-btn-hero-primary">
              Start Free Interview →
            </Link>
            <Link to="/login" className="lp-btn-hero lp-btn-hero-secondary">
              Sign In
            </Link>
          </div>
          <div className="lp-hero-stats">
            <div className="lp-stat">
              <div className="lp-stat-num">50K+</div>
              <div className="lp-stat-label">Interviews Completed</div>
            </div>
            <div className="lp-stat">
              <div className="lp-stat-num">94%</div>
              <div className="lp-stat-label">Success Rate</div>
            </div>
            <div className="lp-stat">
              <div className="lp-stat-num">200+</div>
              <div className="lp-stat-label">Job Roles Covered</div>
            </div>
            <div className="lp-stat">
              <div className="lp-stat-num">4.9★</div>
              <div className="lp-stat-label">User Rating</div>
            </div>
          </div>
        </div>

        {/* Hero Mockup */}
        <div className="lp-hero-visual">
          <div className="lp-hero-mockup">
            <div className="lp-mockup-bar">
              <div className="lp-mockup-dot" />
              <div className="lp-mockup-dot" />
              <div className="lp-mockup-dot" />
              <div className="lp-mockup-url">intervora.ai/interview/panel</div>
            </div>
            <div className="lp-mockup-body">
              <div className="lp-mockup-card">
                <div className="lp-mockup-card-icon">⚙️</div>
                <div className="lp-mockup-card-title">Technical Score</div>
                <div className="lp-mockup-card-bar">
                  <div className="lp-mockup-card-bar-fill" style={{ width: '82%', background: 'linear-gradient(90deg,#6366f1,#8b5cf6)' }} />
                </div>
                <div className="lp-mockup-card-score" style={{ color: '#a5b4fc' }}>82</div>
              </div>
              <div className="lp-mockup-card">
                <div className="lp-mockup-card-icon">💬</div>
                <div className="lp-mockup-card-title">Communication</div>
                <div className="lp-mockup-card-bar">
                  <div className="lp-mockup-card-bar-fill" style={{ width: '91%', background: 'linear-gradient(90deg,#10b981,#06b6d4)' }} />
                </div>
                <div className="lp-mockup-card-score" style={{ color: '#6ee7b7' }}>91</div>
              </div>
              <div className="lp-mockup-card">
                <div className="lp-mockup-card-icon">🏆</div>
                <div className="lp-mockup-card-title">Overall Grade</div>
                <div className="lp-mockup-card-bar">
                  <div className="lp-mockup-card-bar-fill" style={{ width: '87%', background: 'linear-gradient(90deg,#f59e0b,#ec4899)' }} />
                </div>
                <div className="lp-mockup-card-score" style={{ color: '#fcd34d' }}>A</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="lp-divider" />

      {/* ── Features ── */}
      <section id="features" className="lp-section lp-section-center">
        <div className="lp-reveal">
          <div className="lp-section-label">✦ Features</div>
          <h2 className="lp-section-title">Everything you need to <span>ace any interview</span></h2>
          <p className="lp-section-sub">From AI question generation to detailed performance analytics — Intervora covers every aspect of interview preparation.</p>
        </div>
        <div className="lp-features-grid">
          {FEATURES.map((f, i) => (
            <div key={i} className="lp-feature-card lp-reveal" style={{ transitionDelay: `${i * 0.08}s` }}>
              <div className="lp-feature-card-glow" style={{ background: f.glow }} />
              <div className="lp-feature-icon" style={{ background: f.bg }}>
                {f.icon}
              </div>
              <div className="lp-feature-title">{f.title}</div>
              <div className="lp-feature-desc">{f.desc}</div>
              <span className="lp-feature-tag" style={{ background: f.tagColor, color: f.tagText }}>{f.tag}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="lp-divider" />

      {/* ── Interview Modes ── */}
      <section id="modes" className="lp-section lp-section-center">
        <div className="lp-reveal">
          <div className="lp-section-label">🎯 Interview Modes</div>
          <h2 className="lp-section-title">Practice the way <span>real interviews happen</span></h2>
          <p className="lp-section-sub">Choose from multiple interview formats designed to mirror real-world hiring scenarios across all tech domains.</p>
        </div>
        <div className="lp-modes-grid">
          {MODES.map((m, i) => (
            <div key={i} className="lp-mode-card lp-reveal"
              style={{ background: m.bg, borderColor: m.border, transitionDelay: `${i * 0.1}s` }}>
              <span className="lp-mode-card-badge" style={{ background: m.badgeBg, color: m.color }}>{m.badge}</span>
              <div className="lp-mode-card-icon">{m.icon}</div>
              <div className="lp-mode-card-title" style={{ color: m.color }}>{m.title}</div>
              <div className="lp-mode-card-desc" style={{ color: 'rgba(255,255,255,0.65)' }}>{m.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="lp-divider" />

      {/* ── How It Works ── */}
      <section id="how" className="lp-section lp-section-center">
        <div className="lp-reveal">
          <div className="lp-section-label">⚡ How It Works</div>
          <h2 className="lp-section-title">From setup to offer in <span>4 simple steps</span></h2>
          <p className="lp-section-sub">Get started in under 2 minutes. No setup required — just sign up and start practicing.</p>
        </div>
        <div className="lp-steps">
          {STEPS.map((s, i) => (
            <div key={i} className="lp-step lp-reveal" style={{ transitionDelay: `${i * 0.1}s` }}>
              <div className="lp-step-num">{s.num}</div>
              <div className="lp-step-icon">{s.icon}</div>
              <div className="lp-step-title">{s.title}</div>
              <div className="lp-step-desc">{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="lp-divider" />

      {/* ── Testimonials ── */}
      <section id="testimonials" className="lp-section lp-section-center">
        <div className="lp-reveal">
          <div className="lp-section-label">💬 Testimonials</div>
          <h2 className="lp-section-title">Loved by <span>thousands of candidates</span></h2>
          <p className="lp-section-sub">Real stories from real people who landed their dream jobs with Intervora.</p>
        </div>
        <div className="lp-testimonials-grid">
          {TESTIMONIALS.map((t, i) => (
            <div key={i} className="lp-testimonial-card lp-reveal" style={{ transitionDelay: `${i * 0.1}s` }}>
              <div className="lp-testimonial-stars">{t.stars}</div>
              <p className="lp-testimonial-text">{t.text}</p>
              <div className="lp-testimonial-author">
                <div className="lp-testimonial-avatar" style={{ background: t.avatarBg, color: t.avatarColor }}>{t.avatar}</div>
                <div>
                  <div className="lp-testimonial-name">{t.name}</div>
                  <div className="lp-testimonial-role">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <div className="lp-cta-section">
        <div className="lp-cta-inner lp-reveal">
          <div className="lp-section-label" style={{ justifyContent: 'center' }}>🚀 Get Started Today</div>
          <h2 className="lp-cta-title">Ready to land your dream job?</h2>
          <p className="lp-cta-sub">Join thousands of candidates who use Intervora to prepare smarter and interview with confidence.</p>
          <div className="lp-cta-actions">
            <Link to="/signup" className="lp-btn-cta-primary">Start Free — No Credit Card →</Link>
            <Link to="/login" className="lp-btn-cta-secondary">Sign In</Link>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer className="lp-footer">
        <Link to="/" className="lp-footer-brand">
          <div className="lp-nav-logo-icon" style={{ width: 28, height: 28, fontSize: 14 }}>✦</div>
          <span><span>Inter</span>vora</span>
        </Link>
        <span className="lp-footer-copy">© 2026 Intervora. Your Interview Buddy.</span>
        <div className="lp-footer-links">
          <Link to="/login" className="lp-footer-link">Sign In</Link>
          <Link to="/signup" className="lp-footer-link">Sign Up</Link>
        </div>
      </footer>
    </div>
  );
}
