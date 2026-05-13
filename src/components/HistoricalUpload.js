import React, { useRef, useState, useCallback } from 'react';
import {
    parseHistoricalFile,
    expectedSectionIds,
    sortByDate,
    MAX_FILES,
} from '../utils/comparisonEngine';

const BRAND = {
    primary: '#40008f',
    primaryDark: '#2d0064',
    text: '#333',
    muted: '#65616b',
    border: '#ddd',
    soft: '#f8f5fc',
};

const HistoricalUpload = ({ data, onChange, compact = false }) => {
    const fileInputRef = useRef(null);
    const [errors, setErrors] = useState([]);
    const [compatNote, setCompatNote] = useState(false);
    const [count, setCount] = useState(0);

    const triggerPicker = useCallback(() => {
        if (fileInputRef.current) fileInputRef.current.click();
    }, []);

    const handleFileChange = useCallback(async (event) => {
        const fileList = Array.from(event.target.files || []);
        if (fileList.length === 0) return;

        if (fileList.length > MAX_FILES) {
            setErrors([`You uploaded ${fileList.length} files. Up to ${MAX_FILES} are supported.`]);
            setCount(0);
            onChange([]);
            event.target.value = '';
            return;
        }

        const sectionIds = expectedSectionIds(data);
        const parsed = [];
        const localErrors = [];
        let anyCompat = false;

        for (const file of fileList) {
            const text = await file.text();
            const result = parseHistoricalFile(text, sectionIds);
            if (result?.error) {
                localErrors.push(`${file.name}: file format not recognized`);
                continue;
            }
            if (result.compatNote) anyCompat = true;
            parsed.push(result);
        }

        const sorted = sortByDate(parsed);
        setErrors(localErrors);
        setCompatNote(anyCompat);
        setCount(sorted.length);
        onChange(sorted);

        event.target.value = '';
    }, [data, onChange]);

    const handleClear = useCallback(() => {
        setErrors([]);
        setCompatNote(false);
        setCount(0);
        onChange([]);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, [onChange]);

    const tooltipText = `Filled out this assessment before? Upload up to ${MAX_FILES} previous JSON exports to see how your scores changed over time. Missing sections in older files (for example, before CTEM was added) will appear as N/A.`;

    if (compact) {
        return (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span
                    className="aiq-upload-info-icon"
                    data-tooltip={tooltipText}
                    aria-label="About uploading previous assessments"
                >i</span>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/json"
                    multiple
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                />
                <button
                    type="button"
                    className="aiq-btn aiq-btn-secondary"
                    onClick={triggerPicker}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                    UPLOAD PREVIOUS
                </button>
                
                {count > 0 && (
                    <>
                        <span style={{ fontSize: '12px', color: BRAND.text }}>
                            {count} loaded
                        </span>
                        <button
                            type="button"
                            onClick={handleClear}
                            style={{
                                padding: '4px 8px',
                                fontSize: '12px',
                                background: 'transparent',
                                color: BRAND.muted,
                                border: `1px solid ${BRAND.border}`,
                                borderRadius: '4px',
                                cursor: 'pointer',
                            }}
                        >
                            Clear
                        </button>
                    </>
                )}
                {errors.length > 0 && (
                    <div style={{ flexBasis: '100%', marginTop: '6px', padding: '6px 10px', background: '#fff0f0', border: '1px solid #f5c2c7', borderRadius: '4px', fontSize: '12px', color: '#842029' }}>
                        {errors.map((e, i) => <div key={i}>Error: {e}</div>)}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="aiq-historical-upload" style={{
            marginTop: '24px',
            padding: '16px 18px',
            background: BRAND.soft,
            border: `1px solid #e2d4f1`,
            borderRadius: '6px',
        }}>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: '700', color: BRAND.primaryDark }}>
                Compare with previous assessments
            </h3>
            <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: BRAND.muted, lineHeight: '1.5' }}>
                Filled out this assessment before? Upload up to {MAX_FILES} previous JSON
                exports to see how your scores changed over time. Missing sections in older
                files (for example, before CTEM was added) will appear as N/A.
            </p>

            <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                multiple
                onChange={handleFileChange}
                style={{ display: 'none' }}
            />

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                    type="button"
                    className="aiq-btn aiq-btn-primary"
                    onClick={triggerPicker}
                    style={{
                        padding: '8px 16px',
                        fontSize: '13px',
                        fontWeight: '600',
                        background: BRAND.primary,
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                    }}
                >
                    Upload JSON
                </button>
                {count > 0 && (
                    <>
                        <span style={{ fontSize: '13px', color: BRAND.text }}>
                            {count} {count === 1 ? 'file' : 'files'} loaded
                        </span>
                        <button
                            type="button"
                            onClick={handleClear}
                            style={{
                                padding: '6px 12px',
                                fontSize: '12px',
                                background: 'transparent',
                                color: BRAND.muted,
                                border: `1px solid ${BRAND.border}`,
                                borderRadius: '4px',
                                cursor: 'pointer',
                            }}
                        >
                            Clear
                        </button>
                    </>
                )}
            </div>

            {errors.length > 0 && (
                <div style={{ marginTop: '12px', padding: '10px 12px', background: '#fff0f0', border: '1px solid #f5c2c7', borderRadius: '4px', fontSize: '12px', color: '#842029' }}>
                    {errors.map((e, i) => <div key={i}>Error: {e}</div>)}
                </div>
            )}

            {compatNote && (
                <p style={{ marginTop: '12px', marginBottom: 0, fontSize: '12px', color: BRAND.muted, fontStyle: 'italic' }}>
                    One or more uploaded files predates the current assessment shape.
                    Missing sections appear as N/A in the comparison.
                </p>
            )}
        </div>
    );
};

export default HistoricalUpload;
