

const TP_QUESTION_TO_FIELD = {
    'TP.1': 'sector',
    'TP.2': 'region',
    'TP.3': 'revenueBand',
    'TP.4': 'headcountBand',
    'TP.5': 'regulatory',
    'TP.6': 'dataSensitivity',
};

const findSection = (results, id) =>
    results?.scoresBySection?.find(s => s.section_id === id);

const findTpSection = (data) =>
    Array.isArray(data)
        ? data.find(s => s && s.section_id === 'TP' && Array.isArray(s.questions))
        : null;

const lookupChoiceText = (tpSection, qid, idx) => {
    if (!tpSection) return null;
    const q = tpSection.questions.find(q => q.uid === qid);
    if (!q || !Array.isArray(q.choices)) return null;
    const choice = q.choices[idx];
    return choice ? (choice.text || choice.description || null) : null;
};

export const buildThreatProfile = (data, answers) => {
    const tpSection = findTpSection(data);
    if (!tpSection) return {};

    const out = {};
    Object.entries(TP_QUESTION_TO_FIELD).forEach(([qid, field]) => {
        const ans = answers[qid];
        if (!Array.isArray(ans) || ans.length === 0) return;

        if (field === 'regulatory' || field === 'dataSensitivity') {

            const values = ans
                .map(idx => lookupChoiceText(tpSection, qid, idx))
                .filter(Boolean);
            if (values.length) out[field] = values;
        } else {
            const value = lookupChoiceText(tpSection, qid, ans[0]);
            if (value) out[field] = value;
        }
    });
    return out;
};

export const submitResults = async (answers, result, context = {}) => {
    const config = window.aiqInformData || {};
    const restBase = config.rest_url || '/wp-json/aiq/v1/';
    const endpoint = `${restBase.replace(/\/$/, '')}/submit`;

    const lead = context.lead || {};
    const data = context.data || null;
    const ctemSkipped = Boolean(context.ctemSkipped);

    const ctiSection  = findSection(result, 'CTI');
    const dmSection   = findSection(result, 'DM');
    const teSection   = findSection(result, 'TE');
    const ctemSection = findSection(result, 'CTEM');

    const threatProfile = data ? buildThreatProfile(data, answers) : {};

    const payload = {
        answers,
        email: lead.email || null,
        lead: {
            email:     lead.email     || null,
            firstName: lead.firstName || null,
            lastName:  lead.lastName  || null,
            company:   lead.company   || null,
        },
        threatProfile,
        recommendations: context.recommendations || null,
        result: {
            overallScore:   result?.overallScore ?? null,
            ctiScore:       ctiSection  ? ctiSection.totalPoints  : null,
            dmScore:        dmSection   ? dmSection.totalPoints   : null,
            teScore:        teSection   ? teSection.totalPoints   : null,
            ctemScore:      ctemSection ? ctemSection.totalPoints : null,
            ctemSkipped,
            maturityLevel:  context.maturityLevel ?? null,
            sectionScores:  (result?.scoresBySection || []).map(s => ({
                id:    s.section_id,
                score: s.totalPoints,
            })),
        },
    };

    try {
        const headers = { 'Content-Type': 'application/json' };
        if (config.nonce) headers['X-WP-Nonce'] = config.nonce;

        const response = await fetch(endpoint, {
            method: 'POST',
            credentials: 'same-origin',
            headers,
            body: JSON.stringify(payload),
        });

        const body = await response.json();
        return body.success === true;
    } catch (err) {
        console.error('Submission Error:', err);
        return false;
    }
};
