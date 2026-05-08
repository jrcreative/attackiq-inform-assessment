// Phase 2 — assessment question type aliases.
// Mirrors aiq-inform-tool/src/utils/questionTypes.js so matrix and scoring
// helpers stay in sync between the two implementations.

export function isSelectLike(type) {
    return type === 'select' || type === 'dropdownSelect';
}

export function isMultiSelectLike(type) {
    return type === 'multiselect' || type === 'dropdownMultiSelect';
}
