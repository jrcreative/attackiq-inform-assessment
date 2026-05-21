import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { getScoreLabel } from './scoring';

const PAGE_WIDTH = 880;
const PAGE_HEIGHT = 1120;

const BRAND = {
    ink: '#000029',
    purple: '#40008F',
    purpleLight: '#B399D2',
    purpleXLight: '#D9CCE9',
    paper: '#FFFFFF',
    paper2: '#F4F4F8',
    muted: '#6B6480',
    rule: 'rgba(0,0,41,0.12)',
    cti: '#E5A117',
    dm: '#2936CC',
    te: '#E55639',
    ctem: '#7B3FF2',
    good: '#2EA66C',
};

const SECTION_META = {
    CTI: {
        color: BRAND.cti,
        lightColor: '#E5A117',
        label: 'Cyber Threat Intelligence',
        shortLabel: 'CTI',
        description: 'Focuses on understanding the adversary. CTI maturity reflects how thoroughly the organization characterizes the adversaries targeting its industry, technology, and geography and how well that knowledge drives the rest of the program.',
    },
    DM: {
        color: BRAND.dm,
        lightColor: '#7D88E6',
        label: 'Defensive Measures',
        shortLabel: 'DM',
        description: 'The operational core of threat-informed defense. DM maturity reflects how well the organization translates adversary knowledge into action across data collection, detection, response, recovery, hunting, and related controls.',
    },
    TE: {
        color: BRAND.te,
        lightColor: BRAND.te,
        label: 'Test & Evaluation',
        shortLabel: 'TE',
        description: 'Validates the program against adversary-realistic TTPs to reveal gaps and confirm effectiveness. T&E maturity reflects whether testing is continuous, relevant to current threats, and used to drive program improvement.',
    },
    CTEM: {
        color: BRAND.ctem,
        lightColor: '#B399D2',
        label: 'Continuous Threat Exposure Management',
        shortLabel: 'CTEM',
        description: 'Extends threat-informed defense into continuous exposure management. CTEM maturity reflects how well the organization discovers, prioritizes, validates, and mobilizes remediation of exposures.',
    },
};

const SECTION_WEIGHTS = { CTI: '28%', DM: '32%', TE: '20%', CTEM: '20%' };

const MATRIX_SECTION_COLORS = {
    CTI: {
        highest: { bg: '#ffcc00', border: '#e6b800', text: '#000000' },
        selected: { bg: '#fff3cc', border: '#e6b800', text: '#8a6d00' },
        available: { bg: '#FFFFFF', border: '#e6b800', text: '#8a6d00' },
    },
    DM: {
        highest: { bg: '#36bae4', border: '#2a9bbf', text: '#000000' },
        selected: { bg: '#d6f0fa', border: '#2a9bbf', text: '#1a6e8a' },
        available: { bg: '#FFFFFF', border: '#2a9bbf', text: '#1a6e8a' },
    },
    TE: {
        highest: { bg: '#f02c68', border: '#d41e56', text: '#FFFFFF' },
        selected: { bg: '#fdd6e3', border: '#d41e56', text: '#a01040' },
        available: { bg: '#FFFFFF', border: '#d41e56', text: '#a01040' },
    },
    CTEM: {
        highest: { bg: '#7b3ff2', border: '#5a23bf', text: '#FFFFFF' },
        selected: { bg: '#ece1ff', border: '#5a23bf', text: '#3f1d8a' },
        available: { bg: '#FFFFFF', border: '#5a23bf', text: '#3f1d8a' },
    },
};

const TP_FIELD_BY_QID = {
    'TP.1': 'sector',
    'TP.2': 'region',
    'TP.3': 'revenueBand',
    'TP.4': 'headcountBand',
    'TP.5': 'regulatory',
    'TP.6': 'dataSensitivity',
};

const TP_LABELS = {
    sector: 'TP.1 · Sector',
    region: 'TP.2 · Region',
    revenueBand: 'TP.3 · Annual Revenue',
    headcountBand: 'TP.4 · Employee Headcount',
    regulatory: 'TP.5 · Regulatory Environment',
    dataSensitivity: 'TP.6 · Data Sensitivity',
};

const ATTACKIQ_WHITE_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 321.3 33.9" aria-label="AttackIQ" role="img">
    <g fill="#FFFFFF">
      <path d="M187,23.7l2.8,4.1h-24.9c-1.4,0-2.6-0.2-3.6-0.5c-1-0.3-1.8-0.8-2.4-1.4c-0.6-0.6-1.1-1.3-1.4-2.1 c-0.3-0.8-0.4-1.7-0.4-2.7V6.9c0-1,0.1-1.9,0.4-2.7c0.3-0.8,0.7-1.5,1.4-2.1c0.6-0.6,1.4-1,2.4-1.4c1-0.3,2.2-0.5,3.6-0.5h24.9 L187,4.3h-22.2c-2.1,0-3.1,0.8-3.1,2.5v14.3c0,1.7,1,2.5,3.1,2.5H187z M219.3,13.8l16.5-13.5h-7.1L214.5,12h-9.1V0.3h-4.7v27.5 h4.7V16h9.7l14.3,11.7h7.1L219.3,13.8z M20.3,0c-1.1,0-1.7,0.6-2.4,1.5C17.7,1.7,0,27.8,0,27.8h5.3l15-22l7.8,11.5h-9.2l-2.7,4 h14.7l4.4,6.5h5.3L22.6,1.4C21.9,0.6,21.3,0,20.3,0z M38.3,4.3h15v23.4H58V4.3h12.2C71.1,3,72.1,1.6,73,0.3H41L38.3,4.3z M130.2,0c-1.1,0-1.7,0.6-2.4,1.5c-0.1,0.2-17.8,26.3-17.8,26.3h5.3l15-22l7.8,11.5h-9.2l-2.7,4h14.7l4.4,6.5h5.3L132.5,1.4 C131.8,0.6,131.3,0,130.2,0z M80,0.3l-2.8,4.1h15v23.4h4.7V4.3h12.2c0.9-1.4,1.9-2.7,2.8-4.1H80z"></path>
      <path d="M320.9,4.2c-0.3-0.8-0.7-1.5-1.4-2.1c-0.6-0.6-1.4-1-2.4-1.4c-1-0.3-2.2-0.5-3.6-0.5h-18.3 c-1.4,0-2.6,0.2-3.6,0.5c-1,0.3-1.8,0.8-2.4,1.4c-0.6,0.6-1.1,1.3-1.4,2.1c-0.3,0.8-0.4,1.7-0.4,2.7v14.2c0,1,0.1,1.9,0.4,2.7 c0.3,0.8,0.7,1.5,1.4,2.1c0.6,0.6,1.4,1,2.4,1.4c1,0.3,2.2,0.5,3.6,0.5h14.7l3.9,6.1h5l-4.1-6.1c2.4-0.2,4.1-0.9,5.1-2.1 c1-1.2,1.5-2.7,1.5-4.5V6.9C321.3,5.9,321.2,5,320.9,4.2z M316.6,21.2c0,1.7-1,2.5-3.1,2.5h-1.2l-4.4-6.6H303l4.2,6.6h-12 c-2.1,0-3.1-0.8-3.1-2.5V6.9c0-1.7,1-2.5,3.1-2.5h18.3c2.1,0,3.1,0.8,3.1,2.5V21.2z M264.3,23.7h13.9l-2.8,4.1h-29.7 c0.9-1.3,1.8-2.7,2.8-4.1h11V4.3h-13.9l2.8-4.1h29.7c-0.9,1.3-1.8,2.7-2.8,4.1h-11V23.7z"></path>
    </g>
  </svg>
`;

const ATTACKIQ_INK_SVG = ATTACKIQ_WHITE_SVG.replace('#FFFFFF', BRAND.ink);

const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const valueText = (value, fallback = '—') => {
    if (Array.isArray(value)) return value.length ? value.join(' · ') : fallback;
    return value || fallback;
};

const sectionFromMatrixItem = (item) => item.section_id || String(item.componentKey || item.uid || '').split('.')[0] || 'CTI';

const matrixPillStyle = (item) => {
    const colors = MATRIX_SECTION_COLORS[sectionFromMatrixItem(item)] || MATRIX_SECTION_COLORS.CTI;
    const palette = item.selected && item.highestValue
        ? colors.highest
        : item.selected
            ? colors.selected
            : colors.available;
    const borderStyle = item.selected ? 'solid' : 'dashed';

    return [
        `background-color:${palette.bg}`,
        `border-color:${palette.border}`,
        `border-style:${borderStyle}`,
        `color:${palette.text}`,
    ].join(';');
};

const getQuestionScore = (q) => {
    if (q.isNotApplicable) return -1;
    if (!q.hasAnswer) return 0;
    if (q.possiblePoints <= 0) return 0;

    const ratio = q.totalPoints / q.possiblePoints;
    if (ratio === 0 && q.hasAnswer) return 1;
    if (ratio === 0) return 0;
    if (ratio <= 0.2) return 1;
    if (ratio <= 0.4) return 2;
    if (ratio <= 0.6) return 3;
    if (ratio <= 0.8) return 4;
    return 5;
};

const levelClass = (level) => {
    if (level === -1) return 'na';
    if (level <= 1) return 'l1';
    if (level >= 5) return 'l5';
    return `l${level}`;
};

const scoreForSection = (section, calculateSectionScore) => {
    if (!section || section.scored === false) return -1;
    return calculateSectionScore ? calculateSectionScore(section) : 0;
};

const estimateQuestionRows = (section) => Math.ceil((section.questions?.length || 0) / 2);

const estimateDetailSectionHeight = (section) => {
    const rows = Math.max(1, estimateQuestionRows(section));
    const rowGaps = Math.max(0, rows - 1) * 12;
    const hasLongQuestion = (section.questions || []).some((q) => String(q.heading || q.questionText || '').length > 34);
    const wrapAllowance = hasLongQuestion ? 18 : 0;

    return 28 + 74 + (rows * 54) + rowGaps + wrapAllowance;
};

const chunkDetailSections = (sections, maxHeight = 850) => {
    const chunks = [];
    let current = [];
    let height = 92;

    sections.forEach((section) => {
        const sectionHeight = estimateDetailSectionHeight(section);
        if (current.length && height + sectionHeight > maxHeight) {
            chunks.push(current);
            current = [];
            height = 92;
        }
        current.push(section);
        height += sectionHeight;
    });

    if (current.length) chunks.push(current);
    return chunks;
};

const splitRecommendations = (groups) => {
    if (!groups.length) return [[]];
    const chunks = [];
    for (let i = 0; i < groups.length; i += 2) {
        chunks.push(groups.slice(i, i + 2));
    }
    return chunks;
};

const waitForFrame = () => new Promise(resolve => {
    let settled = false;
    const finish = () => {
        if (!settled) {
            settled = true;
            resolve();
        }
    };

    if (typeof window !== 'undefined' && window.requestAnimationFrame) {
        window.requestAnimationFrame(finish);
    }
    setTimeout(finish, 50);
});

const withTimeout = (promise, ms, label) => Promise.race([
    promise,
    new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    }),
]);

const updatePreviewWindow = (previewWindow, message) => {
    try {
        if (previewWindow && !previewWindow.closed) {
            previewWindow.document.body.innerHTML = `<div>${escapeHtml(message)}</div>`;
        }
    } catch (e) {
        // The preview tab may have navigated; progress updates are best effort.
    }
};

const scopeReportCss = (css) => css.replace(/(^|})\s*([^@{}][^{}]*)\{/g, (match, close, selectorText) => {
    const scopedSelectors = selectorText
        .split(',')
        .map(selector => selector.trim())
        .filter(Boolean)
        .map((selector) => {
            if (selector === 'html' || selector === 'body' || selector === 'html body') {
                return '.aiq-pdf-render-root';
            }
            if (selector === '*') {
                return '.aiq-pdf-render-root, .aiq-pdf-render-root *';
            }
            if (selector.startsWith('.aiq-pdf-render-root')) {
                return selector;
            }
            return `.aiq-pdf-render-root ${selector}`;
        })
        .join(', ');

    return `${close}\n    ${scopedSelectors} {`;
});

const renderStyles = () => `
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&family=Source+Sans+3:wght@400;500;600;700&display=swap');
    ${scopeReportCss(`
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      background-color: #1A1330;
      font-family: "Source Sans 3", ui-sans-serif, system-ui, sans-serif;
      color: ${BRAND.ink};
      line-height: 1.55;
      font-size: 15px;
      font-weight: 400;
      font-synthesis: none;
      -webkit-font-smoothing: antialiased;
    }
    .aiq-pdf-render-root { width: ${PAGE_WIDTH}px; }
    .page {
      width: ${PAGE_WIDTH}px;
      min-height: ${PAGE_HEIGHT}px;
      background-color: ${BRAND.paper};
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .page-inner { padding: 56px 64px; flex: 1 1 auto; }
    h1, h2, h3, h4 { font-family: Poppins, Inter, Arial, system-ui, sans-serif; margin: 0; letter-spacing: -0.02em; }
    h1 { font-size: 56px; line-height: 1.02; font-weight: 700; }
    h2 { font-size: 38px; line-height: 1.08; font-weight: 700; }
    h3 { font-size: 22px; line-height: 1.2; font-weight: 600; }
    h4 { font-size: 14px; line-height: 1.25; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
    p { margin: 0 0 14px; }
    .emph { color: ${BRAND.purple}; font-weight: 300; }
    .emph-light { color: ${BRAND.purpleXLight}; font-weight: 300; }
    .pageheader, .pagefooter {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 64px;
      font-size: 11px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: ${BRAND.muted};
      font-weight: 600;
    }
    .pageheader {
      border-style: solid;
      border-width: 0 0 1px 0;
      border-color: ${BRAND.rule};
    }
    .pagefooter {
      border-style: solid;
      border-width: 1px 0 0 0;
      border-color: ${BRAND.rule};
    }
    .logo { display: inline-flex; align-items: center; gap: 8px; line-height: 1; color: ${BRAND.ink}; overflow: visible; }
    .logo svg { display: block; width: 108px; height: auto; position: relative; top: 3px; overflow: visible; }
    .logo-inform { font-size: 11px; font-weight: 800; letter-spacing: 0.25em; color: ${BRAND.ink}; position: relative; top: 1px; }
    .cover { background-color: ${BRAND.ink}; color: ${BRAND.paper}; padding: 0; }
    .cover-mesh {
      position: absolute; top: 0; right: 0; bottom: 0; left: 0;
      background:
        radial-gradient(ellipse 80% 50% at 100% 0%, rgba(229,86,57,0.18), transparent 60%),
        radial-gradient(ellipse 70% 50% at 0% 100%, rgba(41,54,204,0.22), transparent 60%),
        radial-gradient(ellipse 60% 40% at 80% 80%, rgba(229,161,23,0.10), transparent 70%),
        radial-gradient(ellipse 80% 60% at 50% 50%, rgba(64,0,143,0.25), transparent 70%);
    }
    .cover-grid {
      position: absolute; top: 0; right: 0; bottom: 0; left: 0;
      background-image:
        linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
      background-size: 60px 60px;
    }
    .cover-content { position: relative; padding: 56px 64px; min-height: ${PAGE_HEIGHT}px; display: flex; flex-direction: column; }
    .cover-top { display: flex; justify-content: space-between; align-items: flex-start; }
    .cover-brand { width: 160px; line-height: 0; }
    .cover-brand svg { display: block; width: 100%; height: auto; }
    .cover-meta { text-align: right; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,0.65); line-height: 1.8; font-weight: 600; }
    .cover-middle { flex: 1 1 auto; display: flex; flex-direction: column; justify-content: center; padding: 80px 0; }
    .cover-eyebrow { font-size: 12px; letter-spacing: 0.3em; text-transform: uppercase; color: rgba(255,255,255,0.65); margin-bottom: 28px; font-weight: 600; }
    .cover-title { color: ${BRAND.paper}; font-size: 56px; line-height: 1.02; font-weight: 800; margin-bottom: 28px; letter-spacing: -0.035em; }
    .section-eyebrow {
      font-size: 11px; letter-spacing: 0.25em; text-transform: uppercase;
      color: ${BRAND.muted}; font-weight: 600; margin-bottom: 12px;
      display: flex; align-items: center; gap: 12px;
    }
    .section-eyebrow::after { content: ''; flex: 1 1 auto; height: 1px; background-color: ${BRAND.rule}; }
    .score-hero {
      display: grid; grid-template-columns: 280px 1fr; gap: 40px; align-items: stretch;
      margin: 32px 0; padding: 32px;
      background-color: ${BRAND.ink}; color: ${BRAND.paper};
      position: relative;
    }
    .score-hero::before {
      content: ''; position: absolute; top: 0; right: 0; left: 0; height: 4px;
      background: linear-gradient(90deg, ${BRAND.cti} 0% 25%, ${BRAND.dm} 25% 50%, ${BRAND.te} 50% 75%, ${BRAND.ctem} 75% 100%);
    }
    .overall-score-block { position: relative; min-height: 230px; }
    .overall-score-num { position: absolute; top: 18px; left: 0; font-size: 104px; line-height: 1; font-weight: 800; letter-spacing: -0.04em; }
    .overall-score-num .dot { font-weight: 200; color: ${BRAND.purpleXLight}; }
    .overall-score-label { position: absolute; top: 140px; left: 0; font-size: 11px; letter-spacing: 0.24em; text-transform: uppercase; color: ${BRAND.purpleXLight}; font-weight: 600; white-space: nowrap; }
    .overall-score-name { position: absolute; top: 174px; left: 0; font-size: 26px; font-weight: 600; }
    .dim-bars { display: flex; flex-direction: column; justify-content: center; gap: 14px; }
    .dim-bar { display: grid; grid-template-columns: 70px 1fr 34px; gap: 14px; align-items: center; }
    .dim-bar .name { font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 700; }
    .dim-bar .track { height: 8px; background-color: rgba(255,255,255,0.12); position: relative; }
    .dim-bar .fill { height: 100%; }
    .dim-bar .num { font-size: 24px; font-weight: 700; text-align: right; }
    .dim-legend { font-size: 10px; color: rgba(255,255,255,0.6); letter-spacing: 0.12em; text-transform: uppercase; padding-top: 8px; border-style: solid; border-width: 1px 0 0 0; border-color: rgba(255,255,255,0.15); margin-top: 4px; font-weight: 600; }
    .scale-strip { display: grid; grid-template-columns: repeat(5, 1fr); margin: 18px 0 0; border-style: solid; border-width: 1px; border-color: ${BRAND.rule}; }
    .scale-step { padding: 14px 16px; border-style: solid; border-width: 0 1px 0 0; border-color: ${BRAND.rule}; background-color: ${BRAND.paper}; position: relative; }
    .scale-step:last-child { border-right-width: 0; }
    .scale-step.you { background-color: ${BRAND.purple}; color: ${BRAND.paper}; }
    .scale-step .num-row { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 4px; }
    .scale-step .num { font-size: 28px; font-weight: 800; line-height: 1; color: ${BRAND.purple}; }
    .scale-step.you .num { color: ${BRAND.paper}; }
    .scale-step .name { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; font-weight: 700; color: ${BRAND.ink}; }
    .scale-step.you .name { color: ${BRAND.paper}; }
    .scale-step .desc { font-size: 11.5px; color: ${BRAND.muted}; line-height: 1.4; margin-top: 6px; }
    .scale-step.you .desc { color: rgba(255,255,255,0.85); }
    .you-tag { font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 700; margin-top: 8px; display: inline-block; padding: 2px 6px; background-color: rgba(255,255,255,0.2); border-radius: 3px; }
    .profile-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 24px 0; }
    .profile-cell { padding: 20px; border-style: solid; border-width: 1px; border-color: ${BRAND.rule}; background-color: ${BRAND.paper}; min-height: 120px; }
    .profile-cell .lbl { font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; color: ${BRAND.muted}; font-weight: 700; margin-bottom: 8px; }
    .profile-cell .val { font-size: 20px; font-weight: 700; letter-spacing: -0.01em; line-height: 1.25; }
    .dim-detail { margin: 28px 0; break-inside: avoid; page-break-inside: avoid; }
    .dim-detail-header {
      display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 24px; align-items: center;
      padding: 0 0 14px; margin-bottom: 18px;
      border-style: solid;
      border-width: 0 0 2px 0;
      border-color: var(--section-color);
    }
    .dim-detail-header h3 { font-size: 24px; font-weight: 700; letter-spacing: 0; overflow-wrap: anywhere; }
    .dim-detail-header .weight { font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; color: ${BRAND.muted}; margin-top: 4px; font-weight: 600; }
    .dim-detail-header .score-num { font-size: 34px; font-weight: 700; line-height: 1; }
    .components { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; }
    .comp { display: grid; grid-template-columns: 60px minmax(0, 1fr) auto; gap: 14px; padding: 12px 14px; background-color: ${BRAND.paper}; border-style: solid; border-width: 1px; border-color: ${BRAND.rule}; align-items: center; min-height: 54px; }
    .comp .id, .rec-id, .pill { font-family: "Source Sans 3", ui-sans-serif, system-ui, sans-serif; }
    .comp .id { font-size: 11px; color: ${BRAND.muted}; font-weight: 500; }
    .comp .name { font-size: 13px; font-weight: 500; line-height: 1.25; }
    .level { font-size: 9.5px; letter-spacing: 0.15em; text-transform: uppercase; font-weight: 700; padding: 4px 10px; border-radius: 999px; text-align: center; white-space: nowrap; }
    .level.l1 { background-color: rgba(229,86,57,0.12); color: #E55639; }
    .level.l2 { background-color: rgba(229,161,23,0.15); color: #7F3B00; }
    .level.l3 { background-color: rgba(64,0,143,0.10); color: ${BRAND.purple}; }
    .level.l4 { background-color: rgba(46,166,108,0.15); color: ${BRAND.good}; }
    .level.l5 { background-color: ${BRAND.good}; color: white; }
    .level.na { background-color: rgba(0,0,41,0.08); color: ${BRAND.muted}; }
    .radar-wrap, .matrix-wrap { margin: 28px 0; padding: 32px; background-color: ${BRAND.paper2}; }
    .chart-img { display: block; margin: 0 auto; width: 100%; max-width: 560px; }
    .matrix { display: grid; grid-template-columns: 90px 1fr 1fr 1fr; grid-template-rows: min-content repeat(3, auto); gap: 4px; margin: 24px 0; }
    .matrix-cell { padding: 16px 14px; background-color: ${BRAND.paper}; min-height: 110px; position: relative; }
    .matrix-cell.matrix-corner, .matrix-cell.col-head, .matrix-cell.row-head { background-color: transparent; min-height: 0; padding: 8px 12px; }
    .matrix-cell.col-head { font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; font-weight: 700; color: ${BRAND.ink}; text-align: center; }
    .matrix-cell.row-head { font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; font-weight: 700; color: ${BRAND.ink}; align-self: center; }
    .matrix-cell.hot { background-color: rgba(229,86,57,0.06); border-style: solid; border-width: 1px; border-color: rgba(229,86,57,0.25); }
    .matrix-cell.warm { background-color: rgba(229,161,23,0.06); border-style: solid; border-width: 1px; border-color: rgba(229,161,23,0.3); }
    .matrix-cell.cool { background-color: rgba(41,54,204,0.06); border-style: solid; border-width: 1px; border-color: rgba(41,54,204,0.2); }
    .pill { display: inline-block; font-size: 10px; font-weight: 600; padding: 3px 8px; border-width: 1px; margin: 2px; border-radius: 2px; }
    .matrix-legend { display: flex; gap: 18px; font-size: 12px; color: ${BRAND.muted}; margin-top: 12px; flex-wrap: wrap; font-weight: 500; align-items: center; }
    .swatch { display: inline-block; width: 14px; height: 14px; vertical-align: middle; margin-right: 6px; border-style: dashed; border-width: 1px; border-color: rgba(0,0,41,0.3); }
    .swatch.filled { background-color: #36bae4; border-style: solid; border-color: #2a9bbf; }
    .swatch.selected { background-color: #d6f0fa; border-style: solid; border-color: #2a9bbf; }
    .rec-list { display: flex; flex-direction: column; gap: 0; margin: 24px 0; }
    .rec { display: grid; grid-template-columns: 60px minmax(0, 1fr); gap: 24px; padding: 22px 0; border-style: solid; border-width: 0 0 1px 0; border-color: ${BRAND.rule}; }
    .rec:first-child { border-top-width: 1px; }
    .rec-num { font-size: 44px; font-weight: 800; color: ${BRAND.purple}; line-height: 0.9; letter-spacing: -0.04em; }
    .rec-id { font-size: 11px; color: ${BRAND.muted}; margin-bottom: 4px; font-weight: 500; }
    .rec-title { font-size: 22px; font-weight: 700; margin-bottom: 8px; letter-spacing: -0.01em; }
    .rec-meta-line { font-size: 13px; color: ${BRAND.ink}; margin-bottom: 4px; }
    .rec-meta-line .lbl { color: ${BRAND.muted}; font-weight: 600; }
    .rec-desc { font-size: 13px; margin: 12px 0; line-height: 1.55; }
    .rec-steps-head { font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 700; color: ${BRAND.ink}; margin: 14px 0 6px; }
    .rec-steps { margin: 0; padding: 0; list-style: none; }
    .rec-steps li { font-size: 13px; padding: 6px 0 6px 22px; position: relative; line-height: 1.55; }
    .rec-steps li::before { content: '→'; position: absolute; left: 0; color: ${BRAND.purple}; font-weight: 700; }
    .rec-steps li strong { font-weight: 700; }
    .dimension-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background-color: ${BRAND.rule}; margin: 28px 0; }
    .dim-card { background-color: ${BRAND.paper}; padding: 24px 18px; position: relative; }
    .dim-card::before { content: ''; position: absolute; top: 0; right: 0; left: 0; height: 4px; background-color: var(--accent); }
    .dim-card .tag { font-size: 10px; letter-spacing: 0.18em; font-weight: 700; text-transform: uppercase; color: ${BRAND.muted}; margin-bottom: 8px; }
    .dim-card h3 { font-size: 28px; margin-bottom: 12px; font-weight: 800; letter-spacing: -0.02em; color: var(--accent); }
    .dim-card p { font-size: 12px; line-height: 1.45; color: ${BRAND.ink}; margin: 0; }
    .cta { background-color: ${BRAND.ink}; color: ${BRAND.paper}; padding: 36px 40px; margin: 40px 0 0; position: relative; overflow: hidden; }
    .cta::before { content: ''; position: absolute; top: 0; right: 0; left: 0; height: 4px; background: linear-gradient(90deg, ${BRAND.cti} 0% 33%, ${BRAND.dm} 33% 66%, ${BRAND.te} 66% 100%); }
    .cta::after { content: ''; position: absolute; top: 0; right: 0; bottom: 0; left: 0; background: radial-gradient(ellipse 60% 80% at 100% 50%, rgba(64,0,143,0.35), transparent 60%); }
    .cta-content { position: relative; z-index: 1; }
    .cta-eyebrow { font-size: 11px; letter-spacing: 0.25em; text-transform: uppercase; color: ${BRAND.purpleLight}; font-weight: 700; margin-bottom: 14px; }
    .cta-title { font-size: 36px; font-weight: 800; margin: 0 0 16px; letter-spacing: -0.025em; line-height: 1.05; }
    .cta p { max-width: 580px; color: rgba(255,255,255,0.88); font-size: 14.5px; margin: 0 0 28px; line-height: 1.6; }
    .cta-contact { display: flex; gap: 48px; padding-top: 22px; border-style: solid; border-width: 1px 0 0 0; border-color: rgba(255,255,255,0.18); flex-wrap: wrap; }
    .cta-contact .lbl { display: block; font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase; color: rgba(255,255,255,0.55); font-weight: 700; margin-bottom: 4px; }
    .cta-contact .val { font-family: "Source Sans 3", ui-sans-serif, system-ui, sans-serif; font-size: 15px; font-weight: 500; color: ${BRAND.purpleXLight}; }
    `)}
  </style>
`;

const renderPage = ({ title, body }, index, total) => `
  <div class="page">
    <div class="pageheader">
      <span class="logo">${ATTACKIQ_INK_SVG}<span class="logo-inform">× INFORM</span></span>
      <span>${escapeHtml(title)}</span>
    </div>
    <div class="page-inner">${body}</div>
    <div class="pagefooter">
      <span>AttackIQ INFORM Assessment</span>
      <span>${String(index).padStart(2, '0')} / ${String(total).padStart(2, '0')}</span>
    </div>
  </div>
`;

const renderCover = (dateText) => `
  <div class="page cover">
    <div class="cover-mesh"></div>
    <div class="cover-grid"></div>
    <div class="cover-content">
      <div class="cover-top">
        <div class="cover-brand">${ATTACKIQ_WHITE_SVG}</div>
        <div class="cover-meta">${escapeHtml(dateText)}</div>
      </div>
      <div class="cover-middle">
        <div class="cover-eyebrow">MITRE INFORM Assessment</div>
        <h1 class="cover-title">Your threat-informed defense,<br><span class="emph-light">measured</span></h1>
      </div>
    </div>
  </div>
`;

const renderSummaryPage = (sections, overallLevel, overallLabel, calculateSectionScore) => {
    const levels = [
        { level: 1, name: 'Initial', desc: 'Ad hoc and reactive processes' },
        { level: 2, name: 'Developing', desc: 'Some repeatable practices exist' },
        { level: 3, name: 'Defined', desc: 'Documented and consistent processes' },
        { level: 4, name: 'Managed', desc: 'Measured and integrated practices' },
        { level: 5, name: 'Optimized', desc: 'Proactive and continuously refined' },
    ];

    const dimensionBars = sections
        .filter(section => section.scored !== false && section.section_id !== 'TP')
        .map((section) => {
            const meta = SECTION_META[section.section_id] || SECTION_META.CTI;
            const score = scoreForSection(section, calculateSectionScore);
            const width = Math.max(0, Math.min(100, (score / 5) * 100));
            return `
              <div class="dim-bar">
                <div class="name" style="color:${meta.lightColor};">${escapeHtml(meta.shortLabel)}</div>
                <div class="track"><div class="fill" style="width:${width}%; background:${meta.color};"></div></div>
                <div class="num">${score === -1 ? '—' : escapeHtml(score)}</div>
              </div>
            `;
        }).join('');

    const legend = sections
        .filter(section => section.scored !== false && SECTION_META[section.section_id])
        .map(section => `${SECTION_META[section.section_id].shortLabel} · ${SECTION_META[section.section_id].label}`)
        .join(' &nbsp;·&nbsp; ');

    return {
        title: 'Assessment Summary',
        body: `
          <div class="section-eyebrow">Your Assessment Results</div>
          <h2>Overall maturity &amp; <span class="emph">dimension scores</span></h2>
          <p style="max-width:720px; margin:18px 0 0;">
            This report presents the results of your INFORM security assessment. The framework evaluates
            threat-informed defense capabilities across the dimensions represented in your assessment.
            Each is scored on a 1–5 maturity scale.
          </p>
          <div class="score-hero">
            <div class="overall-score-block">
              <div class="overall-score-num">${escapeHtml(overallLevel || 0)}</div>
              <div class="overall-score-label">Overall Maturity</div>
              <div class="overall-score-name">${escapeHtml(overallLabel || getScoreLabel(overallLevel))}</div>
            </div>
            <div class="dim-bars">
              ${dimensionBars}
              <div class="dim-legend">${legend}</div>
            </div>
          </div>
          <h4 style="margin-top:28px;">Maturity Level Scale</h4>
          <div class="scale-strip">
            ${levels.map(level => `
              <div class="scale-step ${level.level === overallLevel ? 'you' : ''}">
                <div class="num-row"><span class="num">${level.level}</span><span class="name">${escapeHtml(level.name)}</span></div>
                <div class="desc">${escapeHtml(level.desc)}</div>
                ${level.level === overallLevel ? '<span class="you-tag">You are here</span>' : ''}
              </div>
            `).join('')}
          </div>
        `,
    };
};

const renderThreatProfilePage = (sections, threatProfile) => {
    const tpSection = sections.find(section => section.section_id === 'TP');
    const cells = ['sector', 'region', 'revenueBand', 'headcountBand', 'regulatory', 'dataSensitivity']
        .map((field) => {
            const question = tpSection?.questions?.find(q => TP_FIELD_BY_QID[q.uid] === field);
            return `
              <div class="profile-cell">
                <div class="lbl">${escapeHtml(question ? `${question.uid} · ${question.heading}` : TP_LABELS[field])}</div>
                <div class="val">${escapeHtml(valueText(threatProfile[field]))}</div>
              </div>
            `;
        }).join('');

    return {
        title: 'Threat Profile',
        body: `
          <div class="section-eyebrow">Organization Information</div>
          <h2>Your <span class="emph">threat profile</span></h2>
          <div class="profile-grid">${cells}</div>
        `,
    };
};

const renderDetailPage = (sectionChunk, calculateSectionScore, pageIndex, totalDetailPages) => ({
    title: 'Detailed Score Breakdown',
    body: `
      <h2>Score by <span class="emph">component</span></h2>
      ${totalDetailPages > 1 ? `<p style="max-width:720px; margin:14px 0 0; color:${BRAND.muted};">Component breakdown ${pageIndex + 1} of ${totalDetailPages}.</p>` : ''}
      ${sectionChunk.map((section) => {
        const meta = SECTION_META[section.section_id] || { color: BRAND.purple, label: section.name, shortLabel: section.section_id };
        const score = scoreForSection(section, calculateSectionScore);
        const questions = (section.questions || []).map((q) => {
            const qScore = getQuestionScore(q);
            const label = q.isNotApplicable ? 'N/A' : getScoreLabel(qScore);
            return `
              <div class="comp">
                <span class="id">${escapeHtml(q.uid || q.componentKey)}</span>
                <span class="name">${escapeHtml(q.heading || q.questionText || '')}</span>
                <span class="level ${levelClass(qScore)}">${escapeHtml(label)}</span>
              </div>
            `;
        }).join('');
        return `
          <div class="dim-detail">
            <div class="dim-detail-header" style="--section-color:${meta.color};">
              <div>
                <h3 style="color:${meta.color};">${escapeHtml(section.shortname || meta.label || section.name)}</h3>
                <div class="weight">${section.questions?.length || 0} Components &nbsp;·&nbsp; Weight: ${escapeHtml(SECTION_WEIGHTS[section.section_id] || `${Math.round((section.section_weight || 0) * 100)}%`)}</div>
              </div>
              <div class="score-num" style="color:${meta.color};">${score === -1 ? 'N/A' : escapeHtml(score)}</div>
            </div>
            <div class="components">${questions}</div>
          </div>
        `;
      }).join('')}
    `,
});

const renderRadarPage = (radarDataUrl) => ({
    title: 'Visual Analysis',
    body: `
      <h2>Maturity <span class="emph">Radar</span></h2>
      <p style="max-width:720px; margin:18px 0 0;">
        Each spoke represents a single INFORM component. The further from center, the more mature.
        A well-rounded shape indicates a balanced program; deep notches indicate isolated gaps;
        a flat shape indicates broad immaturity.
      </p>
      <div class="radar-wrap">
        ${radarDataUrl
            ? `<img class="chart-img" src="${radarDataUrl}" alt="Maturity radar chart">`
            : `<p style="color:${BRAND.muted};">The maturity radar could not be captured from the current results view.</p>`}
      </div>
    `,
});

const renderMatrixPage = (results) => {
    const rows = [3, 2, 1];
    const cols = [1, 2, 3];
    const impactLabels = { 3: 'High', 2: 'Medium', 1: 'Low' };
    const complexityLabels = { 1: 'Low Complexity', 2: 'Medium Complexity', 3: 'High Complexity' };

    const cells = rows.map(row => `
      <div class="matrix-cell row-head">${impactLabels[row]}<br>Impact</div>
      ${cols.map((col) => {
        const key = `i-${row}_c-${col}`;
        const items = results.impactComplexityMap?.get?.(key) || [];
        const className = row === 3 && col === 1 ? 'hot' : row === 3 || col === 1 ? 'warm' : 'cool';
        return `
          <div class="matrix-cell ${className}">
            ${items.map((item) => {
                const displayKey = item.uid || item.componentKey || '';
                const hasCheck = item.selected && item.highestValue;
                return `<span class="pill" style="${matrixPillStyle(item)}">${hasCheck ? '✓ ' : ''}${escapeHtml(displayKey)}</span>`;
            }).join('')}
          </div>
        `;
      }).join('')}
    `).join('');

    return {
        title: 'Impact / Complexity Matrix',
        body: `
          <h2>Where to <span class="emph">start</span></h2>
          <p style="max-width:720px; margin:18px 0 0;">
            The Impact / Complexity matrix plots every unmet maturity level by how much it improves
            your overall score and how hard it is to achieve. <strong>Top-left wins.</strong>
            High-impact, low-complexity moves are the recommended starting points.
          </p>
          <div class="matrix">
            <div class="matrix-cell matrix-corner"></div>
            ${cols.map(col => `<div class="matrix-cell col-head">${complexityLabels[col]}</div>`).join('')}
            ${cells}
          </div>
          <div class="matrix-legend">
            <span><span class="swatch filled"></span>Highest selected level</span>
            <span><span class="swatch selected"></span>Selected level</span>
            <span><span class="swatch"></span>Available level</span>
          </div>
        `,
    };
};

const renderRecommendationPage = (groups, offset, totalRecommendations) => ({
    title: 'Recommendations & Next Steps',
    body: `
      <h2>What to do <span class="emph">next</span></h2>
      <p style="max-width:720px; margin:18px 0 0;">
        These recommendations come directly from the Impact / Complexity analysis. They are the
        highest-impact, lowest-complexity moves available given your current state.
      </p>
      <div class="rec-list">
        ${groups.length ? groups.map((group, idx) => {
            const cb = group.choiceBlock || {};
            const recNo = String(offset + idx + 1).padStart(2, '0');
            const titleParts = String(group.componentLabel || '').split(':');
            const recId = cb.choiceUid || titleParts[0] || '';
            const recTitle = titleParts.slice(1).join(':').trim() || group.componentLabel || 'Recommended action';
            return `
              <div class="rec">
                <div class="rec-num">${recNo}</div>
                <div>
                  <div class="rec-id">${escapeHtml(recId)}</div>
                  <div class="rec-title">${escapeHtml(recTitle)}</div>
                  ${cb.selectedLabel ? `<div class="rec-meta-line"><span class="lbl">Suggested level:</span> ${escapeHtml(cb.selectedLabel)}</div>` : ''}
                  ${cb.primaryOwner ? `<div class="rec-meta-line"><span class="lbl">Primary owner:</span> ${escapeHtml(cb.primaryOwner)}</div>` : ''}
                  ${cb.levelGoal ? `<p class="rec-desc">${escapeHtml(cb.levelGoal)}</p>` : ''}
                  ${Array.isArray(cb.recommendations) && cb.recommendations.length ? `
                    <div class="rec-steps-head">Next Steps</div>
                    <ul class="rec-steps">
                      ${cb.recommendations.map(line => `<li>${escapeHtml(line)}</li>`).join('')}
                    </ul>
                  ` : ''}
                </div>
              </div>
            `;
        }).join('') : `
          <div class="rec">
            <div class="rec-num">01</div>
            <div>
              <div class="rec-title">Complete the assessment to generate recommendations</div>
              <p class="rec-desc">Recommendations appear here once there are available maturity moves with supporting guidance.</p>
            </div>
          </div>
        `}
      </div>
      ${totalRecommendations > offset + groups.length ? `<p style="color:${BRAND.muted}; font-size:13px;">Continued on the next page.</p>` : ''}
    `,
});

const renderFinalPage = (sections) => {
    const scoredSections = sections.filter(section => section.scored !== false && SECTION_META[section.section_id]);
    const gridCols = scoredSections.length > 3 ? 4 : 3;

    return {
        title: 'About INFORM & Next Steps',
        body: `
          <h2>What this framework <span class="emph">measures</span></h2>
          <p style="max-width:720px; margin:18px 0 0;">
            MITRE INFORM is a maturity model from the MITRE Center for Threat-Informed Defense.
            It defines threat-informed defense as the systematic application of adversary tradecraft
            and technology understanding to improve defenses.
          </p>
          <div class="dimension-cards" style="grid-template-columns: repeat(${gridCols}, 1fr);">
            ${scoredSections.map((section) => {
                const meta = SECTION_META[section.section_id];
                return `
                  <div class="dim-card" style="--accent:${meta.color};">
                    <div class="tag">${escapeHtml(meta.label)}</div>
                    <h3>${escapeHtml(meta.shortLabel)}</h3>
                    <p>${escapeHtml(meta.description)}</p>
                  </div>
                `;
            }).join('')}
          </div>
          <div class="cta">
            <div class="cta-content">
              <div class="cta-eyebrow">Next Steps · AttackIQ Professional Services</div>
              <h3 class="cta-title">Take this <span class="emph-light">further</span></h3>
              <p>
                AttackIQ Professional Services facilitates INFORM tabletops, builds tailored threat-informed
                defense roadmaps, and partners with security leaders on the journey from assessment to sustained maturity.
              </p>
              <div class="cta-contact">
                <div class="item">
                  <span class="lbl">Email</span>
                  <span class="val">pro-serve@attackiq.com</span>
                </div>
                <div class="item">
                  <span class="lbl">Web</span>
                  <span class="val">attackiq.com/services/threat-inform</span>
                </div>
              </div>
            </div>
          </div>
        `,
    };
};

const captureCurrentRadar = () => {
    try {
        const radarCanvas = document.querySelector('#aiq-radar-chart-container canvas');
        return radarCanvas ? radarCanvas.toDataURL('image/png') : null;
    } catch (e) {
        console.warn('Could not capture radar chart:', e);
        return null;
    }
};

export const buildReportHtml = ({
    results,
    overallLevel,
    overallLabel,
    calculateSectionScore,
    recommendationGroups,
    threatProfile,
    radarDataUrl = captureCurrentRadar(),
    generatedDate = new Date(),
}) => {
    const sections = results.scoresBySection || [];
    const scoredSections = sections.filter(section => section.section_id !== 'TP' && section.scored !== false);
    const detailChunks = chunkDetailSections(scoredSections);
    const recommendationChunks = splitRecommendations(recommendationGroups);
    const today = generatedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const contentPages = [
        renderSummaryPage(sections, overallLevel, overallLabel, calculateSectionScore),
        renderThreatProfilePage(sections, threatProfile),
        ...detailChunks.map((chunk, idx) => renderDetailPage(chunk, calculateSectionScore, idx, detailChunks.length)),
        renderRadarPage(radarDataUrl),
        renderMatrixPage(results),
        ...recommendationChunks.map((chunk, idx) => renderRecommendationPage(chunk, idx * 2, recommendationGroups.length)),
        renderFinalPage(sections),
    ];

    const total = contentPages.length;
    return `
      ${renderStyles()}
      <div class="aiq-pdf-render-root">
        ${renderCover(today)}
        ${contentPages.map((page, idx) => renderPage(page, idx + 1, total)).join('')}
      </div>
    `;
};

export const generatePDF = async (elementId, filename = 'AttackIQ-INFORM-Assessment-Report.pdf', scores = {}) => {
    const {
        results,
        overallLevel,
        overallLabel,
        calculateSectionScore,
        recommendationGroups = [],
        threatProfile = {},
    } = scores;

    if (!results || !results.scoresBySection) {
        console.error('No results data provided for PDF generation');
        return false;
    }

    const previewWindow = window.open('', '_blank');
    if (previewWindow) {
        previewWindow.document.write('<!doctype html><title>Generating PDF...</title><body style="margin:0;font-family:system-ui,sans-serif;background:#000029;color:#fff;display:grid;place-items:center;min-height:100vh;"><div>Generating PDF...</div></body>');
        previewWindow.document.close();
    }

    const renderRoot = document.createElement('div');
    renderRoot.style.position = 'fixed';
    renderRoot.style.left = '-10000px';
    renderRoot.style.top = '0';
    renderRoot.style.width = `${PAGE_WIDTH}px`;
    renderRoot.style.height = `${PAGE_HEIGHT}px`;
    renderRoot.style.pointerEvents = 'none';
    renderRoot.innerHTML = buildReportHtml({
        results,
        overallLevel,
        overallLabel,
        calculateSectionScore,
        recommendationGroups,
        threatProfile,
    });

    document.body.appendChild(renderRoot);

    try {
        updatePreviewWindow(previewWindow, 'Preparing report layout...');
        await waitForFrame();

        const reportRoot = renderRoot.querySelector('.aiq-pdf-render-root');
        if (!reportRoot) {
            throw new Error('PDF render root was not created');
        }

        if (document.fonts?.ready) {
            updatePreviewWindow(previewWindow, 'Loading report fonts...');
            await withTimeout(Promise.all([
                document.fonts.load('700 38px Poppins'),
                document.fonts.load('800 56px Poppins'),
                document.fonts.load('400 15px "Source Sans 3"'),
                document.fonts.load('600 15px "Source Sans 3"'),
                document.fonts.load('700 15px "Source Sans 3"'),
            ]), 4000, 'PDF font loading').catch((fontError) => {
                console.warn('PDF fonts did not finish loading; using available browser fonts.', fontError);
            });
            await withTimeout(document.fonts.ready, 4000, 'PDF font readiness').catch((fontError) => {
                console.warn('PDF fonts were not ready in time; continuing.', fontError);
            });
        }

        const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: [PAGE_WIDTH, PAGE_HEIGHT] });
        const pages = Array.from(reportRoot.querySelectorAll('.page'));

        for (let i = 0; i < pages.length; i++) {
            updatePreviewWindow(previewWindow, `Rendering page ${i + 1} of ${pages.length}...`);
            await waitForFrame();
            const canvas = await withTimeout(html2canvas(pages[i], {
                scale: 1.5,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
                width: PAGE_WIDTH,
                height: PAGE_HEIGHT,
                windowWidth: PAGE_WIDTH,
                windowHeight: PAGE_HEIGHT,
            }), 20000, `Rendering PDF page ${i + 1}`);

            if (i > 0) pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT], 'portrait');
            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, PAGE_WIDTH, PAGE_HEIGHT);
        }

        updatePreviewWindow(previewWindow, 'Opening PDF...');
        const pdfBlob = pdf.output('blob');
        const pdfUrl = URL.createObjectURL(pdfBlob);

        if (previewWindow && !previewWindow.closed) {
            previewWindow.location.href = pdfUrl;
        } else {
            window.location.href = pdfUrl;
        }

        setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000);
        return true;
    } catch (error) {
        console.error('Error generating PDF:', error);
        updatePreviewWindow(previewWindow, `PDF generation failed: ${error.message}`);
        return false;
    } finally {
        renderRoot.remove();
    }
};

export default generatePDF;
