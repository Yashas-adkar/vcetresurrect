import { useState } from 'react'
import { motion } from 'framer-motion'
import Workspace from './Workspace.jsx'
import {
  ArrowDown,
  ArrowRight,
  Brain,
  BrainCircuit,
  Check,
  Clock3,
  FileText,
  Files,
  Menu,
  Network,
  Sparkles,
  X,
} from 'lucide-react'
import './App.css'

const reveal = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] } },
}

function Reveal({ children, className = '', delay = 0 }) {
  return (
    <motion.div
      className={className}
      variants={reveal}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.18 }}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  )
}

function Brand({ footer = false }) {
  return (
    <a className={`brand${footer ? ' brand-footer' : ''}`} href="#home" aria-label="Insight Forge home">
      <span className="brand-mark"><BrainCircuit size={21} strokeWidth={1.8} /></span>
      <span>INSIGHT <b>FORGE</b></span>
    </a>
  )
}

function MiniGraph({ className = '' }) {
  return (
    <svg className={`mini-graph ${className}`} viewBox="0 0 300 180" role="img" aria-label="Connected research concepts">
      <defs>
        <linearGradient id="graphLine" x1="0" x2="1">
          <stop offset="0%" stopColor="#35d8e8" stopOpacity=".14" />
          <stop offset="100%" stopColor="#9b7bff" stopOpacity=".8" />
        </linearGradient>
        <radialGradient id="nodeGlow">
          <stop stopColor="#6beaff" stopOpacity=".8" />
          <stop offset="1" stopColor="#6beaff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g className="graph-lines" fill="none" stroke="url(#graphLine)" strokeWidth="1.2">
        <path d="M56 90 112 48 170 76 235 38M56 90l64 47 50-61 48 50 17-88M112 48l8 89m50-61 43 12" />
        <path d="M56 90 170 76 218 126" strokeDasharray="3 5" />
      </g>
      {[
        [56, 90, 5, '#35d8e8'], [112, 48, 4, '#a18aff'], [170, 76, 7, '#63e5ef'],
        [235, 38, 4, '#a18aff'], [120, 137, 5, '#a18aff'], [218, 126, 5, '#48d9df'],
        [213, 94, 3, '#d2c8ff'],
      ].map(([cx, cy, r, color], index) => (
        <g key={`${cx}-${cy}`}>
          <motion.circle cx={cx} cy={cy} r={r * 3.5} fill="url(#nodeGlow)" animate={{ opacity: [0.12, 0.42, 0.12] }} transition={{ duration: 3 + index * 0.25, repeat: Infinity }} />
          <motion.circle cx={cx} cy={cy} r={r} fill={color} animate={{ scale: [1, 1.18, 1] }} transition={{ duration: 2.4 + index * 0.2, repeat: Infinity }} style={{ transformOrigin: `${cx}px ${cy}px` }} />
        </g>
      ))}
    </svg>
  )
}

function HeroVisual() {
  return (
    <div className="visual-stage" aria-label="Illustration of research transformed into connected knowledge">
      <div className="visual-orbit orbit-one" />
      <div className="visual-orbit orbit-two" />
      <svg className="hero-connectors" viewBox="0 0 620 460" aria-hidden="true">
        <defs>
          <linearGradient id="flow" x1="0" x2="1">
            <stop stopColor="#38dce9" stopOpacity=".08" />
            <stop offset=".5" stopColor="#63e5ef" stopOpacity=".8" />
            <stop offset="1" stopColor="#a78bfa" stopOpacity=".35" />
          </linearGradient>
        </defs>
        <path d="M180 190 C230 170 235 188 274 210M355 230 C405 210 416 196 456 188" fill="none" stroke="url(#flow)" strokeWidth="1.5" strokeDasharray="5 7" />
        <circle cx="180" cy="190" r="3" fill="#40dce9" /><circle cx="456" cy="188" r="3" fill="#a78bfa" />
      </svg>
      <motion.div className="document-card glass-card" animate={{ y: [0, -8, 0], rotate: [-1, -0.5, -1] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}>
        <div className="doc-topline"><span className="eyebrow">RESEARCH PAPER</span><span className="page-badge">48 PAGES</span></div>
        <div className="doc-symbol"><FileText size={17} /></div>
        <h3>Artificial Intelligence and the Future of Intelligent Learning Systems</h3>
        <p className="doc-meta">JOURNAL OF EMERGING EDUCATION · 2024</p>
        <div className="doc-rule" />
        <div className="text-lines"><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
        <div className="doc-foot"><span>ABSTRACT</span><span>01 — 48</span></div>
      </motion.div>
      <motion.div className="processing-core" animate={{ y: [0, 7, 0], scale: [1, 1.025, 1] }} transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}>
        <span className="core-ring ring-a" /><span className="core-ring ring-b" />
        <div className="core-icon"><BrainCircuit size={27} strokeWidth={1.5} /></div>
        <span className="core-caption">SYNTHESIZING</span>
        <span className="core-dots"><i /><i /><i /></span>
      </motion.div>
      <motion.div className="knowledge-card glass-card" animate={{ y: [0, 8, 0], rotate: [1, 0.4, 1] }} transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}>
        <div className="output-top"><span className="output-spark"><Sparkles size={14} /></span><span className="eyebrow">KNOWLEDGE EXTRACTED</span></div>
        <MiniGraph className="hero-graph" />
        <div className="output-stats">
          <div><b>12</b><span>Core concepts</span></div>
          <div><b>08</b><span>Key findings</span></div>
          <div><b>05</b><span>Research themes</span></div>
        </div>
        <div className="output-ready"><span /> INSIGHT MAP READY</div>
      </motion.div>
      <div className="visual-index"><span>01</span><i /> RESEARCH, REFRAMED</div>
      <div className="floating-label label-left"><span className="label-dot cyan" /> Dense information</div>
      <div className="floating-label label-right"><span className="label-dot violet" /> Connected insight</div>
    </div>
  )
}

const problems = [
  { icon: Files, number: '01', title: 'Too Much Information', description: 'Research papers contain hundreds of pages of information, making it difficult to identify what actually matters.', tint: 'cyan' },
  { icon: Brain, number: '02', title: 'Disconnected Concepts', description: 'Important concepts, relationships and research connections are buried inside dense documents.', tint: 'violet' },
  { icon: Clock3, number: '03', title: 'Hours Lost in Reading', description: 'Finding the insights needed for understanding and decision-making takes valuable time.', tint: 'blue' },
]

const steps = [
  { icon: FileText, number: '01', title: 'Upload', description: 'Upload your research paper and let the system extract its contents.' },
  { icon: Sparkles, number: '02', title: 'Understand', description: 'AI identifies the central ideas, important concepts, findings and relationships.' },
  { icon: Network, number: '03', title: 'Explore', description: 'Explore compressed knowledge and visualize how ideas connect.' },
]

function CompressionMockup() {
  return (
    <div className="compression-visual">
      <div className="original-paper mock-panel">
        <div className="mock-heading"><span className="mock-file"><FileText size={15} /></span><span>ORIGINAL DOCUMENT</span><span className="mock-page">48 Pages</span></div>
        <div className="mock-paper-lines"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
      </div>
      <motion.div className="compress-arrow" animate={{ y: [0, 4, 0] }} transition={{ duration: 2, repeat: Infinity }}><ArrowDown size={18} /><span>AI DISTILLATION</span></motion.div>
      <div className="compressed-paper mock-panel">
        <div className="mock-heading"><span className="mock-file ai-file"><Sparkles size={14} /></span><span>AI-COMPRESSED KNOWLEDGE</span></div>
        <div className="summary-title">Research Overview</div>
        <div className="summary-list">
          {['Research Objectives', 'Methodology', 'Key Findings', 'Limitations', 'Conclusion'].map((item) => <div key={item}><Check size={12} />{item}</div>)}
        </div>
      </div>
      <span className="compression-glow" />
    </div>
  )
}

function KnowledgeMap() {
  const nodes = [
    { x: 52, y: 52, label: 'Artificial Intelligence', cls: 'node-main' },
    { x: 175, y: 26, label: 'Machine Learning', cls: 'node-violet' },
    { x: 242, y: 88, label: 'Deep Learning', cls: 'node-cyan' },
    { x: 144, y: 142, label: 'Research Findings', cls: 'node-purple' },
    { x: 42, y: 140, label: 'Applications', cls: 'node-blue' },
  ]
  return (
    <div className="map-visual">
      <div className="map-grid" />
      <svg viewBox="0 0 300 180" className="map-lines" aria-hidden="true">
        <defs><linearGradient id="mapStroke"><stop stopColor="#46dce8" stopOpacity=".35" /><stop offset="1" stopColor="#a78bfa" stopOpacity=".7" /></linearGradient></defs>
        <path d="M52 52 175 26 242 88 144 142 42 140 52 52M52 52 242 88M175 26 144 142M42 140 242 88" fill="none" stroke="url(#mapStroke)" strokeWidth="1.2" strokeDasharray="4 5" />
      </svg>
      {nodes.map(({ x, y, label, cls }, index) => (
        <motion.div className={`map-node ${cls}`} key={label} style={{ left: `${x / 3}%`, top: `${y / 1.8}%` }} animate={{ y: [0, index % 2 ? -4 : 4, 0] }} transition={{ duration: 3 + index * 0.35, repeat: Infinity, ease: 'easeInOut' }}>
          <span />{label}
        </motion.div>
      ))}
      <div className="map-caption"><span className="pulse-dot" /> LIVE CONCEPT RELATIONSHIPS</div>
    </div>
  )
}

function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  if (new URLSearchParams(window.location.search).get('workspace') === '1') {
    return <Workspace />
  }
  const closeMenu = () => setMenuOpen(false)
  const links = [
    ['How It Works', '#how-it-works'],
    ['Features', '#features'],
    ['Knowledge Graph', '#knowledge-graph'],
  ]

  return (
    <main>
      <header className="site-header">
        <nav className="navbar" aria-label="Main navigation">
          <Brand />
          <div className={`nav-links${menuOpen ? ' nav-open' : ''}`}>
            {links.map(([label, href]) => <a key={href} href={href} onClick={closeMenu}>{label}</a>)}
            <a className="mobile-nav-cta" href="#how-it-works" onClick={closeMenu}>Get Started <ArrowRight size={15} /></a>
          </div>
          <div className="nav-actions"><a className="sign-in" href="#home">Sign In</a><motion.a className="button button-small" href="#how-it-works" whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>Get Started <ArrowRight size={15} /></motion.a></div>
          <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen}>{menuOpen ? <X size={21} /> : <Menu size={21} />}</button>
        </nav>
      </header>

      <section className="hero-section" id="home">
        <div className="hero-grid">
          <div className="hero-copy">
            <motion.div className="hero-kicker" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
              <span className="kicker-icon"><Sparkles size={13} /></span> AI-POWERED RESEARCH INTELLIGENCE
            </motion.div>
            <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22, duration: 0.75 }}>
              Many Pages of<br />Research.<br /><span>One Clear<br className="mobile-break" /> Understanding.</span>
            </motion.h1>
            <motion.p className="hero-description" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.48 }}>
              Stop drowning in research papers. Transform dense academic documents into structured insights, connected knowledge and meaningful understanding.
            </motion.p>
            <motion.div className="hero-actions" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
              <motion.a className="button" href="/?workspace=1" target="_blank" rel="noopener noreferrer" whileHover={{ y: -3, boxShadow: '0 12px 36px rgba(48, 213, 230, .24)' }} whileTap={{ scale: 0.97 }}>Start Exploring <ArrowRight size={17} /></motion.a>
              <a className="text-button" href="#how-it-works">Discover How It Works <span><ArrowRight size={15} /></span></a>
            </motion.div>
            <motion.div className="trust-line" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.82 }}>
              <span className="trust-icon"><Check size={12} /></span>
              From overwhelming information to actionable knowledge.
            </motion.div>
          </div>
          <motion.div className="hero-art" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1, delay: 0.3 }}>
            <HeroVisual />
          </motion.div>
        </div>
        <div className="hero-bottom"><span>BUILT FOR THE CURIOUS</span><span className="hero-scroll"><i /> SCROLL TO EXPLORE</span><span>RAPID KNOWLEDGE INTERNALIZATION</span></div>
      </section>

      <section className="problem-section section-wrap" id="problem">
        <Reveal className="section-heading">
          <span className="section-kicker">THE CHALLENGE <i /></span>
          <h2>Research shouldn’t feel like<br /><span>information overload.</span></h2>
          <p>Great ideas are hidden in the noise. Finding them shouldn’t take forever.</p>
        </Reveal>
        <div className="problem-grid">
          {problems.map(({ icon: Icon, number, title, description, tint }, index) => (
            <Reveal key={number} delay={index * 0.1}>
              <motion.article className={`problem-card ${tint}`} whileHover={{ y: -6, borderColor: 'rgba(86, 214, 230, .35)' }} transition={{ duration: 0.25 }}>
                <div className="problem-card-top"><span className="problem-icon"><Icon size={20} strokeWidth={1.7} /></span><span className="card-number">{number} / 03</span></div>
                <h3>{title}</h3><p>{description}</p>
                <div className="card-decoration"><i /><i /><i /><i /><i /><i /><i /></div>
              </motion.article>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="solution-section section-wrap" id="features">
        <Reveal className="section-heading solution-heading">
          <span className="section-kicker">A CLEARER WAY FORWARD <i /></span>
          <h2>From pages to <span>understanding.</span></h2>
          <p>Insight Forge transforms research documents into an organized knowledge experience.</p>
        </Reveal>
        <div className="feature-grid">
          <Reveal>
            <motion.article className="feature-card compression-card" whileHover={{ y: -4 }} transition={{ duration: 0.25 }}>
              <div className="feature-copy">
                <span className="feature-badge"><Sparkles size={12} /> AI-POWERED SUMMARIZATION</span>
                <div className="feature-icon"><FileText size={21} /></div>
                <h3>Understand More.<br />Read Less.</h3>
                <p>Transform lengthy research papers into concise, structured knowledge without losing the essential ideas.</p>
              </div>
              <CompressionMockup />
            </motion.article>
          </Reveal>
          <Reveal delay={0.12}>
            <motion.article className="feature-card graph-card" id="knowledge-graph" whileHover={{ y: -4 }} transition={{ duration: 0.25 }}>
              <div className="feature-copy">
                <span className="feature-badge violet-badge"><Network size={12} /> INTERACTIVE KNOWLEDGE MAP</span>
                <div className="feature-icon violet-icon"><Network size={21} /></div>
                <h3>See How Ideas<br />Connect.</h3>
                <p>Explore the relationships between concepts, discoveries and findings through an interactive knowledge map.</p>
              </div>
              <KnowledgeMap />
            </motion.article>
          </Reveal>
        </div>
      </section>

      <section className="steps-section" id="how-it-works">
        <div className="section-wrap steps-wrap">
          <Reveal className="section-heading">
            <span className="section-kicker">THREE STEPS. A NEW PERSPECTIVE. <i /></span>
            <h2>Knowledge, <span>in motion.</span></h2>
            <p>A simpler path from dense research to a deeper understanding.</p>
          </Reveal>
          <div className="steps-grid">
            {steps.map(({ icon: Icon, number, title, description }, index) => (
              <Reveal key={number} delay={index * 0.12}>
                <article className="step-card">
                  <div className="step-visual"><span className="step-number">{number}</span><span className="step-icon"><Icon size={21} /></span></div>
                  <h3>{title}</h3><p>{description}</p>
                </article>
              </Reveal>
            ))}
            <div className="steps-connector"><i /><i /></div>
          </div>
        </div>
      </section>

      <section className="cta-section section-wrap">
        <div className="cta-panel">
          <div className="cta-orb orb-one" /><div className="cta-orb orb-two" />
          <Reveal className="cta-content">
            <span className="section-kicker"><span className="cta-spark"><Sparkles size={13} /></span> YOUR NEXT BIG IDEA STARTS HERE</span>
            <h2>Turn information<br />into <span>insight.</span></h2>
            <p>Spend less time searching through pages.<br className="desktop-break" /> Spend more time understanding ideas.</p>
            <motion.a className="button cta-button" href="#features" whileHover={{ y: -3 }} whileTap={{ scale: 0.97 }}>Explore Research Intelligence <ArrowRight size={17} /></motion.a>
          </Reveal>
          <div className="cta-decoration" aria-hidden="true"><div className="cta-ring ring-outer" /><div className="cta-ring ring-inner" /><div className="cta-center"><BrainCircuit size={34} /></div><i className="cta-node n1" /><i className="cta-node n2" /><i className="cta-node n3" /></div>
        </div>
      </section>

      <footer className="footer" id="footer">
        <div className="footer-inner">
          <div className="footer-brand"><Brand footer /><p>Making knowledge easier to understand.</p></div>
          <div className="footer-links"><a href="#home">Home</a><a href="#features">Features</a><a href="#how-it-works">How It Works</a></div>
          <div className="footer-bottom"><span>© 2026 Insight Forge. Built for the curious.</span><span className="footer-note"><i /> RAPID KNOWLEDGE INTERNALIZATION</span></div>
        </div>
      </footer>
    </main>
  )
}

export default App
