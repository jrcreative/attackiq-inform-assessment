

export function isSelectLike(type) {
    return type === 'select' || type === 'dropdownSelect';
}

export function isMultiSelectLike(type) {
    return type === 'multiselect' || type === 'dropdownMultiSelect';
}
