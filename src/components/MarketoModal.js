import React, { useEffect, useRef, useState } from 'react';
const MarketoModal = ({
    isOpen,
    onClose,
    onSuccess,
    downloadType = 'PDF',
    title = 'Download Your Results',
    assessmentData = null
}) => {
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState(null);
    const modalRef = useRef(null);
    const formContainerRef = useRef(null);

    const marketoConfig = window.aiqInformData?.marketo || {};
    const { formId, instance, munchkinId } = marketoConfig;

    useEffect(() => {
        if (!isOpen || !formId) return;

        setIsLoading(true);
        setError(null);
        setIsSuccess(false);

        const loadMarketoScript = () => {
            return new Promise((resolve, reject) => {
                if (window.MktoForms2) {
                    resolve();
                    return;
                }

                const script = document.createElement('script');
                script.src = `https://${instance}/js/forms2/js/forms2.min.js`;
                script.async = true;
                script.onload = resolve;
                script.onerror = () => reject(new Error('Failed to load Marketo script'));
                document.head.appendChild(script);
            });
        };

        const initializeForm = async () => {
            try {
                await loadMarketoScript();

                setTimeout(() => {
                    if (window.MktoForms2 && formContainerRef.current) {
                        formContainerRef.current.innerHTML = `<form id="mktoForm_${formId}"></form>`;

                        window.MktoForms2.loadForm(
                            `//${instance}`,
                            munchkinId,
                            parseInt(formId, 10),
                            (form) => {
                                setIsLoading(false);

                                if (assessmentData) {
                                    const tp = assessmentData.threatProfile || {};
                                    // Multi-select Threat Profile fields land in Marketo as
                                    // semicolon-joined strings so Salesforce sees plain text
                                    // rather than a JSON array.
                                    const joinList = (v) => Array.isArray(v) ? v.join('; ') : (v || '');

                                    const hiddenValues = {
                                        INFORM_Security_Assessment__c: assessmentData.jsonData
                                            ? JSON.stringify(assessmentData.jsonData)
                                            : '',
                                        INFORM_Overall_Score__c: assessmentData.overallScore || '',
                                        INFORM_Maturity_Level__c: assessmentData.maturityLevel || '',
                                        INFORM_CTI_Score__c: assessmentData.ctiScore || '',
                                        INFORM_DM_Score__c: assessmentData.dmScore || '',
                                        INFORM_TE_Score__c: assessmentData.teScore || '',

                                        // Phase 2 — new hidden fields client team added to form 2844.
                                        INFORM_CTEM_Score__c: assessmentData.ctemScore == null ? '' : assessmentData.ctemScore,
                                        INFORM_TP_Sector__c:           tp.sector         || '',
                                        INFORM_TP_Region__c:           tp.region         || '',
                                        INFORM_TP_Revenue__c:          tp.revenueBand    || '',
                                        INFORM_TP_Headcount__c:        tp.headcountBand  || '',
                                        INFORM_TP_Regulatory__c:       joinList(tp.regulatory),
                                        INFORM_TP_DataSensitivity__c:  joinList(tp.dataSensitivity),

                                        INFORM_Assessment_Date__c: assessmentData.assessmentDate || new Date().toISOString(),
                                        INFORM_Download_Type__c: downloadType,

                                        INFORM_Assessment_Completed__c: 'true',
                                        LeadSource: assessmentData.leadSource || 'INFORM Assessment'
                                    };

                                    try {
                                        form.setValues(hiddenValues);
                                        console.log('Assessment data set for Salesforce sync:', hiddenValues);
                                    } catch (err) {
                                        console.log('Some hidden fields may not exist in Marketo form:', err);
                                    }

                                    const formElement = document.getElementById(`mktoForm_${formId}`);
                                    if (formElement) {
                                        Object.entries(hiddenValues).forEach(([key, value]) => {
                                            if (value !== '' && value !== null && value !== undefined) {
                                                let input = formElement.querySelector(`input[name="${key}"]`);
                                                if (!input) {
                                                    input = document.createElement('input');
                                                    input.type = 'hidden';
                                                    input.name = key;
                                                    formElement.appendChild(input);
                                                }
                                                input.value = value;
                                            }
                                        });
                                    }
                                }

                                form.onSuccess((values, followUpUrl) => {
                                    setIsSubmitting(true);

                                    setTimeout(() => {
                                        setIsSubmitting(false);
                                        setIsSuccess(true);
                                        setTimeout(() => {
                                            onSuccess(values);
                                        }, 1500);
                                    }, 500);

                                    return false;
                                });
                            }
                        );
                    }
                }, 100);
            } catch (err) {
                setError('Failed to load the form. Please try again.');
                setIsLoading(false);
            }
        };

        initializeForm();
    }, [isOpen, formId, instance, munchkinId, onSuccess, assessmentData, downloadType]);

    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape' && isOpen && !isSubmitting) {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [isOpen, isSubmitting, onClose]);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    if (!formId) {
        return (
            <div className="aiq-modal-overlay" onClick={onClose}>
                <div className="aiq-modal-content" onClick={(e) => e.stopPropagation()} ref={modalRef}>
                    <button className="aiq-modal-close" onClick={onClose}>&times;</button>
                    <div className="aiq-modal-body">
                        <div className="aiq-modal-message">
                            <p>Download form not configured. Please contact the administrator.</p>
                            <button className="aiq-btn aiq-btn-primary" onClick={onClose}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="aiq-modal-overlay" onClick={!isSubmitting ? onClose : undefined}>
            <div
                className="aiq-modal-content"
                onClick={(e) => e.stopPropagation()}
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
            >
                <button
                    className="aiq-modal-close"
                    onClick={onClose}
                    disabled={isSubmitting}
                    aria-label="Close modal"
                >
                    &times;
                </button>

                <div className="aiq-modal-header">
                    <h2 id="modal-title">{title}</h2>
                    <p className="aiq-modal-subtitle">
                        Fill out the form below to download your {downloadType} report.
                    </p>
                </div>

                <div className="aiq-modal-body">
                    {isLoading && (
                        <div className="aiq-modal-loading">
                            <div className="aiq-spinner"></div>
                            <p>Loading form...</p>
                        </div>
                    )}

                    {error && (
                        <div className="aiq-modal-error">
                            <p>{error}</p>
                            <button className="aiq-btn aiq-btn-secondary" onClick={onClose}>
                                Close
                            </button>
                        </div>
                    )}

                    {isSubmitting && (
                        <div className="aiq-modal-loading">
                            <div className="aiq-spinner"></div>
                            <p>Submitting...</p>
                        </div>
                    )}

                    {isSuccess && (
                        <div className="aiq-modal-success">
                            <div className="aiq-success-icon">&#10003;</div>
                            <h3>Thank You!</h3>
                            <p>Your download is starting automatically...</p>
                            <p className="aiq-modal-hint">
                                If the download doesn't start, <button
                                    className="aiq-link-button"
                                    onClick={() => onSuccess({})}
                                >
                                    click here
                                </button> to try again.
                            </p>
                        </div>
                    )}

                    <div
                        ref={formContainerRef}
                        className="aiq-marketo-form-container"
                        style={{
                            display: isLoading || isSubmitting || isSuccess || error ? 'none' : 'block'
                        }}
                    />
                </div>
            </div>
        </div>
    );
};

export default MarketoModal;
