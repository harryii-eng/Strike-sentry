import { useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Filter,
  Gauge,
  History,
  LayoutDashboard,
  ListFilter,
  LockKeyhole,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  Link,
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';
import { type ReactNode } from 'react';

type OpportunityStatus = 'candidate' | 'approved' | 'rejected';
type Opportunity = {
  id: string;
  ticker: string;
  company: string;
  expiry: string;
  days: number;
  strike: string;
  spot: string;
  premium: string;
  collateral: string;
  yield: string;
  probability: string;
  delta: string;
  ivRank: string;
  score: number;
  status: OpportunityStatus;
  earnings: string;
  thesis: string;
};
type ActivityRecord = {
  id: number;
  title: string;
  detail: string;
  time: string;
  type: 'approved' | 'rejected' | 'scan' | 'system';
};

const queryClient = new QueryClient();

const seededOpportunities: Opportunity[] = [
  {
    id: 'PFE-360P',
    ticker: 'PFE',
    company: 'Pfizer Inc.',
    expiry: 'Aug 16, 2025',
    days: 42,
    strike: '$36.00',
    spot: '$38.42',
    premium: '$1.51',
    collateral: '$3,600',
    yield: '4.18%',
    probability: '78%',
    delta: '-0.24',
    ivRank: '42',
    score: 86,
    status: 'candidate',
    earnings: 'Clear · 64 days',
    thesis: 'Income is supported by a defined catalyst window and a strike 6.3% below spot. The model prefers the cushion over peak premium.',
  },
  {
    id: 'AMD-135P',
    ticker: 'AMD',
    company: 'Advanced Micro Devices',
    expiry: 'Jul 19, 2025',
    days: 14,
    strike: '$135.00',
    spot: '$141.88',
    premium: '$2.75',
    collateral: '$13,500',
    yield: '2.04%',
    probability: '72%',
    delta: '-0.28',
    ivRank: '58',
    score: 79,
    status: 'candidate',
    earnings: 'Clear · 21 days',
    thesis: 'A shorter duration candidate with healthy liquidity. Higher IV helps premium, but the model flags tighter downside room than the PFE idea.',
  },
  {
    id: 'COST-820P',
    ticker: 'COST',
    company: 'Costco Wholesale',
    expiry: 'Sep 20, 2025',
    days: 77,
    strike: '$820.00',
    spot: '$856.40',
    premium: '$9.65',
    collateral: '$82,000',
    yield: '1.18%',
    probability: '84%',
    delta: '-0.16',
    ivRank: '31',
    score: 74,
    status: 'candidate',
    earnings: 'Clear · 89 days',
    thesis: 'The strongest probability profile in the scan, offset by low income efficiency and a large collateral footprint.',
  },
  {
    id: 'ETSY-52P',
    ticker: 'ETSY',
    company: 'Etsy, Inc.',
    expiry: 'Aug 16, 2025',
    days: 42,
    strike: '$52.00',
    spot: '$56.28',
    premium: '$1.42',
    collateral: '$5,200',
    yield: '2.73%',
    probability: '75%',
    delta: '-0.25',
    ivRank: '67',
    score: 68,
    status: 'rejected',
    earnings: 'Watch · 9 days',
    thesis: 'Premium is attractive, but the upcoming earnings window violates the current review policy.',
  },
  {
    id: 'KO-60P',
    ticker: 'KO',
    company: 'The Coca-Cola Company',
    expiry: 'Oct 17, 2025',
    days: 108,
    strike: '$60.00',
    spot: '$63.24',
    premium: '$1.05',
    collateral: '$6,000',
    yield: '1.75%',
    probability: '81%',
    delta: '-0.19',
    ivRank: '25',
    score: 63,
    status: 'candidate',
    earnings: 'Clear · 44 days',
    thesis: 'Defensive underlying and a wide cushion, though the long time to expiry keeps capital tied up.',
  },
];

const seededActivity: ActivityRecord[] = [
  { id: 1, title: 'PFE $36 put marked for review', detail: 'Model score 86 · capital check passed', time: '09:41', type: 'system' },
  { id: 2, title: 'Earnings guardrail held', detail: 'ETSY candidate moved to rejected', time: '09:32', type: 'rejected' },
  { id: 3, title: 'Universe scan completed', detail: '5 candidates evaluated · 4 reviewable', time: '09:30', type: 'scan' },
  { id: 4, title: 'Collateral policy synced', detail: 'Max single-name allocation set to 18%', time: 'Yesterday', type: 'system' },
];

const positions = [
  { ticker: 'MSFT', contract: '$405 put · Jul 19', collateral: '$40,500', value: '$1,840', risk: 'low', cushion: '8.1%' },
  { ticker: 'JPM', contract: '$185 put · Aug 16', collateral: '$18,500', value: '$1,120', risk: 'medium', cushion: '6.8%' },
  { ticker: 'XLF', contract: '$41 put · Sep 20', collateral: '$4,100', value: '$304', risk: 'low', cushion: '9.4%' },
];

function StatusBadge({ status }: { status: OpportunityStatus }) {
  const labels = { candidate: 'Candidate', approved: 'Approved for review', rejected: 'Rejected' };
  return <span className={`ss-badge ss-badge-${status}`} data-testid={`status-opportunity-${status}`}><span className="ss-market-dot" style={{ background: status === 'rejected' ? 'currentColor' : undefined }} />{labels[status]}</span>;
}

function NavItem({ href, label, icon: Icon, count }: { href: string; label: string; icon: LucideIcon; count?: number }) {
  const [location] = useLocation();
  const active = href === '/' ? location === '/' : location.startsWith(href);
  return (
    <Link href={href} className={`ss-nav-link ${active ? 'active' : ''}`} data-testid={`link-nav-${label.toLowerCase()}`}>
      <Icon size={16} strokeWidth={active ? 2.3 : 1.8} /><span>{label}</span>{count ? <span className="ss-nav-count">{count}</span> : null}
    </Link>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="ss-shell">
      <aside className="ss-sidebar">
        <div className="ss-brand"><div className="ss-mark">SS</div><div><div className="ss-brand-name">Strike Sentry</div><div className="ss-brand-sub">risk operations</div></div></div>
        <div className="ss-nav-label">Workspace</div>
        <nav className="ss-nav">
          <NavItem href="/" label="Overview" icon={LayoutDashboard} />
          <NavItem href="/opportunities" label="Opportunities" icon={ListFilter} count={4} />
          <NavItem href="/positions" label="Positions" icon={BriefcaseBusiness} />
          <NavItem href="/activity" label="Activity" icon={History} />
        </nav>
        <div className="ss-sidebar-bottom">
          <div className="ss-demo-pill"><span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="ss-demo-dot" />Simulation mode</span><LockKeyhole size={13} /></div>
          <div style={{ color: 'hsl(42 20% 54%)', fontSize: 10, lineHeight: 1.45, marginTop: 10 }}>No broker connected. Decisions stay local until you choose otherwise.</div>
        </div>
      </aside>
      <main className="ss-main">
        <header className="ss-topbar">
          <div className="ss-breadcrumb"><span>Desk</span><ChevronRight size={13} /><strong data-testid="text-current-route">Risk overview</strong></div>
          <div className="ss-top-actions"><div className="ss-market-state"><span className="ss-market-dot" />Market data simulated</div><div className="ss-user">AR</div></div>
        </header>
        <nav className="ss-mobile-nav">
          <NavItem href="/" label="Overview" icon={LayoutDashboard} />
          <NavItem href="/opportunities" label="Ideas" icon={ListFilter} count={4} />
          <NavItem href="/positions" label="Risk" icon={BriefcaseBusiness} />
          <NavItem href="/activity" label="Log" icon={History} />
        </nav>
        {children}
      </main>
    </div>
  );
}

function StatCard({ label, value, note, icon: Icon, tone = '' }: { label: string; value: string; note: string; icon: LucideIcon; tone?: string }) {
  return <div className="ss-card ss-stat" data-testid={`stat-${label.toLowerCase().replaceAll(' ', '-')}`}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div className="ss-stat-label">{label}</div><Icon size={16} color={tone || 'hsl(var(--muted-foreground))'} /></div><div className="ss-stat-value" style={tone ? { color: tone } : undefined}>{value}</div><div className="ss-stat-note">{note}</div></div>;
}

function DecisionSpotlight({ opportunity, onApprove, onReject, onInspect }: { opportunity?: Opportunity; onApprove: () => void; onReject: () => void; onInspect: () => void }) {
  if (!opportunity) {
    return <div className="ss-spotlight" data-testid="empty-dashboard-decision"><div className="ss-eyebrow">Current decision</div><h2>Review queue is clear.</h2><p>There are no candidate puts waiting for a decision. Run a local scan when you want to refresh the desk.</p><button className="ss-button ss-button-primary" onClick={onInspect} data-testid="button-open-opportunities">Open opportunities <ArrowRight size={14} /></button></div>;
  }
  return (
    <div className="ss-spotlight" data-testid="card-current-decision">
      <div className="ss-eyebrow">Current decision · {opportunity.status === 'candidate' ? 'needs your review' : opportunity.status}</div>
      <h2>{opportunity.ticker} {opportunity.strike} put</h2>
      <p>{opportunity.thesis}</p>
      <div className="ss-opportunity-meta">
        <div className="ss-meta-block"><span>Premium</span><strong>{opportunity.premium}</strong></div>
        <div className="ss-meta-block"><span>Collateral</span><strong>{opportunity.collateral}</strong></div>
        <div className="ss-meta-block"><span>Annualized yield</span><strong className="lime">{opportunity.yield}</strong></div>
        <div className="ss-meta-block"><span>Model score</span><strong className="lime">{opportunity.score}/100</strong></div>
      </div>
      {opportunity.status === 'candidate' ? <div className="ss-spotlight-actions"><button className="ss-button ss-button-primary" onClick={onApprove} data-testid="button-approve-current"><Check size={15} />Approve for review</button><button className="ss-button ss-button-quiet" style={{ color: 'hsl(42 33% 95%)', borderColor: 'hsl(204 23% 37%)' }} onClick={onReject} data-testid="button-reject-current"><X size={15} />Reject</button><button className="ss-button ss-button-quiet" style={{ color: 'hsl(42 33% 95%)', borderColor: 'hsl(204 23% 37%)' }} onClick={onInspect} data-testid="button-inspect-current">Inspect <ArrowRight size={14} /></button></div> : <div className="ss-spotlight-actions"><button className="ss-button ss-button-quiet" style={{ color: 'hsl(42 33% 95%)', borderColor: 'hsl(204 23% 37%)' }} onClick={onInspect} data-testid="button-inspect-decided">View decision detail <ArrowRight size={14} /></button></div>}
    </div>
  );
}

function TrustChecks() {
  const checks = [
    { title: 'Collateral capacity', desc: '$62,900 available after open positions', icon: CheckCircle2 },
    { title: 'Earnings guardrail', desc: 'No selected idea inside the 14-day window', icon: CheckCircle2 },
    { title: 'Concentration watch', desc: 'JPM exposure is approaching the soft limit', icon: CircleAlert, watch: true },
    { title: 'Market data freshness', desc: 'Simulated snapshot · 18 seconds ago', icon: CheckCircle2 },
  ];
  return <div className="ss-card ss-check-card" data-testid="card-trust-checks"><div className="ss-section-label"><span>System trust signals</span><ShieldCheck size={15} /></div><div className="ss-check-list">{checks.map(({ title, desc, icon: Icon, watch }) => <div className="ss-check" key={title}><div className={`ss-check-icon ${watch ? 'watch' : ''}`}><Icon size={13} /></div><div><div className="ss-check-title">{title}</div><div className="ss-check-desc">{desc}</div></div></div>)}</div></div>;
}

function ExposureCard() {
  return <div className="ss-card ss-card-pad" data-testid="card-portfolio-exposure"><div className="ss-section-label"><span>Portfolio exposure</span><Link href="/positions" style={{ color: 'hsl(var(--muted-foreground))' }} data-testid="link-exposure-positions"><ArrowRight size={15} /></Link></div><div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}><strong className="ss-mono" style={{ fontSize: 26, letterSpacing: '-.07em' }}>$63,100</strong><span style={{ color: 'hsl(161 49% 34%)', font: '11px var(--app-font-mono)' }}>58.2% deployed</span></div><div className="ss-exposure" style={{ marginTop: 19 }}><span style={{ width: '64%' }} /><span style={{ width: '23%' }} /><span style={{ width: '13%' }} /></div><div className="ss-exposure-legend"><span><i className="ss-legend-dot" style={{ background: 'hsl(var(--accent))' }} />Equity puts 64%</span><span><i className="ss-legend-dot" style={{ background: 'hsl(173 48% 38%)' }} />Financials 23%</span><span><i className="ss-legend-dot" style={{ background: 'hsl(38 88% 55%)' }} />ETF 13%</span></div></div>;
}

function RecentActivity({ records }: { records: ActivityRecord[] }) {
  return <div className="ss-card ss-card-pad"><div className="ss-section-label"><span>Latest decisions</span><Link href="/activity" style={{ color: 'hsl(var(--muted-foreground))' }} data-testid="link-latest-activity"><ArrowRight size={15} /></Link></div><div className="ss-activity">{records.slice(0, 3).map(record => <ActivityRow record={record} key={record.id} />)}</div></div>;
}

function ActivityRow({ record }: { record: ActivityRecord }) {
  const Icon = record.type === 'approved' ? Check : record.type === 'rejected' ? X : record.type === 'scan' ? RefreshCw : ShieldCheck;
  return <div className="ss-activity-item" data-testid={`activity-row-${record.id}`}><div className="ss-activity-icon"><Icon size={13} /></div><div className="ss-activity-text"><strong>{record.title}</strong><div className="ss-subtext">{record.detail}</div></div><div className="ss-activity-time">{record.time}</div></div>;
}

function PageFrame({ eyebrow, title, intro, actions, children }: { eyebrow: string; title: string; intro: string; actions?: ReactNode; children: ReactNode }) {
  return <section className="ss-content"><div className="ss-title-row"><div><div className="ss-eyebrow">{eyebrow}</div><h1 className="ss-page-title">{title}</h1><p className="ss-page-intro">{intro}</p></div>{actions}</div>{children}</section>;
}

function Dashboard({ opportunities, activities, onApprove, onReject, onInspect }: { opportunities: Opportunity[]; activities: ActivityRecord[]; onApprove: (id: string) => void; onReject: (id: string) => void; onInspect: () => void }) {
  const focus = opportunities.find(item => item.id === 'PFE-360P') ?? opportunities.find(item => item.status === 'candidate');
  return <PageFrame eyebrow="Tuesday · 09:42 ET · simulated market" title="Deploy capital deliberately." intro="A quiet desk for reviewing cash-secured put ideas. Nothing leaves this screen without a human decision." actions={<Link href="/opportunities" className="ss-button ss-button-dark" data-testid="link-review-queue">Review queue <ArrowRight size={14} /></Link>}>
    <div className="ss-grid-three" style={{ marginBottom: 18 }}><StatCard label="Buying power" value="$62,900" note="After open collateral" icon={BarChart3} tone="hsl(161 49% 34%)" /><StatCard label="Open collateral" value="$63,100" note="3 positions · 58.2%" icon={BriefcaseBusiness} /><StatCard label="Queue health" value={`${opportunities.filter(item => item.status === 'candidate').length} ready`} note="1 needs attention" icon={Gauge} tone="hsl(76 48% 27%)" /></div>
    <div className="ss-grid-main"><DecisionSpotlight opportunity={focus} onApprove={() => focus && onApprove(focus.id)} onReject={() => focus && onReject(focus.id)} onInspect={onInspect} /><TrustChecks /></div>
    <div className="ss-grid-main" style={{ marginTop: 18 }}><ExposureCard /><RecentActivity records={activities} /></div>
  </PageFrame>;
}

function Opportunities({ opportunities, selectedId, setSelectedId, onApprove, onReject, onScan, scanning }: { opportunities: Opportunity[]; selectedId: string; setSelectedId: (id: string) => void; onApprove: (id: string) => void; onReject: (id: string) => void; onScan: () => void; scanning: boolean }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | OpportunityStatus>('all');
  const selected = opportunities.find(item => item.id === selectedId) ?? opportunities[0];
  const filtered = useMemo(() => opportunities.filter(item => (filter === 'all' || item.status === filter) && `${item.ticker} ${item.company}`.toLowerCase().includes(query.toLowerCase())), [opportunities, filter, query]);
  return <PageFrame eyebrow="Opportunity review" title="Ideas, with their receipts." intro="Candidates are scored for probability, cushion, liquidity, and policy fit. Review the why before approving anything for the next step." actions={<div style={{ display: 'flex', alignItems: 'center' }}><span className="ss-scan-note">{scanning ? 'Scanning local universe…' : 'Last scan 09:30 ET'}</span><button className="ss-button ss-button-primary" onClick={onScan} disabled={scanning} data-testid="button-scan-opportunities">{scanning ? <span className="ss-loader" /> : <RefreshCw size={14} />} {scanning ? 'Scanning' : 'Run local scan'}</button></div>}>
    <div className="ss-toolbar" style={{ marginBottom: 14 }}><div style={{ position: 'relative', flex: '1 1 210px' }}><Search size={14} style={{ position: 'absolute', left: 11, top: 11, color: 'hsl(var(--muted-foreground))' }} /><input className="ss-input" style={{ width: '100%', paddingLeft: 31 }} value={query} onChange={event => setQuery(event.target.value)} placeholder="Search ticker or company" data-testid="input-search-opportunities" /></div><select className="ss-select" value={filter} onChange={event => setFilter(event.target.value as 'all' | OpportunityStatus)} data-testid="select-opportunity-filter"><option value="all">All statuses</option><option value="candidate">Candidates</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select><button className="ss-button ss-button-quiet" onClick={() => { setQuery(''); setFilter('all'); }} data-testid="button-clear-filters"><SlidersHorizontal size={14} />Reset</button></div>
    <div className="ss-opportunity-layout"><div className="ss-card ss-table-wrap">{filtered.length ? <table className="ss-table"><thead><tr><th>Underlying</th><th>Strike / expiry</th><th>Premium</th><th>Probability</th><th>Score</th><th>Status</th></tr></thead><tbody>{filtered.map(item => <tr className="data-row" key={item.id} onClick={() => setSelectedId(item.id)} style={{ cursor: 'pointer', background: selected?.id === item.id ? 'hsl(var(--accent) / .08)' : undefined }} data-testid={`row-opportunity-${item.id}`}><td><div className="ss-ticker">{item.ticker}</div><div className="ss-subtext">{item.company}</div></td><td><div className="ss-ticker">{item.strike}</div><div className="ss-subtext">{item.expiry} · {item.days}d</div></td><td><div className="ss-ticker">{item.premium}</div><div className="ss-subtext">{item.yield} yield</div></td><td><div className="ss-ticker">{item.probability}</div><div className="ss-subtext">Δ {item.delta}</div></td><td><div className="ss-ticker">{item.score}<span style={{ color: 'hsl(var(--muted-foreground))', fontSize: 10 }}>/100</span></div><div className="ss-subtext">model</div></td><td><StatusBadge status={item.status} /></td></tr>)}</tbody></table> : <div className="ss-empty" data-testid="empty-opportunity-filter"><div className="ss-empty-icon"><Filter size={18} /></div><h3>No ideas match that filter.</h3><p>Try a different status or clear the search. Rejected ideas remain visible in the log for accountability.</p><button className="ss-button ss-button-quiet" onClick={() => { setQuery(''); setFilter('all'); }} data-testid="button-empty-reset">Clear filters</button></div>}</div>
      {selected ? <OpportunityDetail opportunity={selected} onApprove={onApprove} onReject={onReject} /> : <div className="ss-card ss-empty"><div className="ss-empty-icon"><ListFilter size={18} /></div><h3>Select an opportunity</h3></div>}
    </div>
  </PageFrame>;
}

function OpportunityDetail({ opportunity, onApprove, onReject }: { opportunity: Opportunity; onApprove: (id: string) => void; onReject: (id: string) => void }) {
  return <aside className="ss-card ss-detail" data-testid={`card-opportunity-detail-${opportunity.id}`}><div className="ss-detail-head"><StatusBadge status={opportunity.status} /><h2>{opportunity.ticker} {opportunity.strike}</h2><div className="ss-subtext">{opportunity.company} · cash-secured put</div></div><div className="ss-detail-body"><div className="ss-detail-grid"><div><label>Spot price</label><strong>{opportunity.spot}</strong></div><div><label>Days to expiry</label><strong>{opportunity.days}</strong></div><div><label>IV rank</label><strong>{opportunity.ivRank}</strong></div><div><label>Delta</label><strong>{opportunity.delta}</strong></div><div><label>Collateral</label><strong>{opportunity.collateral}</strong></div><div><label>Earnings</label><strong style={{ fontSize: 12 }}>{opportunity.earnings}</strong></div></div><div className="ss-explain"><div className="ss-explain-title">Why this is here</div><p>{opportunity.thesis}</p></div>{opportunity.status === 'candidate' ? <div className="ss-detail-actions"><button className="ss-button ss-button-primary" onClick={() => onApprove(opportunity.id)} data-testid={`button-approve-${opportunity.id}`}><Check size={14} />Approve</button><button className="ss-button ss-button-danger" onClick={() => onReject(opportunity.id)} data-testid={`button-reject-${opportunity.id}`}><X size={14} />Reject</button></div> : <div className="ss-explain" style={{ marginBottom: 0 }}><div style={{ display: 'flex', gap: 7, alignItems: 'center', fontSize: 11, fontWeight: 700 }}><CheckCircle2 size={14} />Decision recorded locally</div><p style={{ marginTop: 5 }}>This simulation does not connect to a broker or submit orders.</p></div>}</div></aside>;
}

function Positions() {
  const [showConcentrated, setShowConcentrated] = useState(false);
  const visible = showConcentrated ? positions.filter(item => item.risk === 'medium') : positions;
  return <PageFrame eyebrow="Portfolio risk" title="Know what is already at work." intro="Collateral is the constraint. This view keeps open obligations visible before a new put competes for the same capital." actions={<button className="ss-button ss-button-quiet" onClick={() => setShowConcentrated(value => !value)} data-testid="button-toggle-concentration"><Filter size={14} />{showConcentrated ? 'Show all positions' : 'Show concentration watch'}</button>}>
    <div className="ss-grid-three" style={{ marginBottom: 18 }}><StatCard label="Open collateral" value="$63,100" note="3 active positions" icon={BriefcaseBusiness} /><StatCard label="Available capital" value="$62,900" note="Room for new ideas" icon={TrendingUp} tone="hsl(161 49% 34%)" /><StatCard label="Risk utilization" value="58.2%" note="Soft ceiling at 72%" icon={Gauge} /></div>
    <div className="ss-card ss-card-pad" style={{ marginBottom: 18 }}><div className="ss-section-label"><span>Collateral utilization</span><span className="ss-mono">58.2 / 72.0%</span></div><div className="ss-risk-bar"><span /></div><div className="ss-subtext" style={{ marginTop: 10 }}>You have $62,900 of simulated buying power remaining. The JPM position is the only name near a soft concentration limit.</div></div>
    <div className="ss-card ss-table-wrap"><table className="ss-table"><thead><tr><th>Underlying</th><th>Contract</th><th>Collateral</th><th>Mark value</th><th>Cushion</th><th>Risk</th></tr></thead><tbody>{visible.map(item => <tr className="data-row" key={item.ticker} data-testid={`row-position-${item.ticker}`}><td><div className="ss-ticker">{item.ticker}</div><div className="ss-subtext">Cash-secured</div></td><td className="ss-mono">{item.contract}</td><td className="ss-mono">{item.collateral}</td><td><div className="ss-ticker">{item.value}</div><div className="ss-subtext">credit retained</div></td><td className="ss-mono">{item.cushion}</td><td><span className={`ss-badge ${item.risk === 'medium' ? 'ss-badge-rejected' : 'ss-badge-approved'}`}>{item.risk === 'medium' ? 'Watch' : 'Within range'}</span></td></tr>)}</tbody></table>{!visible.length && <div className="ss-empty"><div className="ss-empty-icon"><BriefcaseBusiness size={18} /></div><h3>No concentrated positions.</h3><p>Every open position is currently within the normal range.</p></div>}</div>
  </PageFrame>;
}

function ActivityPage({ activities }: { activities: ActivityRecord[] }) {
  const [type, setType] = useState<'all' | ActivityRecord['type']>('all');
  const visible = activities.filter(record => type === 'all' || record.type === type);
  return <PageFrame eyebrow="Decision history" title="A review trail you can trust." intro="Every local decision is recorded with its context. This is a demo ledger, not a broker activity feed." actions={<select className="ss-select" value={type} onChange={event => setType(event.target.value as 'all' | ActivityRecord['type'])} data-testid="select-activity-filter"><option value="all">All events</option><option value="approved">Approvals</option><option value="rejected">Rejections</option><option value="scan">Scans</option><option value="system">System</option></select>}>
    <div className="ss-card ss-card-pad"><div className="ss-section-label"><span>{visible.length} recorded events</span><span className="ss-mono">Local ledger · demo</span></div>{visible.length ? <div className="ss-activity">{visible.map(record => <ActivityRow record={record} key={record.id} />)}</div> : <div className="ss-empty" data-testid="empty-activity-filter"><div className="ss-empty-icon"><History size={18} /></div><h3>The ledger is quiet here.</h3><p>No events match this view yet. Change the filter to see the full review trail.</p><button className="ss-button ss-button-quiet" onClick={() => setType('all')} data-testid="button-clear-activity-filter">Show all events</button></div>}</div>
    <div className="ss-card ss-card-pad" style={{ marginTop: 17, display: 'flex', gap: 13, alignItems: 'flex-start' }}><div className="ss-check-icon"><LockKeyhole size={13} /></div><div><div className="ss-check-title">Why the ledger is local</div><div className="ss-check-desc">Strike Sentry is running in simulation mode. No broker credentials, market orders, or external account data are present in this demo.</div></div></div>
  </PageFrame>;
}

function Router({ opportunities, activities, selectedId, setSelectedId, onApprove, onReject, onScan, scanning }: { opportunities: Opportunity[]; activities: ActivityRecord[]; selectedId: string; setSelectedId: (id: string) => void; onApprove: (id: string) => void; onReject: (id: string) => void; onScan: () => void; scanning: boolean }) {
  const [, setLocation] = useLocation();
  return <RoutedErrorBoundary><Shell><Switch><Route path="/"><Dashboard opportunities={opportunities} activities={activities} onApprove={onApprove} onReject={onReject} onInspect={() => setLocation('/opportunities')} /></Route><Route path="/opportunities"><Opportunities opportunities={opportunities} selectedId={selectedId} setSelectedId={setSelectedId} onApprove={onApprove} onReject={onReject} onScan={onScan} scanning={scanning} /></Route><Route path="/positions"><Positions /></Route><Route path="/activity"><ActivityPage activities={activities} /></Route><Route component={NotFound} /></Switch></Shell></RoutedErrorBoundary>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>(seededOpportunities);
  const [activities, setActivities] = useState<ActivityRecord[]>(seededActivity);
  const [selectedId, setSelectedId] = useState('PFE-360P');
  const [scanning, setScanning] = useState(false);
  const decide = (id: string, status: OpportunityStatus) => {
    const item = opportunities.find(opportunity => opportunity.id === id);
    if (!item || item.status !== 'candidate') return;
    setOpportunities(current => current.map(opportunity => opportunity.id === id ? { ...opportunity, status } : opportunity));
    setActivities(current => [{ id: Date.now(), title: `${item.ticker} ${item.strike} put ${status === 'approved' ? 'approved for review' : 'rejected'}`, detail: status === 'approved' ? 'Human review complete · no order submitted' : 'Removed from active queue by human review', time: 'Just now', type: status === 'approved' ? 'approved' : 'rejected' }, ...current]);
  };
  const scan = () => {
    if (scanning) return;
    setScanning(true);
    window.setTimeout(() => {
      setScanning(false);
      setActivities(current => [{ id: Date.now(), title: 'Universe scan completed', detail: 'Local seed refreshed · no external data requested', time: 'Just now', type: 'scan' }, ...current]);
    }, 900);
  };
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router opportunities={opportunities} activities={activities} selectedId={selectedId} setSelectedId={setSelectedId} onApprove={id => decide(id, 'approved')} onReject={id => decide(id, 'rejected')} onScan={scan} scanning={scanning} /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;