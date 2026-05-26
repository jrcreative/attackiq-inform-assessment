import React, { useState } from 'react';
import { useAssessment } from '../context/AssessmentContext';

const InfoIcon = ({ tooltip }) => {
    const [showTooltip, setShowTooltip] = useState(false);

    if (!tooltip) return null;

    return (
        <span
            className="aiq-info-icon-wrapper"
            style={{ position: 'relative', display: 'inline-flex', marginLeft: '6px' }}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
        >
            <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                style={{ cursor: 'help', color: '#999' }}
            >
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" fill="none" />
                <text x="8" y="12" textAnchor="middle" fontSize="10" fill="currentColor" fontWeight="600">i</text>
            </svg>
            {showTooltip && (
                <div
                    className="aiq-tooltip-popup"
                    style={{
                        position: 'absolute',
                        bottom: '100%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        marginBottom: '8px',
                        padding: '10px 14px',
                        background: '#f5f5f5',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '13px',
                        lineHeight: '1.5',
                        color: '#333',
                        width: '280px',
                        maxWidth: '90vw',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                        zIndex: 1000,
                        whiteSpace: 'normal'
                    }}
                >
                    {tooltip}
                    <div
                        style={{
                            position: 'absolute',
                            bottom: '-6px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: '0',
                            height: '0',
                            borderLeft: '6px solid transparent',
                            borderRight: '6px solid transparent',
                            borderTop: '6px solid #ddd'
                        }}
                    />
                </div>
            )}
        </span>
    );
};

const isMultiSelectType = (type) => type === 'multiselect' || type === 'dropdownMultiSelect';
const isDropdownType = (type) => type === 'dropdownSelect' || type === 'dropdownMultiSelect';
const isScoredType = (type) => type === 'multiselect' || type === 'select';

const BRAND = {
    primary: '#40008f',
    primarySoft: '#f8f5fc',
    border: '#ddd',
    text: '#333',
    muted: '#666',
    subtle: '#eaeaea',
    chipBg: '#f3eefb',
    chipBorder: '#cdb6e6'
};

const QuestionBlock = ({ question }) => {
    const { state, dispatch } = useAssessment();
    const { answers } = state;

    const questionUid = question.uid || question.componentKey;
    const currentAnswer = answers[questionUid];
    const isNotApplicable = currentAnswer === 'N/A';
    const selectedIndices = Array.isArray(currentAnswer) ? currentAnswer : [];

    const type = question.type;
    const choices = question.choices || [];
    const allowNotApplicable = isScoredType(type);

    const setAnswer = (value) => {
        dispatch({
            type: 'SET_ANSWER',
            uid: questionUid,
            value
        });
    };

    const handleToggle = (index) => {
        if (isMultiSelectType(type)) {
            const next = selectedIndices.includes(index)
                ? selectedIndices.filter(i => i !== index)
                : [...selectedIndices, index];
            setAnswer(next);
        } else {
            setAnswer([index]);
        }
    };

    const handleDropdownSelectChange = (e) => {
        const value = e.target.value;
        if (value === '') {
            setAnswer([]);
        } else {
            setAnswer([Number(value)]);
        }
    };

    const handleDropdownMultiSelectAdd = (e) => {
        const value = e.target.value;
        if (value === '') return;
        const idx = Number(value);
        if (!selectedIndices.includes(idx)) {
            setAnswer([...selectedIndices, idx]);
        }
        e.target.value = '';
    };

    const handleChipRemove = (index) => {
        setAnswer(selectedIndices.filter(i => i !== index));
    };

    const handleNotApplicable = () => {
        setAnswer(isNotApplicable ? [] : 'N/A');
    };

    const renderRadioOrCheckbox = () => {
        const inputType = type === 'select' ? 'radio' : 'checkbox';
        return (
            <div className="aiq-options" style={{ opacity: isNotApplicable ? 0.5 : 1, pointerEvents: isNotApplicable ? 'none' : 'auto' }}>
                {choices.map((choice, idx) => {
                    const isChecked = !isNotApplicable && selectedIndices.includes(idx);
                    return (
                        <label key={choice.uid || idx} style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            marginBottom: '10px',
                            cursor: isNotApplicable ? 'default' : 'pointer',
                            padding: '10px 12px',
                            borderRadius: '4px',
                            border: isChecked ? `2px solid ${BRAND.primary}` : `1px solid ${BRAND.border}`,
                            background: isChecked ? BRAND.primarySoft : '#fff',
                            transition: 'all 0.2s ease'
                        }}>
                            <input
                                type={inputType}
                                name={questionUid}
                                checked={isChecked}
                                onChange={() => handleToggle(idx)}
                                disabled={isNotApplicable}
                                style={{ marginTop: '3px', marginRight: '12px', accentColor: BRAND.primary }}
                            />
                            <span style={{ fontSize: '14px', lineHeight: '1.4', display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                                {choice.text || choice.description}
                                <InfoIcon tooltip={choice.tooltip} />
                            </span>
                        </label>
                    );
                })}
            </div>
        );
    };

    const renderDropdownSelect = () => {
        const value = selectedIndices.length > 0 ? String(selectedIndices[0]) : '';
        return (
            <div className="aiq-dropdown-wrapper" style={{ maxWidth: '420px' }}>
                <select
                    value={value}
                    onChange={handleDropdownSelectChange}
                    style={{
                        width: '100%',
                        padding: '10px 12px',
                        fontSize: '14px',
                        border: `1px solid ${BRAND.border}`,
                        borderRadius: '4px',
                        background: '#fff',
                        color: BRAND.text,
                        cursor: 'pointer'
                    }}
                >
                    <option value="">Select an option…</option>
                    {choices.map((choice, idx) => (
                        <option key={choice.uid || idx} value={idx}>
                            {choice.text || choice.description}
                        </option>
                    ))}
                </select>
            </div>
        );
    };

    const renderDropdownMultiSelect = () => {
        const remainingChoices = choices
            .map((choice, idx) => ({ choice, idx }))
            .filter(({ idx }) => !selectedIndices.includes(idx));

        return (
            <div className="aiq-dropdown-multi-wrapper" style={{ maxWidth: '520px' }}>
                <select
                    value=""
                    onChange={handleDropdownMultiSelectAdd}
                    disabled={remainingChoices.length === 0}
                    style={{
                        width: '100%',
                        padding: '10px 12px',
                        fontSize: '14px',
                        border: `1px solid ${BRAND.border}`,
                        borderRadius: '4px',
                        background: '#fff',
                        color: BRAND.text,
                        cursor: remainingChoices.length === 0 ? 'not-allowed' : 'pointer',
                        marginBottom: '10px'
                    }}
                >
                    <option value="">
                        {remainingChoices.length === 0 ? 'All options selected' : 'Add an option…'}
                    </option>
                    {remainingChoices.map(({ choice, idx }) => (
                        <option key={choice.uid || idx} value={idx}>
                            {choice.text || choice.description}
                        </option>
                    ))}
                </select>

                {selectedIndices.length > 0 && (
                    <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '6px'
                    }}>
                        {selectedIndices.map(idx => {
                            const choice = choices[idx];
                            if (!choice) return null;
                            return (
                                <span
                                    key={idx}
                                    className="aiq-chip"
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        padding: '6px 10px',
                                        background: BRAND.chipBg,
                                        border: `1px solid ${BRAND.chipBorder}`,
                                        color: BRAND.primary,
                                        borderRadius: '16px',
                                        fontSize: '13px',
                                        lineHeight: '1.2'
                                    }}
                                >
                                    {choice.text || choice.description}
                                    <button
                                        type="button"
                                        onClick={() => handleChipRemove(idx)}
                                        aria-label={`Remove ${choice.text || choice.description}`}
                                        style={{
                                            marginLeft: '8px',
                                            background: 'transparent',
                                            border: 'none',
                                            color: BRAND.primary,
                                            cursor: 'pointer',
                                            fontSize: '14px',
                                            lineHeight: '1',
                                            padding: 0
                                        }}
                                    >
                                        ×
                                    </button>
                                </span>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    const renderInput = () => {
        if (type === 'dropdownSelect') return renderDropdownSelect();
        if (type === 'dropdownMultiSelect') return renderDropdownMultiSelect();
        return renderRadioOrCheckbox();
    };

    const heading = question.heading || question.Component;
    const subheading = question.subheading || question.Question || question.questionText;

    return (
        <div className="aiq-question-block" style={{
            marginBottom: '30px',
            padding: '20px',
            background: isNotApplicable ? '#f9f9f9' : '#fff',
            border: `1px solid ${BRAND.subtle}`,
            borderRadius: '6px',
            opacity: isNotApplicable ? 0.7 : 1,
            transition: 'all 0.2s ease'
        }}>
            <h4 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '8px', color: BRAND.primary, display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                {questionUid} - {heading}
                <InfoIcon tooltip={question.tooltip} />
            </h4>
            {subheading && (
                <p style={{ marginBottom: '15px', fontSize: '14px', color: BRAND.text }}>{subheading}</p>
            )}

            {renderInput()}

            {allowNotApplicable && (
                <div style={{
                    marginTop: '15px',
                    paddingTop: '15px',
                    borderTop: '1px dashed #ddd'
                }}>
                    <label style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        cursor: 'pointer',
                        padding: '10px 12px',
                        borderRadius: '4px',
                        border: isNotApplicable ? '2px solid #666' : '1px solid #ddd',
                        background: isNotApplicable ? '#f0f0f0' : '#fafafa',
                        transition: 'all 0.2s ease'
                    }}>
                        <input
                            type="checkbox"
                            checked={isNotApplicable}
                            onChange={handleNotApplicable}
                            style={{ marginTop: '3px', marginRight: '12px', accentColor: '#666' }}
                        />
                        <span style={{ fontSize: '13px', lineHeight: '1.4', color: BRAND.muted, fontStyle: 'italic' }}>
                            This component is not relevant to my organization — exclude it from my results.
                        </span>
                    </label>
                </div>
            )}
        </div>
    );
};

export default QuestionBlock;
