import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useAssessment } from '../context/AssessmentContext';
import QuestionBlock from './QuestionBlock';
import { processResults, calculateSectionScore, getScoreLabel } from '../utils/scoring';
import RadarChart from './RadarChart';
import ImpactComplexityMatrix from './ImpactComplexityMatrix';
import { createDownloadToken, generatePDF } from '../utils/pdfGenerator';
import { generateMitreJSON } from '../utils/jsonGenerator';
import { submitResults, buildThreatProfile } from '../utils/api';
import { buildRecommendationGroups } from '../utils/recommendationEngine';
import { historicalSectionDisplayScore } from '../utils/comparisonEngine';
import HistoricalUpload from './HistoricalUpload';
import MarketoModal from './MarketoModal';

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

const SECTION_VISUALS = {
    CTI:  { tab: '#ffcc00',           bg: '#ffcc00', text: '#000', label: 'CTI'  },
    DM:   { tab: '#36bae4',           bg: '#36bae4', text: '#000', label: 'DM'   },
    TE:   { tab: '#f02c68',           bg: '#f02c68', text: '#fff', label: 'TE'   },
    CTEM: { tab: '#7b3ff2',           bg: '#7b3ff2', text: '#fff', label: 'CTEM' },
    TP:   { tab: BRAND_COLORS.accent, bg: BRAND_COLORS.accent, text: '#fff', label: 'TP' }
};

const SECTION_TAB_LABELS = {
    CTI:  'Cyber Threat Intelligence',
    DM:   'Defensive Measures',
    TE:   'Test & Evaluation',
    CTEM: 'CTEM',
    TP:   'Threat Profile'
};

const RESULTS_STEP_KEY = 'RESULTS';
const isSectionEntry = (entry) => Boolean(entry && entry.section_id && Array.isArray(entry.questions));

const WizardWrapper = () => {
    const { state, dispatch } = useAssessment();
    const { step, data, answers, ctemSkipped } = state;
    const [isGenerating, setIsGenerating] = useState(false);
    const [showMarketoModal, setShowMarketoModal] = useState(false);
    const [pendingDownloadType, setPendingDownloadType] = useState(null);
    const [downloadToken, setDownloadToken] = useState(null);
    const [downloadSubmissionId, setDownloadSubmissionId] = useState(null);
    const [autoDownloadRequested, setAutoDownloadRequested] = useState(false);
    const [userEmail, setUserEmail] = useState(null);
    const [showDownloadMenu, setShowDownloadMenu] = useState(false);
    const [historicalResults, setHistoricalResults] = useState([]);
    const [copiedResubmissionLink, setCopiedResubmissionLink] = useState(false);
    const wizardHeaderRef = useRef(null);
    const containerRef = useRef(null);
    const isInitialMount = useRef(true);

    const config = window.aiqInformData || {};
    const marketoConfig = config.marketo || {};
    const gateDownloads = marketoConfig.gateDownloads && marketoConfig.formId;
    const ctaUrl = config.contactUrl || '';
    const ctaText = config.contactButtonText || 'Improve Your Score';
    const showResubmissionLink = Boolean(config.showResubmissionLink);

    const buildResubmissionLink = useCallback((token) => {
        if (!token || typeof window === 'undefined') {
            return '';
        }

        return `${window.location.origin}${window.location.pathname}?download_token=${encodeURIComponent(token)}`;
    }, []);

    const resubmissionLink = useMemo(() => buildResubmissionLink(downloadToken), [buildResubmissionLink, downloadToken]);

    const handleCopyResubmissionLink = useCallback(async () => {
        if (!resubmissionLink) {
            return;
        }

        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(resubmissionLink);
            } else {
                const textarea = document.createElement('textarea');
                textarea.value = resubmissionLink;
                textarea.setAttribute('readonly', '');
                textarea.style.position = 'fixed';
                textarea.style.left = '-9999px';
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
            }

            setCopiedResubmissionLink(true);
            window.setTimeout(() => setCopiedResubmissionLink(false), 2000);
        } catch (err) {
            console.error('Unable to copy resubmission link', err);
        }
    }, [resubmissionLink]);

    const sectionEntries = useMemo(
        () => (Array.isArray(data) ? data.filter(isSectionEntry) : []),
        [data]
    );

    const sections = useMemo(() => {
        const ids = sectionEntries.map(s => s.section_id);
        return [...ids, RESULTS_STEP_KEY];
    }, [sectionEntries]);

    const totalSteps = sections.length;
    const lastQuestionStep = totalSteps - 1;
    const isResultsStep = step === lastQuestionStep;
    const currentSectionKey = sections[step];
    const currentSection = sectionEntries.find(s => s.section_id === currentSectionKey);
    const currentQuestions = currentSection ? currentSection.questions : [];

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

    const results = isResultsStep ? processResults(data, answers, { ctemSkipped }) : null;
    const recommendationGroups = useMemo(
        () => (results ? buildRecommendationGroups(data, answers, { ctemSkipped }) : []),
        [results, data, answers, ctemSkipped]
    );

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

    const ensureDownloadSubmission = useCallback(async () => {
        const finalResults = results || processResults(data, answers, { ctemSkipped });
        const recs = recommendationGroups.length
            ? recommendationGroups
            : buildRecommendationGroups(data, answers, { ctemSkipped });

        let token = downloadToken;
        if (!token) {
            token = createDownloadToken();
            setDownloadToken(token);
        }

        const expiryDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        const response = await submitResults(answers, finalResults, {
            data,
            ctemSkipped,
            lead: userEmail ? { email: userEmail } : {},
            recommendations: recs,
            download_token: token,
            download_token_expires_at: expiryDate,
        });

        if (response && response.success) {
            if (response.submission_id) {
                setDownloadSubmissionId(response.submission_id);
            }
            if (response.download_token) {
                token = response.download_token;
                setDownloadToken(token);
            }
        }

        return token;
    }, [answers, ctemSkipped, data, downloadToken, recommendationGroups, results, userEmail]);

    const handleNext = async () => {
        if (step === lastQuestionStep - 1) {
            await ensureDownloadSubmission();
        }

        dispatch({ type: 'NEXT_STEP' });
    };

    const downloadPDF = useCallback(async () => {
        setIsGenerating(true);
        try {
            await generatePDF('aiq-results-print-area', 'AttackIQ-INFORM-Assessment-Report.pdf', {
                results,
                overallLevel: overallScoreLevel,
                overallLabel: overallScoreLabel,
                calculateSectionScore,
                recommendationGroups,
                threatProfile: buildThreatProfile(data, answers),
            });
        } catch (err) {
            console.error('PDF generation error:', err);
        }
        setIsGenerating(false);
        setShowDownloadMenu(false);
    }, [results, overallScoreLevel, overallScoreLabel, recommendationGroups]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const searchParams = new URLSearchParams(window.location.search);
        const token = searchParams.get('download_token') || searchParams.get('token') || searchParams.get('ref');
        if (!token || token === downloadToken) {
            return;
        }

        const fetchSubmission = async () => {
            setIsGenerating(true);
            try {
                const response = await fetch(`${config.rest_url.replace(/\/$/, '')}/download-token/${encodeURIComponent(token)}`);
                if (!response.ok) {
                    throw new Error(`Token lookup failed with ${response.status}`);
                }
                const body = await response.json();
                if (!body.success || !body.submission) {
                    throw new Error('Invalid submission token response');
                }

                setDownloadToken(token);
                if (body.submission.id) {
                    setDownloadSubmissionId(body.submission.id);
                }
                if (body.submission.answers) {
                    dispatch({ type: 'SET_ANSWERS', answers: body.submission.answers });
                }
                dispatch({ type: 'GO_TO_STEP', step: lastQuestionStep });
                setAutoDownloadRequested(true);
            } catch (err) {
                console.error('Download token fetch error:', err);
                setIsGenerating(false);
            }
        };

        fetchSubmission();
    }, [config.rest_url, downloadToken, lastQuestionStep, dispatch, data]);

    useEffect(() => {
        if (!autoDownloadRequested || !results) {
            return;
        }

        const runDownload = async () => {
            await downloadPDF();
            setAutoDownloadRequested(false);
        };

        runDownload();
    }, [autoDownloadRequested, results, downloadPDF]);

    const downloadJSON = useCallback(() => {
        if (!results || !data) return;

        try {
            const jsonData = generateMitreJSON(data, answers, { ctemSkipped });
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
    }, [results, data, answers, ctemSkipped]);

    const handleDownloadRequest = async (type) => {
        if (gateDownloads && !userEmail) {
            setPendingDownloadType(type);
            await ensureDownloadSubmission();
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

    const visibleScoredSections = (results?.scoresBySection || []).filter(s => s.scored);

    const renderSectionTabLabel = (sec, idx) => {
        if (sec === RESULTS_STEP_KEY) return `${idx + 1}. Results`;
        const labelText = SECTION_TAB_LABELS[sec] || sec;
        return `${idx + 1}. ${labelText}`;
    };

    const renderCtemSkipBanner = () => {
        if (currentSectionKey !== 'CTEM') return null;
        return (
            <div
                className="aiq-ctem-skip-banner"
                style={{
                    gridColumn: '1 / -1',
                    marginBottom: '24px',
                    padding: '16px 18px',
                    background: ctemSkipped ? '#f5f5f5' : '#f8f5fc',
                    border: `1px solid ${ctemSkipped ? '#ddd' : '#e2d4f1'}`,
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px'
                }}
            >
                <input
                    id="aiq-ctem-skip-checkbox"
                    type="checkbox"
                    checked={ctemSkipped}
                    onChange={(e) => dispatch({ type: 'SET_CTEM_SKIPPED', value: e.target.checked })}
                    style={{ marginTop: '4px', accentColor: BRAND_COLORS.primary }}
                />
                <label htmlFor="aiq-ctem-skip-checkbox" style={{ flex: 1, cursor: 'pointer', fontSize: '14px', lineHeight: '1.5', color: BRAND_COLORS.text }}>
                    <strong>Skip CTEM Assessment.</strong>{' '}
                    Exclude CTEM from your overall maturity score, the impact / complexity matrix, recommendations, and the radar chart. Useful if your organisation does not yet treat CTEM as a distinct discipline.
                </label>
            </div>
        );
    };

    const renderCtemSkippedNote = () => (
        <div
            style={{
                gridColumn: '1 / -1',
                padding: '32px',
                background: '#f8f8f8',
                border: '1px dashed #ccc',
                borderRadius: '6px',
                color: BRAND_COLORS.textLight,
                fontSize: '14px',
                lineHeight: '1.6'
            }}
        >
            CTEM has been excluded from your assessment. Uncheck <em>Skip CTEM Assessment</em> above if you want to answer this section and have it factor into your maturity score.
        </div>
    );

    const renderPdfLoader = () => (
        <div className="aiq-pdf-loader-overlay" role="status" aria-live="polite" aria-label="Generating PDF report">
            <div className="aiq-pdf-loader-card">
                <div className="aiq-pdf-loader-mark" aria-hidden="true">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
                <div className="aiq-pdf-loader-copy">
                    <p className="aiq-pdf-loader-kicker">Building PDF report</p>
                    <h2>Preparing your INFORM assessment</h2>
                </div>
                <div className="aiq-pdf-loader-rail" aria-hidden="true">
                    <span></span>
                </div>
            </div>
        </div>
    );

    return (
        <div className="aiq-assessment-container" ref={containerRef}>
            {isGenerating && renderPdfLoader()}
            <div className="aiq-wizard-header" ref={wizardHeaderRef}>
                <ul className="aiq-steps-nav">
                    {sections.map((sec, idx) => {
                        const visuals = SECTION_VISUALS[sec];
                        const tabAccent = visuals ? visuals.tab : BRAND_COLORS.primaryDark;
                        const isActive = idx === step;
                        const isCompleted = idx < step;

                        let tabStyle = {};
                        if (isActive) {
                            tabStyle = { borderBottomColor: tabAccent, color: '#000' };
                        } else {
                            tabStyle = { color: isCompleted ? BRAND_COLORS.primary : '#666', cursor: 'pointer' };
                        }

                        const handleTabClick = () => {
                            if (idx === step) return;

                            if (idx === lastQuestionStep && step < lastQuestionStep) {
                                ensureDownloadSubmission().then(token => {
                                    if (token) console.log('Results Saved!');
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
                                {renderSectionTabLabel(sec, idx)}
                            </li>
                        );
                    })}
                </ul>
                <div className="aiq-reset-link" onClick={() => dispatch({ type: 'RESET' })}>
                    <span style={{ fontSize: '20px' }}>⟳</span> Reset Answers
                </div>
            </div>

            <div className="aiq-wizard-content">
                {!isResultsStep ? (
                    <div className="aiq-wizard-step">
                        {renderCtemSkipBanner()}
                        {currentSectionKey === 'CTEM' && ctemSkipped ? (
                            renderCtemSkippedNote()
                        ) : (
                            currentQuestions.map(q => (
                                <QuestionBlock
                                    key={q.uid || q.componentKey}
                                    question={q}
                                />
                            ))
                        )}
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
                                    {ctemSkipped && (
                                        <span style={{ marginLeft: '10px', fontStyle: 'italic', color: '#e5dfec' }}>
                                            · CTEM excluded from scoring
                                        </span>
                                    )}
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

                            {visibleScoredSections.map((section) => {
                                const visuals = SECTION_VISUALS[section.section_id] || { bg: '#ccc', text: '#000', label: section.section_id };
                                const sectionScore = calculateSectionScore(section);

                                return (
                                    <div key={section.section_id} style={{ marginBottom: '15px' }}>
                                        <div className={`aiq-section-${(section.section_id || '').toLowerCase()}`} style={{
                                            background: visuals.bg,
                                            color: visuals.text,
                                            padding: '8px 14px',
                                            fontWeight: '700',
                                            fontSize: '13px',
                                            marginBottom: '8px',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            borderRadius: '4px'
                                        }}>
                                            <span>{visuals.label} - {section.shortname || section.name}</span>
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

                                                const headingText = q.heading || '';
                                                return (
                                                    <div key={q.uid} style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        padding: '4px 0',
                                                        borderBottom: '1px solid #f0f0f0'
                                                    }}>
                                                        <span style={{ flex: 1, paddingRight: '10px', color: isNA ? '#bbb' : BRAND_COLORS.textLight, fontStyle: isNA ? 'italic' : 'normal' }}>
                                                            {q.uid} - {headingText.substring(0, 45)}{headingText.length > 45 ? '...' : ''}
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
                            <div id="aiq-matrix-container">
                                <ImpactComplexityMatrix results={results} />
                            </div>

                            <div id="aiq-radar-chart-container" style={{
                                width: '100%',
                                maxWidth: '450px',
                                margin: '30px auto 30px'
                            }}>
                                <RadarChart scores={results} historical={historicalResults} />
                            </div>

                            {historicalResults.length > 0 && (
                                <div className="aiq-historical-table-wrapper" style={{ marginTop: '20px', overflowX: 'auto' }}>
                                    <h4 style={{ fontSize: '14px', margin: '0 0 10px 0', color: BRAND_COLORS.navy, fontWeight: '700' }}>
                                        Score Comparison
                                    </h4>
                                    <table style={{
                                        width: '100%',
                                        borderCollapse: 'collapse',
                                        fontSize: '12px',
                                        background: '#fff',
                                        border: '1px solid #e0e0e0',
                                        borderRadius: '4px',
                                        overflow: 'hidden'
                                    }}>
                                        <thead>
                                            <tr style={{ background: BRAND_COLORS.background }}>
                                                <th style={{ padding: '8px 10px', borderBottom: '1px solid #e0e0e0', textAlign: 'left' }}>Section</th>
                                                {historicalResults.map((rec, idx) => {
                                                    const date = rec.downloadedDate ? new Date(rec.downloadedDate) : null;
                                                    const label = date && !Number.isNaN(date.getTime())
                                                        ? date.toLocaleDateString()
                                                        : `Previous ${idx + 1}`;
                                                    return (
                                                        <th key={idx} style={{ padding: '8px 10px', borderBottom: '1px solid #e0e0e0', textAlign: 'center' }}>
                                                            {label}
                                                        </th>
                                                    );
                                                })}
                                                <th style={{ padding: '8px 10px', borderBottom: '1px solid #e0e0e0', textAlign: 'center', background: BRAND_COLORS.primary, color: '#fff' }}>Today</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {results.scoresBySection.filter(s => s.scored).map(section => {
                                                const todaysLevel = calculateSectionScore(section);
                                                return (
                                                    <tr key={section.section_id}>
                                                        <td style={{ padding: '8px 10px', borderBottom: '1px solid #f0f0f0', fontWeight: '600' }}>
                                                            {section.shortname || section.section_id}
                                                        </td>
                                                        {historicalResults.map((rec, idx) => {
                                                            const match = (rec.sections || []).find(s => s.section_id === section.section_id);
                                                            const displayScore = historicalSectionDisplayScore(match);
                                                            const display = displayScore == null ? '—' : displayScore;
                                                            return (
                                                                <td key={idx} style={{ padding: '8px 10px', borderBottom: '1px solid #f0f0f0', textAlign: 'center', color: display === '—' ? '#bbb' : BRAND_COLORS.text }}>
                                                                    {display}
                                                                </td>
                                                            );
                                                        })}
                                                        <td style={{ padding: '8px 10px', borderBottom: '1px solid #f0f0f0', textAlign: 'center', fontWeight: '700', color: BRAND_COLORS.primary }}>
                                                            {todaysLevel < 0 ? '—' : todaysLevel}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
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
                    {isResultsStep ? (
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
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    {!isResultsStep ? (
                        <button
                            className="aiq-btn aiq-btn-primary"
                            onClick={handleNext}
                        >
                            NEXT &nbsp; →
                        </button>
                    ) : (
                        <>
                        <HistoricalUpload compact data={data} onChange={setHistoricalResults} />
                        <div className="aiq-download-dropdown" style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', alignItems: 'stretch' }}>
                            <button
                                className="aiq-btn aiq-btn-primary"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowDownloadMenu(!showDownloadMenu);
                                }}
                                disabled={isGenerating}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
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
                            {recommendationGroups.length > 0 && (
                                <span style={{
                                    display: 'block',
                                    marginTop: '6px',
                                    fontSize: '10px',
                                    color: BRAND_COLORS.textLight,
                                    fontStyle: 'italic',
                                    lineHeight: '1.3',
                                    textAlign: 'center'
                                }}>
                                    PDF includes tailored recommendations &amp; next steps
                                </span>
                            )}
                        </div>
                        </>
                    )}
                </div>
            </div>

            {showResubmissionLink && isResultsStep && resubmissionLink && (
                <div style={{
                    marginTop: '16px',
                    padding: '12px 14px',
                    border: '1px solid #e2d4f1',
                    background: '#f8f5fc',
                    borderRadius: '8px',
                    maxWidth: '760px',
                    textAlign: 'left'
                }}>
                    <div style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        color: BRAND_COLORS.primary,
                        marginBottom: '6px'
                    }}>
                        Test resubmission link
                    </div>
                    <div style={{
                        fontSize: '12px',
                        wordBreak: 'break-all',
                        lineHeight: '1.4',
                        marginBottom: '8px'
                    }}>
                        <a href={resubmissionLink} target="_blank" rel="noreferrer" style={{ color: BRAND_COLORS.primary, textDecoration: 'underline' }}>
                            {resubmissionLink}
                        </a>
                    </div>
                    <button
                        className="aiq-btn aiq-btn-secondary"
                        onClick={handleCopyResubmissionLink}
                        style={{ padding: '6px 10px', fontSize: '12px' }}
                    >
                        {copiedResubmissionLink ? 'Copied!' : 'Copy link'}
                    </button>
                </div>
            )}

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
                    ctemScore: ctemSkipped ? null : (
                        results.scoresBySection?.find(s => s.section_id === 'CTEM')
                            ? calculateSectionScore(results.scoresBySection.find(s => s.section_id === 'CTEM'))
                            : 0
                    ),
                    ctemSkipped,
                    threatProfile: buildThreatProfile(data, answers),
                    jsonData: generateMitreJSON(data, answers, { ctemSkipped }),
                    assessmentDate: new Date().toISOString(),
                    leadSource: 'INFORM Assessment - AttackIQ Website',
                    downloadToken,
                    submissionId: downloadSubmissionId,
                } : null}
            />
        </div>
    );
};

export default WizardWrapper;
