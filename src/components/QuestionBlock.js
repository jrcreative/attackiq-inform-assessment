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

const QuestionBlock = ({ question, sectionId }) => {
    const { state, dispatch } = useAssessment();
    const { answers } = state;
    const currentAnswer = answers[question.componentKey] || [];
    const isNotApplicable = currentAnswer === 'N/A';

    const handleSelect = (index, type) => {
        let newAnswer = isNotApplicable ? [] : [...currentAnswer];

        if (type === 'Radio Buttons') {
            newAnswer = [index];
        } else {
            if (newAnswer.includes(index)) {
                newAnswer = newAnswer.filter(i => i !== index);
            } else {
                newAnswer.push(index);
            }
        }

        dispatch({
            type: 'SET_ANSWER',
            uid: question.componentKey,
            value: newAnswer
        });
    };

    const handleNotApplicable = () => {
        dispatch({
            type: 'SET_ANSWER',
            uid: question.componentKey,
            value: isNotApplicable ? [] : 'N/A'
        });
    };

    const inputType = question['Question Type'] === 'Radio Buttons' ? 'radio' : 'checkbox';

    return (
        <div className="aiq-question-block" style={{
            marginBottom: '30px',
            padding: '20px',
            background: isNotApplicable ? '#f9f9f9' : '#fff',
            border: '1px solid #eaeaea',
            borderRadius: '6px',
            opacity: isNotApplicable ? 0.7 : 1,
            transition: 'all 0.2s ease'
        }}>
            <h4 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '8px', color: '#40008f' }}>
                {question.componentKey} - {question.Component}
            </h4>
            <p style={{ marginBottom: '15px', fontSize: '14px', color: '#333' }}>{question.Question}</p>

            <div className="aiq-options" style={{ opacity: isNotApplicable ? 0.5 : 1, pointerEvents: isNotApplicable ? 'none' : 'auto' }}>
                {question.choices?.map((choice, idx) => (
                    <label key={idx} style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        marginBottom: '10px',
                        cursor: isNotApplicable ? 'default' : 'pointer',
                        padding: '10px 12px',
                        borderRadius: '4px',
                        border: !isNotApplicable && currentAnswer.includes(idx) ? '2px solid #40008f' : '1px solid #ddd',
                        background: !isNotApplicable && currentAnswer.includes(idx) ? '#f8f5fc' : '#fff',
                        transition: 'all 0.2s ease'
                    }}>
                        <input
                            type={inputType}
                            name={question.componentKey}
                            checked={!isNotApplicable && currentAnswer.includes(idx)}
                            onChange={() => handleSelect(idx, question['Question Type'])}
                            disabled={isNotApplicable}
                            style={{ marginTop: '3px', marginRight: '12px', accentColor: '#40008f' }}
                        />
                        <span style={{ fontSize: '14px', lineHeight: '1.4', display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                            {choice.description}
                            <InfoIcon tooltip={choice.tooltip} />
                        </span>
                    </label>
                ))}
            </div>

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
                    <span style={{ fontSize: '13px', lineHeight: '1.4', color: '#666', fontStyle: 'italic' }}>
                        This component is not relevant to my organization — exclude it from my results.
                    </span>
                </label>
            </div>
        </div>
    );
};

export default QuestionBlock;
