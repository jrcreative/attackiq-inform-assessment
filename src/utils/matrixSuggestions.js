// Phase 2 — port of aiq-inform-tool/src/utils/matrixSuggestions.js.
//
// Returns the choice indices that would appear on the Impact / Complexity
// matrix as "suggested levels that have not been selected" — i.e. the next
// step the user could take to improve their score on a given component.
//
// For single-select questions: the next level above the user's current
// selection (or the first level with points > 0 if unanswered).
// For multi-select questions: every choice the user has not yet picked.
// For unanswered or unscored questions: nothing.

import { isSelectLike, isMultiSelectLike } from './questionTypes';

/**
 * @param {object}   question         - normalized question (type, choices)
 * @param {number[]} selectedIndices  - choice indices currently selected
 * @param {boolean}  irrelevant       - true when user marked the component N/A
 * @returns {number[]}
 */
export function getMatrixSuggestionChoiceIndices(question, selectedIndices, irrelevant) {
    if (irrelevant) return [];

    const choices = question?.choices || [];
    const n = choices.length;
    if (n === 0) return [];

    let earnedPoints = 0;
    for (const idx of selectedIndices) {
        const choice = choices[idx];
        if (!choice) continue;
        earnedPoints += choice.points || 0;
    }
    if (earnedPoints < 0) return [];

    if (isSelectLike(question.type)) {
        const lastIndex = n - 1;
        if (lastIndex < 0) return [];

        let firstPositiveIndex = null;
        for (let i = 0; i < n; i++) {
            if ((choices[i]?.points || 0) > 0) {
                firstPositiveIndex = i;
                break;
            }
        }

        if (selectedIndices.length === 0) {
            return firstPositiveIndex != null ? [firstPositiveIndex] : [];
        }

        const selected = selectedIndices[0];
        if (selected < lastIndex) return [selected + 1];
        return [];
    }

    if (isMultiSelectLike(question.type)) {
        // If the user already selected every option, nothing to suggest.
        if (selectedIndices.length === n) return [];
        const indices = [];
        for (let i = 0; i < n; i++) {
            if (!selectedIndices.includes(i)) indices.push(i);
        }
        return indices;
    }

    return [];
}
