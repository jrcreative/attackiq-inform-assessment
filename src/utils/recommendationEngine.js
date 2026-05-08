// Phase 2 — recommendation engine.
//
// Walks the user's assessment answers, asks matrixSuggestions where the next
// improvement step lies for each scored question, looks up the rec content
// (primaryOwner / levelGoal / recommendations[]) on that suggested choice,
// and returns the top N groups ranked by Impact / Complexity (high impact,
// low complexity first — the upper-left corner of the matrix).
//
// Mirrors `buildPdfRecommendationGroups` in aiq-inform-tool's ResultsPage.vue
// so the on-screen, PDF, and DB-stored recs all use the same selection logic.

import { getMatrixSuggestionChoiceIndices } from './matrixSuggestions';

const DEFAULT_LIMIT = 5;
const SCORED_SECTION_IDS = new Set(['CTI', 'DM', 'TE', 'CTEM']);

const trim = (v) => (typeof v === 'string' ? v.trim() : '');

const choiceHasContent = (choice) => {
    if (!choice || typeof choice !== 'object') return false;
    if (trim(choice.primaryOwner)) return true;
    if (trim(choice.levelGoal)) return true;
    if (Array.isArray(choice.recommendations)) {
        return choice.recommendations.some(line => trim(line) !== '');
    }
    return false;
};

const buildChoiceBlock = (choice) => ({
    choiceUid:     choice.uid || '',
    selectedLabel: trim(choice.text) || trim(choice.description) || '',
    primaryOwner:  trim(choice.primaryOwner) || null,
    levelGoal:     trim(choice.levelGoal) || null,
    recommendations: Array.isArray(choice.recommendations)
        ? choice.recommendations.map(trim).filter(line => line !== '')
        : [],
});

// Rank cells of the 3x3 matrix in the same order they read top-left → bottom-right
// when impact decreases down the grid (3 = High Impact at top).
const matrixCellRank = (impact, complexity) => {
    const order = [];
    for (let row = 1; row <= 3; row++) {
        for (let col = 1; col <= 3; col++) {
            order.push(`i-${4 - row}_c-${col}`);
        }
    }
    const idx = order.indexOf(`i-${impact}_c-${complexity}`);
    return idx >= 0 ? idx : 999;
};

/**
 * Read the recommendation limit from the Results metadata block of the data
 * file. Falls back to DEFAULT_LIMIT when the block isn't present.
 */
export const getRecommendationLimit = (data) => {
    if (!Array.isArray(data)) return DEFAULT_LIMIT;
    const resultsMeta = data.find(s => s && s.shortname === 'Results' && typeof s.recommendationLimit === 'number');
    return resultsMeta ? resultsMeta.recommendationLimit : DEFAULT_LIMIT;
};

/**
 * Build the ranked recommendation groups for a completed assessment.
 *
 * @param {Array}   data        - the full data file (sections + questions)
 * @param {Object}  answers     - userAnswers map (componentKey → indices | 'N/A')
 * @param {Object}  options
 * @param {boolean} options.ctemSkipped - true when user opted out of CTEM
 * @param {number}  options.limit       - override the recommendation limit
 * @returns {Array<{
 *   componentLabel: string,
 *   sectionId:      string,
 *   impact:         number,
 *   complexity:     number,
 *   choiceBlock:    object,
 * }>}
 */
export const buildRecommendationGroups = (data, answers, options = {}) => {
    if (!Array.isArray(data) || !answers) return [];
    const ctemSkipped = Boolean(options.ctemSkipped);
    const limit = typeof options.limit === 'number' ? options.limit : getRecommendationLimit(data);

    const groups = [];

    let sectionIndex = 0;
    for (const section of data) {
        if (!section || !section.section_id) continue;
        if (!SCORED_SECTION_IDS.has(section.section_id)) {
            sectionIndex++;
            continue;
        }
        if (section.section_id === 'CTEM' && ctemSkipped) {
            sectionIndex++;
            continue;
        }

        let questionIndex = 0;
        for (const question of section.questions || []) {
            const rawAnswer = answers[question.uid];
            const irrelevant = rawAnswer === 'N/A';
            const selectedIndices = irrelevant
                ? []
                : (Array.isArray(rawAnswer) ? rawAnswer.filter(n => Number.isFinite(n)) : []);

            if (irrelevant) {
                questionIndex++;
                continue;
            }

            const suggestionIndices = getMatrixSuggestionChoiceIndices(
                question,
                selectedIndices,
                irrelevant
            );

            for (let i = 0; i < suggestionIndices.length; i++) {
                const idx = suggestionIndices[i];
                const choice = question.choices?.[idx];
                if (!choice || !choiceHasContent(choice)) continue;

                groups.push({
                    componentLabel: `${choice.uid || question.uid}: ${question.heading || ''}`,
                    sectionId:      section.section_id,
                    impact:         choice.impact ?? 0,
                    complexity:     choice.complexity ?? 0,
                    choiceBlock:    buildChoiceBlock(choice),
                    _sectionIndex:  sectionIndex,
                    _questionIndex: questionIndex,
                    _suggestionIndex: i,
                });
            }

            questionIndex++;
        }
        sectionIndex++;
    }

    groups.sort((a, b) => {
        const ra = matrixCellRank(a.impact, a.complexity);
        const rb = matrixCellRank(b.impact, b.complexity);
        if (ra !== rb) return ra - rb;
        if (a._sectionIndex !== b._sectionIndex) return a._sectionIndex - b._sectionIndex;
        if (a._questionIndex !== b._questionIndex) return a._questionIndex - b._questionIndex;
        return a._suggestionIndex - b._suggestionIndex;
    });

    return groups.slice(0, limit).map(g => {
        const { _sectionIndex, _questionIndex, _suggestionIndex, ...rest } = g;
        return rest;
    });
};
