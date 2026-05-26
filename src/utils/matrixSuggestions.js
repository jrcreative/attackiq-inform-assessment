

import { isSelectLike, isMultiSelectLike } from './questionTypes';

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

        if (selectedIndices.length === n) return [];
        const indices = [];
        for (let i = 0; i < n; i++) {
            if (!selectedIndices.includes(i)) indices.push(i);
        }
        return indices;
    }

    return [];
}
