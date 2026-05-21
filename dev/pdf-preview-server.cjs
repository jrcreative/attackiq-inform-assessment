#!/usr/bin/env node

const fs = require('fs');
const http = require('http');
const path = require('path');
const url = require('url');

const rootDir = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 3027);
const host = process.env.HOST || '127.0.0.1';
const clients = new Set();

const pdfGeneratorPath = path.join(rootDir, 'src/utils/pdfGenerator.js');

const send = (res, status, body, type = 'text/html; charset=utf-8') => {
    res.writeHead(status, {
        'Content-Type': type,
        'Cache-Control': 'no-store',
    });
    res.end(body);
};

const readPdfPreviewModule = () => {
    let source = fs.readFileSync(pdfGeneratorPath, 'utf8');
    source = source
        .replace(/import html2canvas from 'html2canvas';\n/, '')
        .replace(/import jsPDF from 'jspdf';\n/, '')
        .replace(/import \{ getScoreLabel \} from '\.\/scoring';\n/, `
const getScoreLabel = (level) => {
    switch (level) {
        case -1: return 'N/A';
        case 0: return 'None';
        case 1: return 'Initial';
        case 2: return 'Developing';
        case 3: return 'Defined';
        case 4: return 'Managed';
        case 5: return 'Optimized';
        default: return '';
    }
};
`)
        .replace(/export const generatePDF = async /, 'const generatePDF = async ')
        .replace(/\nexport default generatePDF;\s*$/, '\n');

    return `${source}
export { PAGE_WIDTH, PAGE_HEIGHT };
`;
};

const previewHtml = () => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>INFORM PDF Preview</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@200;300;400;500;600;700;800&family=Source+Sans+3:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body { margin: 0; background: #1A1330; }
    .devbar {
      position: sticky;
      top: 0;
      z-index: 9999;
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: center;
      padding: 10px 18px;
      background: #FAECD1;
      color: #7F3B00;
      border-bottom: 1px dashed #E5A117;
      font: 500 13px/1.4 "Source Sans 3", ui-sans-serif, system-ui, sans-serif;
    }
    .devbar code { font-family: "Source Sans 3", ui-sans-serif, system-ui, sans-serif; font-size: 12px; }
    #preview {
      width: 880px;
      margin: 24px auto 48px;
      box-shadow: 0 30px 80px rgba(0,0,0,0.4);
    }
    #preview .page { margin-bottom: 28px; box-shadow: 0 30px 80px rgba(0,0,0,0.4); }
  </style>
</head>
<body>
  <div class="devbar">
    <div><strong>PDF HTML Preview</strong> · edit <code>src/utils/pdfGenerator.js</code>; this page reloads automatically.</div>
    <div><code>npm run dev:pdf</code></div>
  </div>
  <main id="preview"></main>
  <script type="module" src="/preview.js"></script>
</body>
</html>`;

const previewJs = () => `
import { buildReportHtml } from '/pdfGenerator.preview.js';

const makeQuestion = (sectionId, n, heading, level, impact = 2, complexity = 2) => {
    const possiblePoints = 5;
    return {
        uid: \`\${sectionId}.\${n}\`,
        componentKey: \`\${sectionId}.\${n}\`,
        section_id: sectionId,
        heading,
        questionText: heading,
        totalPoints: level < 0 ? -1 : level,
        possiblePoints,
        isNotApplicable: level < 0,
        hasAnswer: level > 0,
        choices: [],
        impact,
        complexity,
    };
};

const sections = [
    {
        section_id: 'TP',
        name: 'Threat Profile',
        shortname: 'Threat Profile',
        scored: false,
        questions: [
            { uid: 'TP.1', heading: 'Sector' },
            { uid: 'TP.2', heading: 'Region' },
            { uid: 'TP.3', heading: 'Annual Revenue' },
            { uid: 'TP.4', heading: 'Employee Headcount' },
            { uid: 'TP.5', heading: 'Regulatory Environment' },
            { uid: 'TP.6', heading: 'Data Sensitivity' },
        ],
    },
    {
        section_id: 'CTI',
        name: 'Cyber Threat Intelligence',
        shortname: 'Cyber Threat Intelligence',
        section_weight: 0.28,
        scored: true,
        questions: [
            makeQuestion('CTI', 1, 'Depth of Threat Intelligence', 3, 3, 1),
            makeQuestion('CTI', 2, 'Relevance of Threat Intelligence', 4, 3, 2),
            makeQuestion('CTI', 3, 'Operational Integration of CTI', 4, 3, 3),
            makeQuestion('CTI', 4, 'Incorporation of CTI', 1, 2, 1),
            makeQuestion('CTI', 5, 'Recency of CTI', 2, 2, 1),
            makeQuestion('CTI', 6, 'Speed of CTI Dissemination', 1, 2, 2),
            makeQuestion('CTI', 7, 'CTI-Driven Decision Making', 1, 1, 1),
        ],
    },
    {
        section_id: 'DM',
        name: 'Defensive Measures',
        shortname: 'Defensive Measures',
        section_weight: 0.32,
        scored: true,
        questions: [
            makeQuestion('DM', 1, 'Data Collection', 4, 3, 2),
            makeQuestion('DM', 2, 'Risk Assessments', 3, 3, 3),
            makeQuestion('DM', 3, 'Attack Surface Scoping', 2, 3, 3),
            makeQuestion('DM', 4, 'Detection Rules', 2, 3, 2),
            makeQuestion('DM', 5, 'Detection Rule Metadata', 3, 2, 2),
            makeQuestion('DM', 6, 'Propagation: CTI to Detections', 1, 2, 2),
            makeQuestion('DM', 7, 'Incident Response', 4, 3, 2),
            makeQuestion('DM', 8, 'Incident Recovery and Forensics', 2, 3, 1),
            makeQuestion('DM', 9, 'Threat Hunting', 1, 3, 1),
            makeQuestion('DM', 10, 'Deception', -1, 1, 3),
        ],
    },
    {
        section_id: 'TE',
        name: 'Test & Evaluation',
        shortname: 'Test & Evaluation',
        section_weight: 0.2,
        scored: true,
        questions: [
            makeQuestion('TE', 1, 'Test Focus', 3, 2, 3),
            makeQuestion('TE', 2, 'Test Planning', 2, 2, 2),
            makeQuestion('TE', 3, 'Test Relevance', 1, 1, 1),
            makeQuestion('TE', 4, 'Test Triggers', 2, 3, 3),
            makeQuestion('TE', 5, 'Test Results', 1, 2, 1),
        ],
    },
    {
        section_id: 'CTEM',
        name: 'Continuous Threat Exposure Management',
        shortname: 'CTEM',
        section_weight: 0.2,
        scored: true,
        questions: [
            makeQuestion('CTEM', 1, 'Exposure Discovery', 2, 3, 1),
            makeQuestion('CTEM', 2, 'Exposure Prioritization', 2, 3, 2),
            makeQuestion('CTEM', 3, 'Validation Cadence', 1, 2, 2),
            makeQuestion('CTEM', 4, 'Mobilization', 1, 2, 3),
        ],
    },
];

const impactComplexityMap = new Map();
const addMatrix = (impact, complexity, uid, heading, selected = false) => {
    const key = \`i-\${impact}_c-\${complexity}\`;
    const list = impactComplexityMap.get(key) || [];
    list.push({ uid, componentKey: uid, heading, impact, complexity, selected });
    impactComplexityMap.set(key, list);
};

[
    [3, 1, 'CTI.1.1', 'Depth of Threat Intelligence'],
    [3, 1, 'CTI.5.4', 'Recency of CTI'],
    [3, 1, 'DM.8.3', 'Incident Recovery and Forensics'],
    [3, 1, 'DM.9.3', 'Threat Hunting'],
    [3, 2, 'DM.1.3', 'Data Collection'],
    [3, 2, 'DM.4.3', 'Detection Rules'],
    [3, 3, 'TE.4', 'Test Triggers'],
    [2, 1, 'CTI.6', 'Speed of CTI Dissemination'],
    [2, 2, 'DM.5', 'Detection Rule Metadata'],
    [2, 3, 'TE.1', 'Test Focus'],
    [1, 1, 'CTI.7', 'CTI-Driven Decision Making'],
    [1, 1, 'TE.3', 'Test Relevance'],
].forEach(([impact, complexity, uid, heading]) => addMatrix(impact, complexity, uid, heading));

const recommendationGroups = [
    {
        componentLabel: 'CTI.1.1: Depth of Threat Intelligence',
        sectionId: 'CTI',
        impact: 3,
        complexity: 1,
        choiceBlock: {
            choiceUid: 'CTI.1.1',
            selectedLabel: 'Ephemeral IOCs',
            primaryOwner: 'CTI Lead',
            levelGoal: 'Establish automated IOC collection and triage. The organization moves from no indicator tracking to a functional ingestion pipeline with clear triage criteria.',
            recommendations: [
                'Automate IOC ingestion: Connect your SIEM/SOAR to curated threat feeds.',
                'Establish IOC triage criteria: Define which indicators trigger blocks, alerts, or discard workflows.',
            ],
        },
    },
    {
        componentLabel: 'CTI.5.4: Recency of CTI',
        sectionId: 'CTI',
        impact: 3,
        complexity: 1,
        choiceBlock: {
            choiceUid: 'CTI.5.4',
            selectedLabel: 'Within the past week',
            primaryOwner: 'CTI Lead',
            levelGoal: 'Achieve weekly-or-better recency for priority intelligence, with staleness measured against operational response lag.',
            recommendations: [
                'Build a tiered recency model for tactical and strategic intelligence.',
                'Review source ROI semi-annually and replace underperforming sources.',
            ],
        },
    },
    {
        componentLabel: 'DM.8.3: Incident Recovery and Forensics',
        sectionId: 'DM',
        impact: 3,
        complexity: 1,
        choiceBlock: {
            choiceUid: 'DM.8.3',
            selectedLabel: 'Threat intelligence feeds are used to link forensic findings to threat actors/groups',
            primaryOwner: 'SOC Director / CTI Lead',
            levelGoal: 'Establish CTI-integrated forensics that feeds intelligence back into the CTI program.',
            recommendations: [
                'Include a CTI correlation step in every forensic investigation.',
                'Build a structured forensic findings repository.',
            ],
        },
    },
    {
        componentLabel: 'DM.9.3: Threat Hunting',
        sectionId: 'DM',
        impact: 3,
        complexity: 1,
        choiceBlock: {
            choiceUid: 'DM.9.3',
            selectedLabel: 'Formal threat hunts are proactively conducted based on likely adversary behaviors',
            primaryOwner: 'CTI Lead / SOC Director',
            levelGoal: 'Establish proactive, behavioral hunting on a defined regular schedule.',
            recommendations: [
                'Schedule proactive hunts against priority threat actor behaviors.',
                'Track hunting coverage by ATT&CK technique.',
            ],
        },
    },
    {
        componentLabel: 'DM.1.3: Data Collection',
        sectionId: 'DM',
        impact: 3,
        complexity: 2,
        choiceBlock: {
            choiceUid: 'DM.1.3',
            selectedLabel: 'Logs are collected from multiple sensor types',
            primaryOwner: 'SOC Director',
            levelGoal: 'Achieve comprehensive multi-sensor coverage mapped to ATT&CK.',
            recommendations: [
                'Extend coverage to cloud, endpoint, network, identity, and OT/ICS.',
                'Automate sensor health monitoring and prioritize new sensors by CTI.',
            ],
        },
    },
];

const calculateSectionScore = (section) => {
    if (!section || section.scored === false) return -1;
    const applicable = (section.questions || []).filter(q => !q.isNotApplicable);
    if (!applicable.length) return -1;
    const ratio = applicable.reduce((sum, q) => sum + (q.totalPoints / q.possiblePoints), 0) / applicable.length;
    if (ratio <= 0) return 0;
    if (ratio <= 0.2) return 1;
    if (ratio <= 0.4) return 2;
    if (ratio <= 0.6) return 3;
    if (ratio <= 0.8) return 4;
    return 5;
};

const radarDataUrl = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(\`
<svg viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg">
  <rect width="500" height="500" fill="#F4F4F8"/>
  <g fill="none" stroke="rgba(0,0,41,0.14)" stroke-width="1">
    <circle cx="250" cy="250" r="40"/><circle cx="250" cy="250" r="80"/>
    <circle cx="250" cy="250" r="120"/><circle cx="250" cy="250" r="160"/><circle cx="250" cy="250" r="200"/>
  </g>
  <g stroke="rgba(0,0,41,0.12)">
    <line x1="250" y1="50" x2="250" y2="450"/><line x1="50" y1="250" x2="450" y2="250"/>
    <line x1="108" y1="108" x2="392" y2="392"/><line x1="392" y1="108" x2="108" y2="392"/>
  </g>
  <polygon points="250,92 324,127 379,203 360,264 318,315 279,338 240,350 205,326 181,307 160,279 139,250 131,221 145,188 166,158 190,130 220,110"
    fill="rgba(64,0,143,0.18)" stroke="#40008F" stroke-width="3"/>
  <circle cx="250" cy="250" r="4" fill="#40008F"/>
  <g font-family="Source Sans 3, Arial, sans-serif" font-size="12" font-weight="800" letter-spacing="2">
    <text x="250" y="36" text-anchor="middle" fill="#E5A117">CTI</text>
    <text x="456" y="354" text-anchor="middle" fill="#2936CC">DM</text>
    <text x="44" y="354" text-anchor="middle" fill="#E55639">TE</text>
  </g>
</svg>\`);

const results = { scoresBySection: sections, overallScore: 0.43, impactComplexityMap };
const html = buildReportHtml({
    results,
    overallLevel: 2,
    overallLabel: 'Developing',
    calculateSectionScore,
    recommendationGroups,
    threatProfile: {
        sector: 'Financial Services',
        region: 'North America',
        revenueBand: 'Over $10B',
        headcountBand: 'Over 50,000',
        regulatory: ['HIPAA', 'GDPR', 'PCI-DSS'],
        dataSensitivity: ['Payment / Financial Data', 'Intellectual Property'],
    },
    radarDataUrl,
    generatedDate: new Date('2026-05-15T12:00:00'),
});

document.getElementById('preview').innerHTML = html;

new EventSource('/events').addEventListener('reload', () => window.location.reload());
`;

const server = http.createServer((req, res) => {
    const pathname = url.parse(req.url).pathname;

    if (pathname === '/') {
        send(res, 200, previewHtml());
        return;
    }

    if (pathname === '/preview.js') {
        send(res, 200, previewJs(), 'application/javascript; charset=utf-8');
        return;
    }

    if (pathname === '/pdfGenerator.preview.js') {
        send(res, 200, readPdfPreviewModule(), 'application/javascript; charset=utf-8');
        return;
    }

    if (pathname === '/events') {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
        });
        res.write('\n');
        clients.add(res);
        req.on('close', () => clients.delete(res));
        return;
    }

    send(res, 404, 'Not found', 'text/plain; charset=utf-8');
});

const notifyReload = () => {
    for (const client of clients) {
        client.write('event: reload\ndata: changed\n\n');
    }
};

[pdfGeneratorPath, __filename].forEach((filePath) => {
    fs.watch(filePath, { persistent: true }, notifyReload);
});

server.listen(port, host, () => {
    console.log(`PDF HTML preview running at http://${host}:${port}`);
});
