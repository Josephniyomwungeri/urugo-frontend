import React, { useState, useEffect, useRef } from 'react';
import LoginModal from '../components/LoginModal';
import RequisitionForm from '../components/RequisitionForm';
import './Homepage.css';

/* =========================================================
   SCROLL REVEAL — fade-up animation on scroll
   ========================================================= */
function useScrollReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('[data-reveal]');
    if (!els.length) return;

    // Fallback: if IntersectionObserver isn't supported, show everything
    if (typeof IntersectionObserver === 'undefined') {
      els.forEach((el) => el.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target); // animate once
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -60px 0px' }
    );

    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

export default function Homepage() {
  const [showLogin, setShowLogin] = useState(false);
  const [showDemo, setShowDemo] = useState(false);

  useScrollReveal();

  const features = [
    { icon: 'bi-box-arrow-in-down', title: 'Stock In', desc: 'Record donations & purchases with batch, expiry, supplier and QR/barcode.' },
    { icon: 'bi-archive', title: 'Store & Maintain', desc: 'Track locations, condition and maintenance schedules of all items.' },
    { icon: 'bi-box-arrow-up', title: 'Stock Out', desc: 'Issue items to projects, sites or beneficiaries with full approval trail.' },
    { icon: 'bi-exclamation-triangle', title: 'Loss & Damage', desc: 'Log lost, expired or damaged items with reason and evidence.' },
    { icon: 'bi-bell-fill', title: 'Smart Alerts', desc: 'Low stock, near-expiry and overdue maintenance warnings in real time.' },
    { icon: 'bi-file-earmark-text', title: 'Requisition Forms', desc: 'Auto-generated, printable and exportable requisition forms for every received request.' },
  ];

  const modules = [
    { num: '1', title: 'Inventory Register', desc: 'Any item type: food, medical, WASH, vehicles, equipment, office.' },
    { num: '2', title: 'Stock In', desc: 'Donations & purchases with batch, expiry, donor/supplier, QR/barcode.' },
    { num: '3', title: 'Stock Out', desc: 'Issue & distribution to projects, sites or beneficiaries with approval.' },
    { num: '4', title: 'Lost / Damaged / Expired', desc: 'Reason, photo evidence, approval and write-off history.' },
    { num: '5', title: 'Requisition Forms', desc: 'Auto-generated forms with logo, ref no, print/PDF/HTML export.' },
    { num: '6', title: 'Transfers', desc: 'Move stock between warehouses and offices seamlessly.' },
    { num: '7', title: 'Usage Tracking', desc: 'Staff report used, damaged and remaining after pickup.' },
    { num: '8', title: 'Search & Filters', desc: 'Find requests by staff, department, product or status in seconds.' },
    { num: '9', title: 'Reports & Security', desc: 'PDF/Excel reports, role-based access, full audit log.' },
  ];

  const impacts = [
    { icon: 'bi-shield-check', title: 'Less Loss', desc: 'Full audit trail reduces missing and expired stock' },
    { icon: 'bi-lightning-charge-fill', title: 'Faster Aid', desc: 'Right items at the right place, on time' },
    { icon: 'bi-hand-thumbs-up-fill', title: 'Donor Trust', desc: 'Accurate reports in minutes, in any country' },
    { icon: 'bi-file-earmark-bar-graph-fill', title: 'Powerful Reporting', desc: 'One-click audit-ready reports for donors, HQ & field teams' },
  ];

  const steps = [
    { num: 1, title: 'Staff Requests', desc: 'Staff submits a request with product, quantity, unit and reason.' },
    { num: 2, title: 'Stock Manager Forwards', desc: 'Stock Manager reviews, adjusts received quantity, forwards for review.' },
    { num: 3, title: 'Finance Manager Approves', desc: 'Finance Manager approves or rejects with a comment — decision is logged.' },
    { num: 4, title: 'Stock Manager Completes', desc: 'Stock is deducted and a Stock Out record is created automatically.' },
    { num: 5, title: 'Marked as Received', desc: 'Staff confirms pickup. Request moves to received status.' },
    { num: 6, title: 'Requisition + Usage', desc: 'Requisition form generated + staff reports used, damaged and remaining.' },
  ];

  const staffFlow = [
    { icon: 'bi-person-badge', title: '1. Staff Logs In', desc: 'Each staff member logs in with their email and department PIN.' },
    { icon: 'bi-send-check', title: '2. Submit Request(s)', desc: 'Choose products, quantity, requested unit and reason — submit one or many at once.' },
    { icon: 'bi-clipboard-check', title: '3. Stock Manager Reviews', desc: 'Adjusts the received quantity and forwards the request to the Stock Manager.' },
    { icon: 'bi-patch-check-fill', title: '4. Finance Manager Approves', desc: 'Approves or rejects with a comment — every action is logged.' },
    { icon: 'bi-box-arrow-up', title: '5. Stock Issued', desc: 'Stock Manager completes the request — inventory and Stock Out updated.' },
    { icon: 'bi-file-earmark-text', title: '6. Requisition Form', desc: 'Printable / exportable requisition form generated for the received request.' },
  ];

  const roles = [
    {
      icon: 'bi-person-badge-fill', title: 'Staff Members', color: 'blue',
      points: [
        'Log in with their department PIN',
        'Submit one or many product requests at once',
        'Track request status live',
        'Report used, damaged & remaining quantities',
        'View, print or download requisition forms',
      ],
    },
    {
      icon: 'bi-box-seam-fill', title: 'Stock Manager', color: 'green',
      points: [
        'Manage full inventory with bulk tools',
        'Adjust received quantity before review',
        'Complete approved requests & issue stock',
        'Log losses & damages',
        'Generate requisition forms for received requests',
      ],
    },
    {
      icon: 'bi-shield-check', title: 'Finance Manager', color: 'purple',
      points: [
        'Review every request independently',
        'Approve or reject with comments',
        'Monitor all usage & damage reports',
        'Search & filter by staff or department',
        'Access full reporting and audit trail',
      ],
    },
  ];

  return (
    <div className="uhome_home">
      <header className="uhome_header uhome_anim-fade-down">
        <div className="uhome_logo">
          <i className="bi bi-box-seam-fill"></i>
          <span>Urugo Woc Logistics System</span>
        </div>
        <button className="uhome_login-btn" onClick={() => setShowLogin(true)}>
          <i className="bi bi-box-arrow-in-right"></i> Login
        </button>
      </header>

      {/* ============ HERO ============ */}
      <section className="uhome_hero">
        <div className="uhome_hero-content uhome_anim-fade-right">
          <span className="uhome_hero-badge">
            <i className="bi bi-stars"></i> Logistics
          </span>
          <h1>
            Logistics & Inventory <span>Management System</span>
          </h1>
          <p>
            Track stock in, stock out, requisitions, maintenance and losses for any type of item —
            with two-level approvals, requisition forms and real-time usage reporting.
          </p>
          <div className="uhome_hero-actions">
            <button className="uhome_cta-btn uhome_anim-pulse" onClick={() => setShowLogin(true)}>
              <i className="bi bi-rocket-takeoff-fill"></i> Get Started
            </button>
            <button className="uhome_cta-btn-outline" onClick={() => setShowDemo(true)}>
              <i className="bi bi-play-circle-fill"></i> Click To See how it works
            </button>
          </div>

          <div className="uhome_hero-stats">
            <div className="uhome_hero-stat"><strong>3</strong><span>User Roles</span></div>
            <div className="uhome_hero-stat"><strong>9</strong><span>Core Modules</span></div>
            <div className="uhome_hero-stat"><strong>100%</strong><span>Audit Trail</span></div>
          </div>
        </div>

        <div className="uhome_hero-visual uhome_anim-fade-left">
          <HeroMiniDemo onExpand={() => setShowDemo(true)} />
        </div>
      </section>

      {/* ============ PROBLEM ============ */}
      <section className="uhome_section" id="uhome-features" data-reveal>
        <h2 className="uhome_section-title">The Problem To Be Solved</h2>
        <p className="uhome_section-sub">Manual processes cost time, money and trust</p>
        <div className="uhome_problem-grid">
          <div className="uhome_problem-card">
            <div className="uhome_problem-icon"><i className="bi bi-file-earmark-text"></i></div>
            <div className="uhome_problem-stat">60%</div>
            <p>of stock records kept on paper or Excel spreadsheets</p>
          </div>
          <div className="uhome_problem-card">
            <div className="uhome_problem-icon"><i className="bi bi-question-circle"></i></div>
            <div className="uhome_problem-stat">No trail</div>
            <p>on who received, moved or signed for materials</p>
          </div>
          <div className="uhome_problem-card">
            <div className="uhome_problem-icon"><i className="bi bi-graph-down-arrow"></i></div>
            <div className="uhome_problem-stat">Stock-outs</div>
            <p>and expired or damaged goods discovered too late</p>
          </div>
          <div className="uhome_problem-card">
            <div className="uhome_problem-icon"><i className="bi bi-clock-history"></i></div>
            <div className="uhome_problem-stat">Slow reports</div>
            <p>audit reports built by hand each month</p>
          </div>
        </div>
      </section>

      {/* ============ SOLUTION ============ */}
      <section className="uhome_section uhome_section-alt" data-reveal>
        <h2 className="uhome_section-title">Invented Solution</h2>
        <p className="uhome_section-sub">
          One central platform that follows every item — from receipt to delivery
        </p>
        <div className="uhome_flow">
          {features.map((f, i) => (
            <div className="uhome_flow-item" key={i}>
              <div className="uhome_flow-icon"><i className={`bi ${f.icon}`}></i></div>
              <h4>{f.title}</h4>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section className="uhome_section" data-reveal>
        <h2 className="uhome_section-title">How It Works</h2>
        <p className="uhome_section-sub">
          A transparent request-to-requisition workflow with two-level approval
        </p>
        <div className="uhome_steps">
          {steps.map((s, i) => (
            <div className="uhome_step" key={s.num}>
              <div className="uhome_step-num">{s.num}</div>
              <div className="uhome_step-content">
                <h4>{s.title}</h4>
                <p>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ============ STAFF REQUEST FLOW ============ */}
      <section className="uhome_section uhome_section-alt" data-reveal>
        <h2 className="uhome_section-title">How Staff Request Products</h2>
        <p className="uhome_section-sub">
          A simple and transparent flow — from request to requisition form
        </p>
        <div className="uhome_staff-flow">
          {staffFlow.map((s, i) => (
            <div className="uhome_staff-card" key={i}>
              <div className="uhome_staff-icon"><i className={`bi ${s.icon}`}></i></div>
              <h4>{s.title}</h4>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ ROLES ============ */}
      <section className="uhome_section" data-reveal>
        <h2 className="uhome_section-title">Built for Every Role</h2>
        <p className="uhome_section-sub">
          Staff, Stock Manager and Finance Manager — each with a tailored dashboard
        </p>
        <div className="uhome_roles-grid">
          {roles.map((r, i) => (
            <div className={`uhome_role-card uhome_role-${r.color}`} key={i}>
              <div className="uhome_role-icon"><i className={`bi ${r.icon}`}></i></div>
              <h3>{r.title}</h3>
              <ul>
                {r.points.map((p, j) => (<li key={j}><i className="bi bi-check-circle-fill"></i> {p}</li>))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ============ MODULES ============ */}
      <section className="uhome_section uhome_section-alt" data-reveal>
        <h2 className="uhome_section-title">Everything Included</h2>
        <p className="uhome_section-sub">Nine modules covering the full logistics cycle</p>
        <div className="uhome_modules-grid">
          {modules.map((m, i) => (
            <div className="uhome_module-card" key={m.num}>
              <div className="uhome_module-num">{m.num}</div>
              <h4>{m.title}</h4>
              <p>{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ IMPACT ============ */}
      <section className="uhome_section" data-reveal>
        <h2 className="uhome_section-title">Expected Impact</h2>
        <p className="uhome_section-sub">Real benefits for NGO, staff</p>
        <div className="uhome_impact-grid">
          {impacts.map((im, i) => (
            <div className="uhome_impact-card" key={i}>
              <i className={`bi ${im.icon}`}></i>
              <h4>{im.title}</h4>
              <p>{im.desc}</p>
            </div>
          ))}
        </div>
        <div className="uhome_cta-center">
          <button className="uhome_cta-btn uhome_anim-pulse" onClick={() => setShowLogin(true)}>
            <i className="bi bi-rocket-takeoff-fill"></i> Get Started Now
          </button>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="uhome_footer" data-reveal>
        <div className="uhome_footer-grid">
          <div className="uhome_footer-brand">
            <div className="uhome_logo uhome_logo-footer">
              <i className="bi bi-box-seam-fill"></i>
              <span>Urugo Woc Logistics System</span>
            </div>
            <p>Tracking stock, requisitions, losses and staff usage in real time.</p>
          </div>
          <div className="uhome_footer-col">
            <h5>Platform</h5>
            <ul><li>Inventory</li><li>Stock In / Out</li><li>Requisitions</li><li>Usage Reports</li></ul>
          </div>
          <div className="uhome_footer-col">
            <h5>Workflows</h5>
            <ul><li>Staff Requests</li><li>Manager Review</li><li>Loss & Damage</li><li>Audit Trail</li></ul>
          </div>
          <div className="uhome_footer-col">
            <h5>Support</h5>
            <ul><li>User Manual</li><li>Excel Templates</li><li>PDF Export</li><li>System Backup</li></ul>
          </div>
        </div>
        <div className="uhome_footer-bottom">
          <p>© {new Date().getFullYear()} Urugo Woc Logistics System. All rights reserved.</p>
        </div>
      </footer>

      <LoginModal show={showLogin} onClose={() => setShowLogin(false)} />
      {showDemo && <DemoModal onClose={() => setShowDemo(false)} />}
    </div>
  );
}

/* =========================================================
   VOICE — Male English narration via SpeechSynthesis
   ========================================================= */
function useVoiceNarrator(enabled) {
  const lastSpokenRef = useRef('');

  const pickMaleEnglishVoice = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices() || [];
    if (!voices.length) return null;

    const englishVoices = voices.filter((v) =>
      /^en(-|_|$)/i.test(v.lang || '')
    );
    const maleHints = [
      'male', 'man', 'david', 'mark', 'george', 'daniel',
      'james', 'alex', 'fred', 'oliver', 'matthew', 'guy',
    ];
    const explicit = englishVoices.find((v) =>
      maleHints.some((h) => (v.name || '').toLowerCase().includes(h))
    );
    if (explicit) return explicit;
    if (englishVoices[0]) return englishVoices[0];
    return voices[0];
  };

  const speak = (text) => {
    if (!enabled) return;
    if (!text) return;
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    if (text === lastSpokenRef.current) return;
    lastSpokenRef.current = text;

    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = 0.95;
      u.pitch = 0.85;
      u.volume = 1;

      const chosen = pickMaleEnglishVoice();
      if (chosen) u.voice = chosen;

      window.speechSynthesis.speak(u);
    } catch { /* silent */ }
  };

  const stop = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
    lastSpokenRef.current = '';
  };

  return { speak, stop };
}

/* =========================================================
   SCENES — 4 tabs (usage merged into received)
   ========================================================= */
const SCENES = {
  home: {
    title: 'Staff Dashboard',
    icon: 'bi-speedometer2',
    color: '#0d6efd',
    steps: [
      {
        label: 'Log in with your email & PIN',
        cursor: { top: '48%', left: '50%' },
        screen: <LoginScreen />,
        narration: 'Welcome. First, the staff member logs in with their email address and department PIN.',
      },
      {
        label: 'Welcome to your personal dashboard',
        cursor: { top: '30%', left: '30%' },
        screen: <StaffHomeScreen stage={0} />,
        narration: 'After logging in, the staff member lands on a personal dashboard with live statistics.',
      },
      {
        label: 'See your request statistics live',
        cursor: { top: '45%', left: '60%' },
        screen: <StaffHomeScreen stage={1} />,
        narration: 'Here you can see total requests, pending requests, approved requests, and received items at a glance.',
      },
      {
        label: 'Use the sidebar to navigate',
        cursor: { top: '55%', left: '12%' },
        screen: <StaffHomeScreen stage={2} />,
        narration: 'The sidebar lets you jump between the dashboard, your requests, and the products catalog.',
      },
    ],
  },
  request: {
    title: 'How to make requests',
    icon: 'bi-send-check',
    color: '#198754',
    steps: [
      {
        label: 'Open "My Requests"',
        cursor: { top: '42%', left: '12%' },
        screen: <RequestScreen stage={0} />,
        narration: 'To request products, open the My Requests page from the sidebar.',
      },
      {
        label: 'Choose how many requests to make',
        cursor: { top: '40%', left: '55%' },
        screen: <RequestScreen stage={1} />,
        narration: 'Click New Requests, then choose how many products you want to request at once. You can request up to twenty in a single batch.',
      },
      {
        label: 'Fill out each request form',
        cursor: { top: '45%', left: '55%' },
        screen: <RequestScreen stage={2} />,
        narration: 'Each request has its own form. Pick the product, the quantity, the unit, and the reason for the request.',
      },
      {
        label: 'Save all forms at once',
        cursor: { top: '82%', left: '78%' },
        screen: <RequestScreen stage={3} />,
        narration: 'When all forms are complete, click Save All. All requests are submitted together.',
      },
      {
        label: 'Track the live status',
        cursor: { top: '42%', left: '72%' },
        screen: <RequestScreen stage={4} />,
        narration: 'You can now track the live status of every request, from pending review to approved, completed, and received.',
      },
    ],
  },
  received: {
    title: 'Usage & Requisition',
    icon: 'bi-clipboard-data',
    color: '#fd7e14',
    steps: [
      {
        label: 'Manager marks the request as received',
        cursor: { top: '42%', left: '82%' },
        screen: <ReceivedScreen stage={0} />,
        narration: 'Once the stock manager issues the items, the request status changes to received.',
      },
      {
        label: 'Staff sees the new received status',
        cursor: { top: '42%', left: '80%' },
        screen: <ReceivedScreen stage={1} />,
        narration: 'The staff member immediately sees the received status on their requests page.',
      },
      {
        label: 'Open the requisition form',
        cursor: { top: '42%', left: '82%' },
        screen: <ReceivedScreen stage={2} />,
        narration: 'A Requisition button appears. Clicking it opens the printable requisition form, pre-filled with the request details.',
      },
      {
        label: 'Print, export PDF or download',
        cursor: { top: '85%', left: '82%' },
        screen: <RequisitionScreen />,
        narration: 'The requisition form carries the official header, the reference number, the item details, and all four signature blocks — requested by, approved by, delivered by, and received by. You can print it, or export it as a PDF.',
      },
      {
        label: 'Report usage with used + damaged',
        cursor: { top: '42%', left: '82%' },
        screen: <UsageScreen stage={1} />,
        narration: 'To report usage, click the green Report Usage button next to the received request.',
      },
      {
        label: 'Enter used, damaged & remaining',
        cursor: { top: '55%', left: '50%' },
        screen: <UsageScreen stage={2} />,
        narration: 'Enter how many items were used, how many were damaged, and how many remain. The system checks that the three numbers add up to the received quantity.',
      },
      {
        label: 'Submit and see it in the usage table',
        cursor: { top: '68%', left: '40%' },
        screen: <UsageScreen stage={4} />,
        narration: 'Once submitted, your usage report appears in the usage table below your requests. You can edit it later, but only to increase the used or damaged quantity.',
      },
    ],
  },
  catalog: {
    title: 'Products Catalog',
    icon: 'bi-box-seam',
    color: '#0d6efd',
    steps: [
      {
        label: 'Open "Products Catalog"',
        cursor: { top: '42%', left: '12%' },
        screen: <CatalogScreen stage={0} />,
        narration: 'The Products Catalog shows every product currently held in the warehouse.',
      },
      {
        label: 'Browse all available products',
        cursor: { top: '50%', left: '50%' },
        screen: <CatalogScreen stage={1} />,
        narration: 'Browse the catalog to see product names, categories, stock levels, and unit types.',
      },
      {
        label: 'Use the search bar to filter',
        cursor: { top: '18%', left: '30%' },
        screen: <CatalogScreen stage={2} />,
        narration: 'Use the search bar to quickly find a specific product.',
      },
      {
        label: 'See stock status at a glance',
        cursor: { top: '65%', left: '60%' },
        screen: <CatalogScreen stage={3} />,
        narration: 'Low stock items are highlighted in red, so you always know what needs replenishing.',
      },
    ],
  },
};

const SCENE_ORDER = ['home', 'request', 'received', 'catalog'];

/* =========================================================
   HERO MINI DEMO
   ========================================================= */
function HeroMiniDemo({ onExpand }) {
  const [sceneKey, setSceneKey] = useState('home');
  const [stepIdx, setStepIdx] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [clickPulse, setClickPulse] = useState(0);

  const scene = SCENES[sceneKey];
  const totalSteps = scene.steps.length;
  const currentStep = scene.steps[stepIdx];

  useEffect(() => {
    const delay = hovering ? 2000 : 3200;
    const t = setTimeout(() => {
      setClickPulse((c) => c + 1);
      setStepIdx((i) => (i + 1) % totalSteps);
    }, delay);
    return () => clearTimeout(t);
  }, [stepIdx, totalSteps, hovering]);

  useEffect(() => {
    if (stepIdx !== 0) return;
    const t = setTimeout(() => {
      const idx = SCENE_ORDER.indexOf(sceneKey);
      const next = SCENE_ORDER[(idx + 1) % SCENE_ORDER.length];
      setSceneKey(next);
    }, 2200);
    return () => clearTimeout(t);
  }, [stepIdx, sceneKey]);

  useEffect(() => { setClickPulse((c) => c + 1); }, [sceneKey]);

  return (
    <div
      className={`uhome_mini ${hovering ? 'is-hovering' : ''}`}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onClick={onExpand}
      title="Click to open the full walkthrough"
    >
      <div className="uhome_mini-head">
        <span className="uhome_mini-live">
          <span className="uhome_mini-dot"></span> LIVE DEMO
        </span>
        <span className="uhome_mini-title">
          <i className={`bi ${scene.icon}`}></i> {scene.title}
        </span>
        <span className="uhome_mini-expand">
          <i className="bi bi-arrows-angle-expand"></i> Click to expand
        </span>
      </div>

      <div className="uhome_mini-screen">
        {currentStep.screen}
        <div
          className="uhome_mini-cursor"
          style={{ top: currentStep.cursor.top, left: currentStep.cursor.left }}
          key={`${sceneKey}-${stepIdx}-${clickPulse}`}
        >
          <i className="bi bi-cursor-fill"></i>
          <div className="uhome_mini-cursor-ripple" key={clickPulse}></div>
        </div>
      </div>

      <div className="uhome_mini-caption">
        <span className="uhome_mini-stepnum">{stepIdx + 1}/{totalSteps}</span>
        <span className="uhome_mini-caption-text">{currentStep.label}</span>
      </div>

      <div className="uhome_mini-progress">
        {scene.steps.map((_, i) => (
          <span
            key={i}
            className={`uhome_mini-dot-seg ${i === stepIdx ? 'active' : ''} ${i < stepIdx ? 'done' : ''}`}
            style={{ '--uhome-mini-color': scene.color }}
          ></span>
        ))}
      </div>

      <div className="uhome_mini-corner">
        <i className="bi bi-play-circle-fill"></i>
      </div>
    </div>
  );
}

/* =========================================================
   DEMO MODAL — full walkthrough with voice narration
   ========================================================= */
function DemoModal({ onClose }) {
  const [tab, setTab] = useState('home');
  const [stepIdx, setStepIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [clickPulse, setClickPulse] = useState(0);
  const [voiceOn, setVoiceOn] = useState(true);
  const [voicesReady, setVoicesReady] = useState(false);

  const { speak, stop } = useVoiceNarrator(voiceOn && playing);

  const activeScene = SCENES[tab];
  const totalSteps = activeScene.steps.length;
  const currentStep = activeScene.steps[stepIdx];

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const load = () => {
      const v = window.speechSynthesis.getVoices();
      if (v && v.length) setVoicesReady(true);
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => {
      try { window.speechSynthesis.onvoiceschanged = null; } catch { /* ignore */ }
    };
  }, []);

  useEffect(() => { setStepIdx(0); }, [tab]);

  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => {
      setClickPulse((c) => c + 1);
      setStepIdx((i) => (i + 1) % totalSteps);
    }, 6000);
    return () => clearTimeout(t);
  }, [stepIdx, playing, totalSteps, tab]);

  useEffect(() => {
    if (!voiceOn || !playing) return;
    if (!currentStep?.narration) return;
    if (!voicesReady) return;
    speak(currentStep.narration);
  }, [tab, stepIdx, voiceOn, playing, voicesReady]);

  useEffect(() => {
    if (!voiceOn || !playing) stop();
  }, [voiceOn, playing]);

  useEffect(() => {
    return () => { stop(); };
  }, []);

  const goToStep = (i) => {
    setStepIdx(((i % totalSteps) + totalSteps) % totalSteps);
    setClickPulse((c) => c + 1);
  };

  return (
    <div className="uhome_demo-overlay" onClick={onClose}>
      <div className="uhome_demo-modal" onClick={(e) => e.stopPropagation()}>
        <div className="uhome_demo-head">
          <div className="uhome_demo-head-left">
            <i className="bi bi-play-btn-fill"></i>
            <div>
              <h4>Interactive Walkthrough</h4>
              <p>See exactly how Urugo Woc Logistic System works</p>
            </div>
          </div>
          <div className="uhome_demo-head-right">
            <button
              className={`uhome_demo-voice ${voiceOn ? 'on' : 'off'}`}
              onClick={() => setVoiceOn((v) => !v)}
              title={voiceOn ? 'Mute narration' : 'Unmute narration'}
            >
              <i className={`bi ${voiceOn ? 'bi-volume-up-fill' : 'bi-volume-mute-fill'}`}></i>
              {voiceOn ? 'Voice On' : 'Voice Off'}
            </button>
            <button className="uhome_demo-close" onClick={onClose}>
              <i className="bi bi-x-lg"></i>
            </button>
          </div>
        </div>

        <div className="uhome_demo-tabs">
          {Object.entries(SCENES).map(([key, s]) => (
            <button
              key={key}
              className={`uhome_demo-tab ${tab === key ? 'active' : ''}`}
              onClick={() => setTab(key)}
              style={{ '--uhome-tab-color': s.color }}
            >
              <i className={`bi ${s.icon}`}></i> {s.title}
            </button>
          ))}
        </div>

        <div className="uhome_demo-screen-wrap">
          <div className="uhome_demo-screen">
            {currentStep.screen}
            <div
              className="uhome_demo-cursor"
              style={{ top: currentStep.cursor.top, left: currentStep.cursor.left }}
              key={`${tab}-${stepIdx}-${clickPulse}`}
            >
              <i className="bi bi-cursor-fill"></i>
              <div className="uhome_demo-cursor-ripple" key={clickPulse}></div>
            </div>
          </div>

          <div className="uhome_demo-caption">
            <span className="uhome_demo-stepnum">Step {stepIdx + 1} of {totalSteps}</span>
            <span className="uhome_demo-caption-text">{currentStep.label}</span>
          </div>

          {voiceOn && (
            <div className="uhome_demo-narration">
              <i className="bi bi-mic-fill"></i>
              <span>{currentStep.narration}</span>
            </div>
          )}
        </div>

        <div className="uhome_demo-progress">
          {activeScene.steps.map((_, i) => (
            <div
              key={i}
              className={`uhome_demo-progress-seg ${i === stepIdx ? 'active' : ''} ${i < stepIdx ? 'done' : ''}`}
              onClick={() => goToStep(i)}
              style={{ '--uhome-tab-color': activeScene.color }}
            >
              <div className="uhome_demo-progress-fill"></div>
            </div>
          ))}
        </div>

        <div className="uhome_demo-controls">
          <button className="uhome_demo-btn" onClick={() => goToStep(stepIdx - 1)}>
            <i className="bi bi-skip-backward-fill"></i>
          </button>
          <button className="uhome_demo-btn uhome_demo-btn-play" onClick={() => setPlaying((p) => !p)}>
            <i className={`bi ${playing ? 'bi-pause-fill' : 'bi-play-fill'}`}></i>
          </button>
          <button className="uhome_demo-btn" onClick={() => goToStep(stepIdx + 1)}>
            <i className="bi bi-skip-forward-fill"></i>
          </button>
          <span className="uhome_demo-status">{playing ? 'Auto-playing…' : 'Paused'}</span>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   MOCK UI COMPONENTS
   ========================================================= */
function StaffSidebar({ active }) {
  const items = [
    { key: 'home', label: 'Dashboard', icon: 'bi-speedometer2' },
    { key: 'requests', label: 'My Requests', icon: 'bi-inbox' },
    { key: 'catalog', label: 'Products Catalog', icon: 'bi-box-seam' },
  ];
  return (
    <div className="uhome_mock-sidebar">
      <div className="uhome_mock-user">
        <i className="bi bi-person-circle"></i>
        <div>
          <div className="uhome_mock-user-name">Joe</div>
          <div className="uhome_mock-user-role">IT Consultant</div>
        </div>
      </div>
      <nav className="uhome_mock-nav">
        {items.map((it) => (
          <div key={it.key} className={`uhome_mock-nav-item ${active === it.key ? 'active' : ''}`}>
            <i className={`bi ${it.icon}`}></i> <span>{it.label}</span>
          </div>
        ))}
      </nav>
    </div>
  );
}

function StaffTopbar({ onMenu }) {
  return (
    <div className="uhome_mock-topbar">
      <div className="uhome_mock-topbar-left">
        {onMenu && <i className="bi bi-list"></i>}
        <span className="uhome_mock-logo">
          <i className="bi bi-box-seam-fill"></i> Urugo Woc Logistics
        </span>
      </div>
      <div className="uhome_mock-topbar-right">
        <i className="bi bi-arrow-clockwise"></i>
        <i className="bi bi-bell-fill"></i>
        <span className="uhome_mock-avatar"><i className="bi bi-person-circle"></i></span>
      </div>
    </div>
  );
}

function LoginScreen() {
  return (
    <div className="uhome_mock-login-bg">
      <div className="uhome_mock-login-modal">
        <div className="uhome_mock-login-header">
          <i className="bi bi-box-seam-fill"></i>
          <h3>Urugo Woc Logistics System</h3>
          <p>Enter your email and PIN to continue</p>
        </div>
        <div className="uhome_mock-login-field">
          <label><i className="bi bi-envelope-fill"></i> Email</label>
          <div className="uhome_mock-input filled">Joe@urugowoc.org</div>
        </div>
        <div className="uhome_mock-login-field">
          <label><i className="bi bi-key-fill"></i> PIN</label>
          <div className="uhome_mock-input filled">••••••</div>
        </div>
        <div className="uhome_mock-login-btn">Login</div>
      </div>
    </div>
  );
}

function StaffHomeScreen({ stage }) {
  return (
    <div className="uhome_mock-app">
      <StaffSidebar active="home" />
      <div className="uhome_mock-main">
        <StaffTopbar onMenu />
        <div className="uhome_mock-page-body">
          <h2 className="uhome_mock-page-title"><i className="bi bi-speedometer2"></i> Hello, Joe</h2>
          <p className="uhome_mock-page-sub">Department: <strong>IT</strong></p>
          <div className="uhome_mock-stat-grid">
            <div className={`uhome_mock-stat-card ${stage >= 1 ? 'glow' : ''}`}>
              <div className="uhome_mock-stat-icon blue"><i className="bi bi-inbox"></i></div>
              <div>
                <div className="uhome_mock-stat-label">Total Requests</div>
                <div className="uhome_mock-stat-value">12</div>
              </div>
            </div>
            <div className="uhome_mock-stat-card">
              <div className="uhome_mock-stat-icon orange"><i className="bi bi-hourglass-split"></i></div>
              <div>
                <div className="uhome_mock-stat-label">Pending</div>
                <div className="uhome_mock-stat-value">2</div>
              </div>
            </div>
            <div className="uhome_mock-stat-card">
              <div className="uhome_mock-stat-icon green"><i className="bi bi-check-circle"></i></div>
              <div>
                <div className="uhome_mock-stat-label">Approved</div>
                <div className="uhome_mock-stat-value">4</div>
              </div>
            </div>
            <div className="uhome_mock-stat-card">
              <div className="uhome_mock-stat-icon purple"><i className="bi bi-box-arrow-up"></i></div>
              <div>
                <div className="uhome_mock-stat-label">Received</div>
                <div className="uhome_mock-stat-value">6</div>
              </div>
            </div>
          </div>
          <div className="uhome_mock-info-card">
            <h5><i className="bi bi-info-circle"></i> Getting Started</h5>
            <p>Use the sidebar to submit a new product request, view requisition forms, or track the status of your existing requests.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* --- Request flow — bulk requests --- */
function RequestScreen({ stage }) {
  const rows = [
    { id: 12, date: '2025-01-15', product: 'Marker Pen', qty: 3, unit: 'pieces', status: 'received' },
    { id: 11, date: '2025-01-14', product: 'Rice 25kg', qty: 5, unit: 'bags', status: 'pending' },
  ];
  return (
    <div className="uhome_mock-app">
      <StaffSidebar active="requests" />
      <div className="uhome_mock-main">
        <StaffTopbar onMenu />
        <div className="uhome_mock-page-body">
          <div className="uhome_mock-page-header-row">
            <h2 className="uhome_mock-page-title"><i className="bi bi-inbox"></i> My Requests</h2>
            {stage >= 1 && (
              <span className="uhome_mock-topbar-action">
                <i className="bi bi-plus-lg"></i> New Requests
              </span>
            )}
          </div>

          {stage <= 1 && (
            <>
              <div className="uhome_mock-toolbar-row">
                <div className="uhome_mock-search">
                  <i className="bi bi-search"></i>
                  <span>Search products...</span>
                </div>
                <span className="uhome_mock-count">{rows.length} requests</span>
              </div>
              <div className="uhome_mock-table">
                <div className="uhome_mock-thead">
                  <span>#</span><span>Date</span><span>Product</span><span>Qty</span><span>Unit</span><span>Status</span>
                </div>
                {rows.map((r) => (
                  <div className="uhome_mock-trow" key={r.id}>
                    <span>{r.id}</span><span>{r.date}</span>
                    <span><strong>{r.product}</strong></span>
                    <span>{r.qty}</span><span>{r.unit}</span>
                    <span className={`uhome_mock-badge ${r.status}`}>{r.status}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {stage === 2 && (
            <>
              <h4 className="uhome_mock-section-title"><i className="bi bi-plus-circle"></i> New Requests (3)</h4>
              <div className="uhome_mock-modal-mock">
                <div className="uhome_mock-modal-head">Request #1 <i className="bi bi-x-lg"></i></div>
                <div className="uhome_mock-modal-body">
                  <div className="uhome_mock-field">
                    <label>Product *</label>
                    <div className="uhome_mock-input filled">Marker Pen (Office)</div>
                  </div>
                  <div className="uhome_mock-two-cols">
                    <div className="uhome_mock-field"><label>Quantity *</label><div className="uhome_mock-input filled">3</div></div>
                    <div className="uhome_mock-field"><label>Unit *</label><div className="uhome_mock-input filled">pieces</div></div>
                  </div>
                  <div className="uhome_mock-field"><label>Reason *</label><div className="uhome_mock-input filled">For teaching</div></div>
                </div>
              </div>
              <div className="uhome_mock-modal-mock" style={{ marginTop: 8 }}>
                <div className="uhome_mock-modal-head">Request #2 <i className="bi bi-x-lg"></i></div>
              </div>
              <div className="uhome_mock-modal-mock" style={{ marginTop: 8 }}>
                <div className="uhome_mock-modal-head">Request #3 <i className="bi bi-x-lg"></i></div>
              </div>
            </>
          )}

          {stage === 3 && (
            <div className="uhome_mock-toast-inline"><i className="bi bi-check-circle-fill"></i> 3 requests submitted successfully</div>
          )}

          {stage === 4 && (
            <>
              <h4 className="uhome_mock-section-title"><i className="bi bi-file-earmark-text"></i> My Requests</h4>
              <div className="uhome_mock-table">
                <div className="uhome_mock-thead">
                  <span>#</span><span>Date</span><span>Product</span><span>Qty</span><span>Unit</span><span>Status</span>
                </div>
                <div className="uhome_mock-trow highlight">
                  <span>13</span><span>2025-01-16</span>
                  <span><strong>Marker Pen</strong></span>
                  <span>3</span><span>pieces</span>
                  <span className="uhome_mock-badge pending_review">pending review</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* --- Received & Requisition --- */
function ReceivedScreen({ stage }) {
  const row = { id: 12, product: 'Marker Pen', qty: 3, unit: 'pieces', status: 'received' };
  return (
    <div className="uhome_mock-app">
      <StaffSidebar active="requests" />
      <div className="uhome_mock-main">
        <StaffTopbar onMenu />
        <div className="uhome_mock-page-body">
          <div className="uhome_mock-page-header-row">
            <h2 className="uhome_mock-page-title"><i className="bi bi-inbox"></i> My Requests</h2>
          </div>
          <div className="uhome_mock-table">
            <div className="uhome_mock-thead">
              <span>#</span><span>Date</span><span>Product</span><span>Qty</span><span>Unit</span><span>Status</span>
            </div>
            <div className={`uhome_mock-trow ${stage >= 1 ? 'highlight' : ''}`}>
              <span>{row.id}</span><span>2025-01-15</span>
              <span><strong>{row.product}</strong></span>
              <span>{row.qty}</span><span>{row.unit}</span>
              <span className={`uhome_mock-badge ${row.status}`}>{row.status}</span>
            </div>
          </div>

          {stage >= 1 && (
            <div className="uhome_mock-action-row">
              <span className="uhome_mock-btn-primary" style={{ background: '#6f42c1' }}>
                <i className="bi bi-file-earmark-text"></i> Requisition
              </span>
              <span className="uhome_mock-btn-primary" style={{ background: '#198754', marginLeft: 8 }}>
                <i className="bi bi-clipboard-plus"></i> Report Usage
              </span>
            </div>
          )}

          {stage === 4 && (
            <div className="uhome_mock-modal-mock" style={{ marginTop: 12 }}>
              <div className="uhome_mock-modal-head">Report Usage — Marker Pen <i className="bi bi-x-lg"></i></div>
              <div className="uhome_mock-modal-body">
                <div className="uhome_mock-total-badge">
                  <span><i className="bi bi-box-seam"></i> Received</span><strong>3 pieces</strong>
                </div>
                <div className="uhome_mock-two-cols">
                  <div className="uhome_mock-field"><label>Used *</label><div className="uhome_mock-input filled">2</div></div>
                  <div className="uhome_mock-field"><label>Damaged *</label><div className="uhome_mock-input filled">0</div></div>
                </div>
                <div className="uhome_mock-field"><label>Remaining *</label><div className="uhome_mock-input filled">1</div></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* --- Real requisition preview inside the demo --- */
const SAMPLE_REQUEST = {
  id: 12,
  staff_name: 'Joe',
  staff_department: 'IT',
  department: 'IT',
  product_name: 'Marker Pen',
  product_unit: 'pieces',
  requested_unit: 'pieces',
  unit: 'pieces',
  quantity: 3,
  received_quantity: 3,
  reason: 'For teaching',
  status: 'received',
  created_at: '2025-01-15T09:14:00Z',
  reviewed_at: '2025-01-15T11:02:00Z',
  completed_at: '2025-01-15T14:40:00Z',
  received_at: '2025-01-15T15:12:00Z',
  reviewer_name: 'Finance Manager',
  approved_by_name: 'Finance Manager or Stock Manager',
  completed_by_name: 'Stock Manager',
  received_by_name: 'Joe',
};

function RequisitionScreen() {
  const [open, setOpen] = useState(true);
  return (
    <div className="uhome_mock-app uhome_mock-requisition-wrap">
      <StaffSidebar active="requests" />
      <div className="uhome_mock-main">
        <StaffTopbar onMenu />
        <div className="uhome_mock-page-body">
          <div className="uhome_mock-page-header-row">
            <h2 className="uhome_mock-page-title"><i className="bi bi-inbox"></i> My Requests</h2>
          </div>
          <div className="uhome_mock-table">
            <div className="uhome_mock-thead">
              <span>#</span><span>Date</span><span>Product</span><span>Qty</span><span>Unit</span><span>Status</span>
            </div>
            <div className="uhome_mock-trow highlight">
              <span>12</span><span>2025-01-15</span>
              <span><strong>Marker Pen</strong></span>
              <span>3</span><span>pieces</span>
              <span className="uhome_mock-badge received">received</span>
            </div>
          </div>

          {open && (
            <div className="uhome_mock-requisition-host">
              <RequisitionForm
                request={SAMPLE_REQUEST}
                onClose={() => setOpen(false)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* --- Usage flow (still used by the merged scene) --- */
function UsageScreen({ stage }) {
  const rows = [{ id: 12, date: '2025-01-15', product: 'Marker Pen', qty: 3, unit: 'pieces', status: 'received' }];
  const usageRows = [{ id: 1, date: '2025-01-15', product: 'Marker Pen', used: 2, damaged: 0, remaining: 1, unit: 'pieces' }];
  return (
    <div className="uhome_mock-app">
      <StaffSidebar active="requests" />
      <div className="uhome_mock-main">
        <StaffTopbar onMenu />
        <div className="uhome_mock-page-body">
          <div className="uhome_mock-page-header-row">
            <h2 className="uhome_mock-page-title"><i className="bi bi-inbox"></i> My Requests</h2>
          </div>

          {(stage === 0 || stage === 1) && (
            <div className="uhome_mock-table">
              <div className="uhome_mock-thead">
                <span>#</span><span>Date</span><span>Product</span><span>Qty</span><span>Unit</span><span>Status</span>
              </div>
              {rows.map((r) => (
                <div className="uhome_mock-trow" key={r.id}>
                  <span>{r.id}</span><span>{r.date}</span>
                  <span><strong>{r.product}</strong></span>
                  <span>{r.qty}</span><span>{r.unit}</span>
                  <span className="uhome_mock-badge received">{r.status}</span>
                </div>
              ))}
            </div>
          )}

          {stage === 1 && (
            <div className="uhome_mock-action-row">
              <span className="uhome_mock-btn-primary"><i className="bi bi-clipboard-plus"></i> Report Usage</span>
            </div>
          )}

          {stage === 2 && (
            <div className="uhome_mock-modal-mock">
              <div className="uhome_mock-modal-head">Report Usage — Marker Pen <i className="bi bi-x-lg"></i></div>
              <div className="uhome_mock-modal-body">
                <div className="uhome_mock-info">
                  <i className="bi bi-info-circle-fill"></i> You received <strong>3 pieces</strong>.
                </div>
                <div className="uhome_mock-total-badge">
                  <span><i className="bi bi-box-seam"></i> Received</span><strong>3 pieces</strong>
                </div>
                <div className="uhome_mock-two-cols">
                  <div className="uhome_mock-field"><label>Used Quantity *</label><div className="uhome_mock-input filled">2</div></div>
                  <div className="uhome_mock-field"><label>Damaged Quantity *</label><div className="uhome_mock-input filled">0</div></div>
                </div>
                <div className="uhome_mock-field"><label>Remaining Quantity *</label><div className="uhome_mock-input filled">1</div></div>
                <div className="uhome_mock-field"><label>Notes</label><div className="uhome_mock-input filled">For teaching</div></div>
              </div>
            </div>
          )}

          {stage === 3 && (
            <div className="uhome_mock-toast-inline"><i className="bi bi-check-circle-fill"></i> Usage report submitted</div>
          )}

          {(stage === 4 || stage === 5) && (
            <>
              <h4 className="uhome_mock-section-title" style={{ marginTop: 8 }}>
                <i className="bi bi-clipboard-data"></i> My Usage Reports
              </h4>
              <div className="uhome_mock-table">
                <div className="uhome_mock-thead usage">
                  <span>#</span><span>Date</span><span>Product</span><span>Used</span><span>Damaged</span><span>Remaining</span>
                </div>
                {usageRows.map((u) => (
                  <div className="uhome_mock-trow" key={u.id}>
                    <span>{u.id}</span><span>{u.date}</span>
                    <span><strong>{u.product}</strong></span>
                    <span className="uhome_mock-badge red">{u.used} {u.unit}</span>
                    <span className="uhome_mock-badge">{u.damaged} {u.unit}</span>
                    <span className="uhome_mock-badge green">{u.remaining} {u.unit}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {stage === 5 && (
            <div className="uhome_mock-modal-mock" style={{ marginTop: 12 }}>
              <div className="uhome_mock-modal-head">Edit Usage — Marker Pen <i className="bi bi-x-lg"></i></div>
              <div className="uhome_mock-modal-body">
                <div className="uhome_mock-info yellow">
                  <i className="bi bi-info-circle-fill"></i> You can only increase Used or Damaged.
                </div>
                <div className="uhome_mock-two-cols">
                  <div className="uhome_mock-field"><label>Used *</label><div className="uhome_mock-input filled">3</div></div>
                  <div className="uhome_mock-field"><label>Damaged *</label><div className="uhome_mock-input filled">0</div></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* --- Catalog --- */
function CatalogScreen({ stage }) {
  const products = [
    { name: 'Marker Pen', cat: 'Office', qty: 24, min: 10, unit: 'pieces' },
    { name: 'Rice 25kg', cat: 'Food', qty: 8, min: 20, unit: 'bags' },
    { name: 'First-Aid Kit', cat: 'Medical', qty: 15, min: 5, unit: 'pieces' },
    { name: 'Water Filter', cat: 'WASH', qty: 3, min: 10, unit: 'pieces' },
    { name: 'Notebook', cat: 'Office', qty: 50, min: 15, unit: 'pieces' },
    { name: 'Cooking Oil', cat: 'Food', qty: 6, min: 12, unit: 'litres' },
  ];
  const filtered = products.filter((p) => (stage >= 3 ? p.name.toLowerCase().includes('marker') : true));
  return (
    <div className="uhome_mock-app">
      <StaffSidebar active="catalog" />
      <div className="uhome_mock-main">
        <StaffTopbar onMenu />
        <div className="uhome_mock-page-body">
          <h2 className="uhome_mock-page-title"><i className="bi bi-box-seam"></i> Products Catalog</h2>
          <div className="uhome_mock-toolbar-row">
            <div className="uhome_mock-search">
              <i className="bi bi-search"></i>
              <span>{stage >= 3 ? 'marker' : 'Search products...'}</span>
            </div>
            <span className="uhome_mock-count">{filtered.length} products</span>
          </div>
          <div className="uhome_mock-cards">
            {filtered.map((p, i) => {
              const low = p.qty <= p.min;
              return (
                <div className={`uhome_mock-card ${stage >= 4 && low ? 'low' : ''}`} key={i}>
                  <div className="uhome_mock-card-img"><i className="bi bi-image"></i></div>
                  <strong>{p.name}</strong>
                  <span className="uhome_mock-badge">{p.cat}</span>
                  <div className="uhome_mock-card-stock"><i className="bi bi-boxes"></i> {p.qty} {p.unit}</div>
                  <div className={`uhome_mock-stock ${low ? 'low' : 'ok'}`}>{low ? 'Low stock' : 'In stock'}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}