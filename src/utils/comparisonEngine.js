

const MAX_FILES = 4;

const SECTION_FALLBACK_ORDER = ['CTI', 'DM', 'TE', 'CTEM', 'TP'];

const inferSectionId = (sectionName) => {
    if (!sectionName) return null;
    const n = String(sectionName).toLowerCase();
    if (n.includes('threat intelligence')) return 'CTI';
    if (n.includes('defensive')) return 'DM';
    if (n.includes('test') || n.includes('evaluation')) return 'TE';
    if (n.includes('continuous threat exposure') || n.includes('ctem')) return 'CTEM';
    if (n.includes('threat profile')) return 'TP';
    return null;
};

const normalizeSection = (section, fallbackId) => {
    if (!section || typeof section !== 'object') return null;
    const sectionId =
        section.section_id ||
        inferSectionId(section.shortname) ||
        inferSectionId(section.name) ||
        fallbackId;

    const totalPoints    = typeof section.totalPoints    === 'number' ? section.totalPoints    : null;
    const possiblePoints = typeof section.possiblePoints === 'number' ? section.possiblePoints : null;
    const overallScore   = typeof section.overallScore   === 'number' ? section.overallScore   : null;

    const questions = Array.isArray(section.questions)
        ? section.questions
            .map(q => {
                if (!q || !q.uid) return null;
                return {
                    uid: q.uid,
                    totalPoints:    typeof q.totalPoints    === 'number' ? q.totalPoints    : null,
                    possiblePoints: typeof q.possiblePoints === 'number' ? q.possiblePoints : null,
                    irrelevant:     Boolean(q.irrelevant),
                };
            })
            .filter(Boolean)
        : [];

    return {
        section_id: sectionId,
        name:       section.name      || section.shortname || sectionId,
        shortname:  section.shortname || section.name      || sectionId,
        totalPoints,
        possiblePoints,
        overallScore,
        ratio: (totalPoints != null && possiblePoints && possiblePoints > 0)
            ? totalPoints / possiblePoints
            : null,
        questions,
    };
};

const fromV1 = (raw) => {
    const out = {
        downloadedDate: raw.savedDate || raw.downloadedDate || null,
        sections: [],
    };

    const lookup = raw.results || {};
    const lookupBy = (...keys) => {
        for (const k of keys) {
            if (lookup[k] && typeof lookup[k] === 'object') return lookup[k];
        }
        return null;
    };

    const cti  = lookupBy('Cyber Threat Intelligence', 'CTI');
    const dm   = lookupBy('Defensive Measures',         'DM');
    const te   = lookupBy('Test & Evaluation',          'TE');

    out.sections.push({
        section_id: 'CTI',
        name: 'Cyber Threat Intelligence',
        totalPoints:    cti ? cti.rootScore : null,
        possiblePoints: 5,
    });
    out.sections.push({
        section_id: 'DM',
        name: 'Defensive Measures',
        totalPoints:    dm ? dm.rootScore : null,
        possiblePoints: 5,
    });
    out.sections.push({
        section_id: 'TE',
        name: 'Test & Evaluation',
        totalPoints:    te ? te.rootScore : null,
        possiblePoints: 5,
    });

    return out;
};

const padSections = (sections, expectedSectionIds) => {
    const present = new Set(sections.map(s => s.section_id).filter(Boolean));
    const padded  = sections.slice();
    for (const id of expectedSectionIds) {
        if (!present.has(id)) {
            padded.push({
                section_id: id,
                name: id,
                shortname: id,
                totalPoints: null,
                possiblePoints: null,
                overallScore: null,
                ratio: null,
                questions: [],
                missing: true,
            });
        }
    }
    return padded;
};

export const parseHistoricalFile = (jsonText, expectedSectionIds = SECTION_FALLBACK_ORDER) => {
    let raw;
    try {
        raw = JSON.parse(jsonText);
    } catch (err) {
        return { error: 'invalid_json' };
    }

    if (!raw || typeof raw !== 'object') {
        return { error: 'invalid_format' };
    }

    let envelope;
    if (raw.savedDate && raw.results && !raw.sections) {
        envelope = fromV1(raw);
    } else if (Array.isArray(raw.sections)) {
        envelope = {
            downloadedDate: raw.downloadedDate || raw.savedDate || null,
            sections: raw.sections,
        };
    } else {
        return { error: 'invalid_format' };
    }

    const sections = envelope.sections
        .map((s, i) => normalizeSection(s, expectedSectionIds[i]))
        .filter(Boolean);

    const padded = padSections(sections, expectedSectionIds);

    return {
        downloadedDate: envelope.downloadedDate,
        ctemSkipped: Boolean(raw.ctemSkipped),
        sections: padded,

        compatNote: padded.some(s => s.missing),
    };
};

export const expectedSectionIds = (data) => {
    if (!Array.isArray(data)) return SECTION_FALLBACK_ORDER.filter(id => id !== 'TP');
    return data
        .filter(s => s && s.section_id && s.section_id !== 'TP' && Array.isArray(s.questions))
        .map(s => s.section_id);
};

export const sortByDate = (records) =>
    records.slice().sort((a, b) => {
        const da = new Date(a.downloadedDate || 0).getTime();
        const db = new Date(b.downloadedDate || 0).getTime();
        return da - db;
    });

export { MAX_FILES };
