import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useAssessment } from '../context/AssessmentContext';
import QuestionBlock from './QuestionBlock';
import { processResults, calculateSectionScore, getScoreLabel } from '../utils/scoring';
import RadarChart from './RadarChart';
import ImpactComplexityMatrix from './ImpactComplexityMatrix';
import { generatePDF } from '../utils/pdfGenerator';
import { generateMitreJSON } from '../utils/jsonGenerator';
import { submitResults } from '../utils/api';
import MarketoModal from './MarketoModal';

const groupDataBySection = (flatData) => {
    const sections = ['CTI', 'DM', 'TE'];
    const grouped = {};
    sections.forEach(sec => {
        grouped[sec] = flatData.filter(item => item['Dimension ID'] === sec);
    });
    return grouped;
};

const consolidateQuestions = (rawData) => {
    const questionsMap = {};
    rawData.forEach(row => {
        const componentKey = `${row['Dimension ID']}.${row['Component ID']}`;

        if (!questionsMap[componentKey]) {
            questionsMap[componentKey] = {
                componentKey,
                Component: row.Component,
                Question: row.Question,
                'Question Type': row['Question Type'],
                'Dimension ID': row['Dimension ID'],
                Dimension: row.Dimension,
                'Component ID': row['Component ID'],
                'Component Weight': row['Component Weight'],
                'Dimension Weight': row['Dimension Weight'],
                choices: []
            };
        }

        questionsMap[componentKey].choices.push({
            uid: row.UID,
            description: row['Level Description'],
            points: row.Points,
            impact: row.Impact,
            complexity: row.Complexity,
            tooltip: row['Level Tooltip'],
            levelId: row['Level ID']
        });
    });

    Object.values(questionsMap).forEach(q => {
        q.choices.sort((a, b) => a.levelId - b.levelId);
    });

    return Object.values(questionsMap);
};

const BRAND_COLORS = {
    primary: '#40008f',
    primaryDark: '#2d0064',
    navy: '#0e082b',
    accent: '#8078a8',
    lightPurple: '#bc9fdf',
    background: '#f2f1f4',
    white: '#ffffff',
    text: '#333333',
    textLight: '#65616b'
};

const WizardWrapper = () => {
    const { state, dispatch } = useAssessment();
    const { step, data, answers } = state;
    const [isGenerating, setIsGenerating] = useState(false);
    const [showMarketoModal, setShowMarketoModal] = useState(false);
    const [pendingDownloadType, setPendingDownloadType] = useState(null);
    const [userEmail, setUserEmail] = useState(null);
    const [showDownloadMenu, setShowDownloadMenu] = useState(false);
    const wizardHeaderRef = useRef(null);
    const containerRef = useRef(null);
    const isInitialMount = useRef(true);

    const config = window.aiqInformData || {};
    const marketoConfig = config.marketo || {};
    const gateDownloads = marketoConfig.gateDownloads && marketoConfig.formId;
    const ctaUrl = config.contactUrl || '';
    const ctaText = config.contactButtonText || 'Improve Your Score';
    const siteUrl = config.siteUrl || '';

    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }

        setTimeout(() => {
            if (containerRef.current) {
                const adminBar = document.getElementById('wpadminbar');
                const adminBarHeight = adminBar ? adminBar.offsetHeight : 0;

                let siteHeaderHeight = 0;
                const siteHeader =
                    document.querySelector('#main-header .kadence-sticky-header') ||
                    document.querySelector('#mobile-header .kadence-sticky-header') ||
                    document.querySelector('.wp-block-kadence-header');
                if (siteHeader) {
                    siteHeaderHeight = siteHeader.getBoundingClientRect().height;
                }

                const totalOffset = adminBarHeight + siteHeaderHeight + 100;
                const elementTop = containerRef.current.getBoundingClientRect().top + window.pageYOffset;
                window.scrollTo({ top: elementTop - totalOffset, behavior: 'smooth' });
            }
        }, 50);
    }, [step]);

    useEffect(() => {
        const wizardHeader = wizardHeaderRef.current;
        if (!wizardHeader) return;

        let rafId = null;
        let lastTop = '';
        let siteHeader = null;
        let adminBar = null;
        let queryCount = 0;

        const querySiteHeader = () => {
            const activeSticky = document.querySelector('.kb-header-sticky-wrapper.item-is-fixed') ||
                document.querySelector('#main-header .kadence-sticky-header.item-is-fixed') ||
                document.querySelector('#mobile-header .kadence-sticky-header.item-is-fixed');
            if (activeSticky) return activeSticky;
            return document.querySelector('.kb-header-sticky-wrapper') ||
                document.querySelector('#main-header .kadence-sticky-header') ||
                document.querySelector('#mobile-header .kadence-sticky-header') ||
                document.querySelector('.wp-block-kadence-header');
        };

        const update = () => {
            if (queryCount % 60 === 0) {
                siteHeader = querySiteHeader();
                adminBar = document.getElementById('wpadminbar');
            }
            queryCount++;

            const adminBarHeight = adminBar ? adminBar.offsetHeight : 0;

            let newTop;
            if (siteHeader) {
                const visibleBottom = Math.max(
                    siteHeader.getBoundingClientRect().bottom,
                    adminBarHeight
                );
                newTop = visibleBottom + 'px';
            } else {
                newTop = '';
            }

            if (newTop !== lastTop) {
                wizardHeader.style.top = newTop;
                lastTop = newTop;
            }

            rafId = requestAnimationFrame(update);
        };

        rafId = requestAnimationFrame(update);

        return () => {
            if (rafId) cancelAnimationFrame(rafId);
        };
    }, []);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (showDownloadMenu && !e.target.closest('.aiq-download-dropdown')) {
                setShowDownloadMenu(false);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [showDownloadMenu]);

    const structuredData = useMemo(() => {
        if (!data || !Array.isArray(data)) return {};
        const allQuestions = consolidateQuestions(data);
        return groupDataBySection(allQuestions);
    }, [data]);

    const sections = ['CTI', 'DM', 'TE', 'RESULTS'];
    const currentSectionKey = sections[step];
    const currentQuestions = structuredData[currentSectionKey] || [];

    const results = step === 3 ? processResults(data, answers) : null;

    const getOverallLevel = (score) => {
        if (score < 0) return -1;
        if (score === 0) return 0;
        if (score <= 0.2) return 1;
        if (score <= 0.4) return 2;
        if (score <= 0.6) return 3;
        if (score <= 0.8) return 4;
        if (score <= 1) return 5;
        return 0;
    };
    const overallScoreLevel = results ? getOverallLevel(results.overallScore) : 0;
    const overallScoreLabel = getScoreLabel(overallScoreLevel);

    const handleNext = async () => {
        if (step === 2) {
            const results = processResults(data, answers);

            submitResults(answers, results).then(success => {
                if (success) console.log('Results Saved!');
            });

            dispatch({ type: 'NEXT_STEP' });
        } else {
            dispatch({ type: 'NEXT_STEP' });
        }
    };

    const handlePrev = () => {
        dispatch({ type: 'PREV_STEP' });
    };

    const downloadPDF = useCallback(async () => {
        setIsGenerating(true);
        try {
            await generatePDF('aiq-results-print-area', 'AttackIQ-INFORM-Assessment-Report.pdf', {
                results,
                overallLevel: overallScoreLevel,
                overallLabel: overallScoreLabel,
                calculateSectionScore
            });
        } catch (err) {
            console.error('PDF generation error:', err);
        }
        setIsGenerating(false);
        setShowDownloadMenu(false);
    }, [results, overallScoreLevel, overallScoreLabel]);

    const downloadJSON = useCallback(() => {
        if (!results || !data) return;

        try {
            const jsonData = generateMitreJSON(data, answers, results);
            const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `AttackIQ-INFORM-Assessment-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('JSON generation error:', err);
        }
        setShowDownloadMenu(false);
    }, [results, data, answers]);

    const handleDownloadRequest = (type) => {
        if (gateDownloads && !userEmail) {
            setPendingDownloadType(type);
            setShowMarketoModal(true);
        } else {
            if (type === 'pdf') {
                downloadPDF();
            } else if (type === 'json') {
                downloadJSON();
            }
        }
    };

    const handleMarketoSuccess = (formValues) => {
        if (formValues?.Email) {
            setUserEmail(formValues.Email);
        } else {
            setUserEmail('submitted');
        }

        setShowMarketoModal(false);
        setTimeout(() => {
            if (pendingDownloadType === 'pdf') {
                downloadPDF();
            } else if (pendingDownloadType === 'json') {
                downloadJSON();
            }
            setPendingDownloadType(null);
        }, 500);
    };

    const sectionLabels = {
        'CTI': '1. Cyber Threat Intelligence',
        'DM': '2. Defensive Measures',
        'TE': '3. Test & Evaluation',
        'RESULTS': '4. Results'
    };

    return (
        <div className="aiq-assessment-container" ref={containerRef}>
            <div className="aiq-wizard-header" ref={wizardHeaderRef}>
                <ul className="aiq-steps-nav">
                    {sections.map((sec, idx) => {
                        const stepColors = [BRAND_COLORS.primary, '#36bae4', '#f02c68', BRAND_COLORS.primaryDark];
                        const isActive = idx === step;
                        const isCompleted = idx < step;

                        let tabStyle = {};
                        if (isActive) {
                            tabStyle = { borderBottomColor: stepColors[idx], color: '#000' };
                        } else {
                            tabStyle = { color: isCompleted ? BRAND_COLORS.primary : '#666', cursor: 'pointer' };
                        }

                        const handleTabClick = () => {
                            if (idx === step) return;

                            if (idx === 3 && step < 3) {
                                const results = processResults(data, answers);
                                submitResults(answers, results).then(success => {
                                    if (success) console.log('Results Saved!');
                                });
                            }

                            dispatch({ type: 'GO_TO_STEP', step: idx });
                        };

                        return (
                            <li
                                key={sec}
                                className={`aiq-step-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                                style={tabStyle}
                                onClick={handleTabClick}
                            >
                                {sectionLabels[sec]}
                            </li>
                        );
                    })}
                </ul>
                <div className="aiq-reset-link" onClick={() => dispatch({ type: 'RESET' })}>
                    <span style={{ fontSize: '20px' }}>⟳</span> Reset Answers
                </div>
            </div>

            <div className="aiq-wizard-content">
                {step < 3 ? (
                    <div className="aiq-wizard-step">
                        {currentQuestions.map(q => (
                            <QuestionBlock
                                key={q.componentKey}
                                question={q}
                                dispatch={dispatch}
                                currentAnswer={answers[q.componentKey]}
                            />
                        ))}
                    </div>
                ) : results ? (
                    <div id="aiq-results-print-area" className="aiq-results-container">
                        <div className="aiq-results-header" style={{
                            gridColumn: '1 / -1',
                            background: `linear-gradient(135deg, ${BRAND_COLORS.navy} 0%, ${BRAND_COLORS.primaryDark} 100%)`,
                            padding: '30px',
                            borderRadius: '8px',
                            marginBottom: '30px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div>
                                <h2 style={{
                                    margin: '0 0 8px 0',
                                    fontSize: '24px',
                                    fontWeight: '700',
                                    color: '#ffffff'
                                }}>
                                    Your INFORM Assessment Results
                                </h2>
                                <p style={{
                                    margin: 0,
                                    fontSize: '14px',
                                    color: '#bc9fdf'
                                }}>
                                    Assessment completed on {new Date().toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    })}
                                </p>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{
                                    fontSize: '48px',
                                    fontWeight: '800',
                                    lineHeight: '1',
                                    color: '#ffffff'
                                }}>
                                    {overallScoreLevel}
                                </div>
                                <div style={{
                                    fontSize: '14px',
                                    marginTop: '4px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '1px',
                                    color: '#bc9fdf'
                                }}>
                                    {overallScoreLabel}
                                </div>
                            </div>
                        </div>

                        <div className="aiq-results-left">
                            <h3 style={{ fontSize: '18px', marginBottom: '20px', color: BRAND_COLORS.navy, fontWeight: '700' }}>
                                Score Breakdown
                            </h3>

                            {results.scoresBySection && results.scoresBySection.map((section) => {
                                const sectionColors = {
                                    'CTI': { bg: '#ffcc00', text: '#000', label: 'CTI' },
                                    'DM': { bg: '#36bae4', text: '#000', label: 'DM' },
                                    'TE': { bg: '#f02c68', text: '#fff', label: 'TE' }
                                };
                                const colorScheme = sectionColors[section.section_id] || { bg: '#ccc', text: '#000', label: section.section_id };

                                const sectionScore = calculateSectionScore(section);

                                return (
                                    <div key={section.section_id} style={{ marginBottom: '15px' }}>
                                        <div style={{
                                            background: colorScheme.bg,
                                            color: colorScheme.text,
                                            padding: '8px 14px',
                                            fontWeight: '700',
                                            fontSize: '13px',
                                            marginBottom: '8px',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            borderRadius: '4px'
                                        }}>
                                            <span>{colorScheme.label} - {section.name}</span>
                                            <span style={{
                                                background: 'rgba(255,255,255,0.2)',
                                                padding: '2px 10px',
                                                borderRadius: '12px',
                                                fontSize: '14px'
                                            }}>
                                                {sectionScore}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '12px', lineHeight: '1.6', paddingLeft: '8px' }}>
                                            {section.questions && section.questions.map(q => {
                                                const isNA = q.isNotApplicable;
                                                const isSkipped = !isNA && !q.hasAnswer;
                                                const getQuestionScore = () => {
                                                    if (isNA) return -1;
                                                    if (q.possiblePoints <= 0) return 0;

                                                    const ratio = q.totalPoints / q.possiblePoints;

                                                    if (ratio === 0 && q.hasAnswer) return 1;
                                                    if (ratio === 0) return 0;
                                                    if (ratio <= 0.2) return 1;
                                                    if (ratio <= 0.4) return 2;
                                                    if (ratio <= 0.6) return 3;
                                                    if (ratio <= 0.8) return 4;
                                                    return 5;
                                                };

                                                const qScore = getQuestionScore();
                                                const isMax = !isNA && !isSkipped && qScore === 5;

                                                const WarningIcon = () => (
                                                    <span
                                                        className="aiq-warning-icon"
                                                        data-tooltip="You have not selected any items for this component."
                                                        style={{ marginLeft: '4px', cursor: 'help', color: '#e6a700' }}
                                                    >
                                                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                                                            <path d="M8 1L1 15h14L8 1zm0 3l5.5 10h-11L8 4z" />
                                                            <path d="M7 7h2v3H7zM7 11h2v2H7z" />
                                                        </svg>
                                                    </span>
                                                );

                                                const NAInfoIcon = () => (
                                                    <span
                                                        className="aiq-na-info-icon"
                                                        data-tooltip="You have indicated that this component is not relevant to your organization. It has been excluded from all scoring and graphs on this results page."
                                                        style={{ marginLeft: '4px', cursor: 'help', color: '#666' }}
                                                    >
                                                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                                                            <circle cx="8" cy="8" r="6" />
                                                            <text x="8" y="11" textAnchor="middle" fontSize="9" fill="currentColor" stroke="none" fontWeight="600">i</text>
                                                        </svg>
                                                    </span>
                                                );

                                                return (
                                                    <div key={q.uid} style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        padding: '4px 0',
                                                        borderBottom: '1px solid #f0f0f0'
                                                    }}>
                                                        <span style={{ flex: 1, paddingRight: '10px', color: isNA ? '#bbb' : BRAND_COLORS.textLight, fontStyle: isNA ? 'italic' : 'normal' }}>
                                                            {q.uid} - {q.heading.substring(0, 45)}{q.heading.length > 45 ? '...' : ''}
                                                        </span>
                                                        <span style={{
                                                            fontWeight: '600',
                                                            minWidth: '40px',
                                                            textAlign: 'right',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'flex-end',
                                                            color: isNA ? '#999' : (isSkipped ? '#e6a700' : (isMax ? '#28a745' : BRAND_COLORS.text))
                                                        }}>
                                                            {isNA ? (
                                                                <>-<NAInfoIcon /></>
                                                            ) : isSkipped ? (
                                                                <>0<WarningIcon /></>
                                                            ) : (
                                                                isMax ? (
                                                                    <span
                                                                        className="aiq-max-score-icon"
                                                                        data-tooltip="Great Job! You have selected the highest possible score for this component."
                                                                        style={{ cursor: 'help' }}
                                                                    >
                                                                        {getScoreLabel(qScore)} <span style={{ color: '#28a745', marginLeft: '2px' }}>✓</span>
                                                                    </span>
                                                                ) : getScoreLabel(qScore)
                                                            )}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}

                            <div style={{ marginTop: '30px' }}>
                                <h3 style={{ fontSize: '16px', marginBottom: '15px', color: BRAND_COLORS.navy, fontWeight: '700' }}>
                                    Maturity Level Reference
                                </h3>
                                <div style={{ border: '1px solid #e0e0e0', borderRadius: '6px', overflow: 'hidden' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                        <thead>
                                            <tr style={{ background: BRAND_COLORS.background }}>
                                                <th style={{ padding: '10px', borderBottom: '1px solid #e0e0e0', textAlign: 'left', width: '50px' }}>Level</th>
                                                <th style={{ padding: '10px', borderBottom: '1px solid #e0e0e0', textAlign: 'left', width: '90px' }}>Label</th>
                                                <th style={{ padding: '10px', borderBottom: '1px solid #e0e0e0', textAlign: 'left' }}>Description</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {[
                                                { level: 1, label: 'Initial', desc: 'Activities are ad hoc, reactive, or informal. Processes are largely undocumented.' },
                                                { level: 2, label: 'Developing', desc: 'Some repeatable practices exist, but implementation is inconsistent.' },
                                                { level: 3, label: 'Defined', desc: 'Processes are documented and applied with moderate consistency.' },
                                                { level: 4, label: 'Managed', desc: 'Practices are measured, monitored, and integrated across teams.' },
                                                { level: 5, label: 'Optimized', desc: 'Capabilities are proactive, adaptive, and continuously refined.' }
                                            ].map((row, idx) => (
                                                <tr key={row.level} style={{
                                                    background: overallScoreLevel === row.level ? `${BRAND_COLORS.primary}15` : (idx % 2 === 0 ? '#fff' : '#fafafa')
                                                }}>
                                                    <td style={{
                                                        padding: '10px',
                                                        borderBottom: '1px solid #f0f0f0',
                                                        fontWeight: overallScoreLevel === row.level ? '700' : '400',
                                                        color: overallScoreLevel === row.level ? BRAND_COLORS.primary : 'inherit'
                                                    }}>{row.level}</td>
                                                    <td style={{
                                                        padding: '10px',
                                                        borderBottom: '1px solid #f0f0f0',
                                                        fontWeight: overallScoreLevel === row.level ? '700' : '400',
                                                        color: overallScoreLevel === row.level ? BRAND_COLORS.primary : 'inherit'
                                                    }}>{row.label}</td>
                                                    <td style={{
                                                        padding: '10px',
                                                        borderBottom: '1px solid #f0f0f0',
                                                        color: BRAND_COLORS.textLight
                                                    }}>{row.desc}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div className="aiq-results-right">
                            <div id="aiq-radar-chart-container" style={{
                                width: '100%',
                                maxWidth: '450px',
                                margin: '0 auto 30px'
                            }}>
                                <RadarChart scores={results} />
                            </div>
                            <div id="aiq-matrix-container">
                                <ImpactComplexityMatrix results={results} />
                            </div>

                            {ctaUrl && (
                                <div className="aiq-cta-section" style={{
                                    marginTop: '30px',
                                    padding: '25px',
                                    background: `linear-gradient(135deg, ${BRAND_COLORS.primary} 0%, ${BRAND_COLORS.primaryDark} 100%)`,
                                    borderRadius: '8px',
                                    textAlign: 'center'
                                }}>
                                    <h3 style={{
                                        margin: '0 0 10px 0',
                                        fontSize: '18px',
                                        fontWeight: '700',
                                        color: '#ffffff'
                                    }}>
                                        Ready to Improve Your Security Posture?
                                    </h3>
                                    <p style={{
                                        margin: '0 0 20px 0',
                                        fontSize: '14px',
                                        color: '#e5dfec',
                                        lineHeight: '1.5'
                                    }}>
                                        Our experts can help you strengthen your threat-informed defense capabilities.
                                    </p>
                                    <a
                                        href={ctaUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="aiq-cta-button"
                                        style={{
                                            display: 'inline-block',
                                            padding: '12px 30px',
                                            background: '#ffffff',
                                            color: BRAND_COLORS.primary,
                                            textDecoration: 'none',
                                            fontWeight: '700',
                                            fontSize: '14px',
                                            borderRadius: '6px',
                                            transition: 'transform 0.2s, box-shadow 0.2s',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.5px'
                                        }}
                                        onMouseOver={(e) => {
                                            e.target.style.transform = 'translateY(-2px)';
                                            e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
                                        }}
                                        onMouseOut={(e) => {
                                            e.target.style.transform = 'translateY(0)';
                                            e.target.style.boxShadow = 'none';
                                        }}
                                    >
                                        {ctaText}
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div style={{ padding: '40px', textAlign: 'center' }}>
                        <p>Loading results...</p>
                    </div>
                )}
            </div>

            <div className="aiq-wizard-footer">
                <div>
                    {step === 3 ? (
                        <button
                            className="aiq-btn aiq-btn-secondary"
                            onClick={() => dispatch({ type: 'RESET' })}
                            style={{ marginRight: '10px' }}
                        >
                            START OVER
                        </button>
                    ) : (
                        <button
                            className={`aiq-btn ${step === 0 ? 'aiq-btn-secondary' : 'aiq-btn-primary'}`}
                            onClick={() => step > 0 && dispatch({ type: 'PREV_STEP' })}
                            style={{ marginRight: '10px' }}
                            disabled={step === 0}
                        >
                            ← &nbsp; PREVIOUS
                        </button>
                    )}
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    {step < sections.length - 1 ? (
                        <button
                            className="aiq-btn aiq-btn-primary"
                            onClick={handleNext}
                        >
                            NEXT &nbsp; →
                        </button>
                    ) : (
                        <div className="aiq-download-dropdown" style={{ position: 'relative' }}>
                            <button
                                className="aiq-btn aiq-btn-primary"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowDownloadMenu(!showDownloadMenu);
                                }}
                                disabled={isGenerating}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                            >
                                {isGenerating ? (
                                    <>
                                        <span className="aiq-btn-spinner"></span>
                                        GENERATING...
                                    </>
                                ) : (
                                    <>
                                        DOWNLOAD RESULTS
                                        <span style={{ fontSize: '10px' }}>▼</span>
                                    </>
                                )}
                            </button>

                            {showDownloadMenu && !isGenerating && (
                                <div className="aiq-download-menu">
                                    <button
                                        className="aiq-download-option"
                                        onClick={() => handleDownloadRequest('pdf')}
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                            <polyline points="14 2 14 8 20 8"></polyline>
                                            <line x1="16" y1="13" x2="8" y2="13"></line>
                                            <line x1="16" y1="17" x2="8" y2="17"></line>
                                            <polyline points="10 9 9 9 8 9"></polyline>
                                        </svg>
                                        Download PDF Report
                                    </button>
                                    <button
                                        className="aiq-download-option"
                                        onClick={() => handleDownloadRequest('json')}
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <polyline points="16 18 22 12 16 6"></polyline>
                                            <polyline points="8 6 2 12 8 18"></polyline>
                                        </svg>
                                        Download JSON Data
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <MarketoModal
                isOpen={showMarketoModal}
                onClose={() => {
                    setShowMarketoModal(false);
                    setPendingDownloadType(null);
                }}
                onSuccess={handleMarketoSuccess}
                downloadType={pendingDownloadType === 'pdf' ? 'PDF' : 'JSON'}
                title="Download Your Assessment Results"
                assessmentData={results ? {
                    overallScore: Math.round(results.overallScore * 5),
                    maturityLevel: getScoreLabel(Math.round(results.overallScore * 5)),
                    ctiScore: results.scoresBySection?.find(s => s.section_id === 'CTI')
                        ? calculateSectionScore(results.scoresBySection.find(s => s.section_id === 'CTI'))
                        : 0,
                    dmScore: results.scoresBySection?.find(s => s.section_id === 'DM')
                        ? calculateSectionScore(results.scoresBySection.find(s => s.section_id === 'DM'))
                        : 0,
                    teScore: results.scoresBySection?.find(s => s.section_id === 'TE')
                        ? calculateSectionScore(results.scoresBySection.find(s => s.section_id === 'TE'))
                        : 0,
                    jsonData: generateMitreJSON(data, answers, results),
                    assessmentDate: new Date().toISOString(),
                    leadSource: 'INFORM Assessment - AttackIQ Website'
                } : null}
            />
        </div>
    );
};

export default WizardWrapper;
