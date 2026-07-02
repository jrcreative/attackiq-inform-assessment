

const isSectionLike = (entry) => Boolean(entry && entry.section_id && Array.isArray(entry.questions));
const isMultiSelectType = (type) => type === 'multiselect' || type === 'dropdownMultiSelect';

const buildSectionSnapshot = (section, userAnswers) => {
    const questions = section.questions.map(q => {
        const rawAnswer = userAnswers[q.uid];
        const isNotApplicable = rawAnswer === 'N/A';
        const selectedIndices = isNotApplicable
            ? []
            : (Array.isArray(rawAnswer) ? rawAnswer : []);

        const choices = (q.choices || []).map(c => ({
            uid: c.uid,
            text: c.text,
            tooltip: c.tooltip || '',
            level_id: typeof c.level_id === 'number' ? c.level_id : 0,
            impact: typeof c.impact === 'number' ? c.impact : 0,
            complexity: typeof c.complexity === 'number' ? c.complexity : 0,
            points: typeof c.points === 'number' ? c.points : 0,
            cmm_v1: Array.isArray(c.cmm_v1) ? c.cmm_v1 : (c.cmm_v1 ? [c.cmm_v1] : ['']),
            cmm_v2: c.cmm_v2 || '',
            red_team: c.red_team || '',
            ctem: c.ctem || '',
            primaryOwner: c.primaryOwner || '',
            levelGoal: c.levelGoal || '',
            recommendations: Array.isArray(c.recommendations) ? c.recommendations : []
        }));

        let totalPoints = 0;
        let maxImpact = 0;
        let maxComplexity = 0;
        const scoreArray = [];

        selectedIndices.forEach(idx => {
            const choice = choices[idx];
            if (!choice) return;
            totalPoints += choice.points;
            maxImpact = Math.max(maxImpact, choice.impact);
            maxComplexity = Math.max(maxComplexity, choice.complexity);
            scoreArray.push(String(idx));
        });

        let possiblePoints = 0;
        if (isMultiSelectType(q.type)) {
            possiblePoints = choices.reduce((acc, c) => acc + (c.points || 0), 0);
        } else {
            possiblePoints = choices.reduce((acc, c) => Math.max(acc, c.points || 0), 0);
        }

        return {
            uid: q.uid,
            heading: q.heading,
            subheading: q.subheading || '',
            tooltip: q.tooltip || '',
            type: q.type,
            weight: typeof q.weight === 'number' ? q.weight : 0,
            choices,
            score: scoreArray,
            totalPoints,
            possiblePoints,
            impact: maxImpact,
            complexity: maxComplexity,
            irrelevant: isNotApplicable
        };
    });

    const totalPoints = questions
        .filter(q => !q.irrelevant)
        .reduce((acc, q) => acc + q.totalPoints, 0);
    const possiblePoints = questions
        .filter(q => !q.irrelevant)
        .reduce((acc, q) => acc + q.possiblePoints, 0);

    return {
        section_id: section.section_id,
        name: section.name,
        shortname: section.shortname,
        section_weight: typeof section.section_weight === 'number' ? section.section_weight : 0,
        questions,
        totalPoints,
        possiblePoints
    };
};

const buildThreatProfile = (sections, userAnswers) => {
    const tp = sections.find(s => s.section_id === 'TP');
    if (!tp) return undefined;

    const profile = {};
    tp.questions.forEach(q => {
        const ans = userAnswers[q.uid];
        if (Array.isArray(ans) && ans.length > 0) {
            profile[q.uid] = ans;
        }
    });
    return profile;
};

export const generateMitreJSON = (rawData, userAnswers, results = {}) => {
    const sections = (Array.isArray(rawData) ? rawData : []).filter(isSectionLike);
    const { ctemSkipped = false } = results;

    const scoredSections = sections
        .filter(s => s.section_id !== 'TP')
        .filter(s => !(s.section_id === 'CTEM' && ctemSkipped))
        .map(s => buildSectionSnapshot(s, userAnswers));

    let overallTotalPoints = 0;
    let overallPossiblePoints = 0;

    scoredSections.forEach(s => {
        overallTotalPoints += s.totalPoints;
        overallPossiblePoints += s.possiblePoints;
    });

    const overallScore = overallPossiblePoints > 0
        ? overallTotalPoints / overallPossiblePoints
        : 0;

    const mitreJSON = {
        sections: [
            ...scoredSections,
            {
                name: 'Your Score',
                totalPoints: overallTotalPoints,
                possiblePoints: overallPossiblePoints,
                overallScore
            }
        ],
        downloadedDate: new Date().toISOString()
    };

    const threatProfile = buildThreatProfile(sections, userAnswers);
    if (threatProfile) {
        mitreJSON.threatProfile = threatProfile;
    }

    if (ctemSkipped) {
        mitreJSON.ctemSkipped = true;
    }

    return mitreJSON;
};

export default generateMitreJSON;
