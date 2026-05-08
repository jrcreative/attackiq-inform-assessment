import React, { useState } from 'react';

const ImpactComplexityMatrix = ({ results }) => {
    const [hoveredItem, setHoveredItem] = useState(null);
    const rows = [3, 2, 1];
    const cols = [1, 2, 3];

    const impactLabels = { 3: 'High', 2: 'Medium', 1: 'Low' };
    const complexityLabels = { 1: 'Low', 2: 'Medium', 3: 'High' };

    const sectionColorMap = {
        'CTI': {
            highest: { bg: '#ffcc00', border: '#e6b800', text: '#000' },
            selected: { bg: '#fff3cc', border: '#e6b800', text: '#8a6d00' },
        },
        'DM': {
            highest: { bg: '#36bae4', border: '#2a9bbf', text: '#000' },
            selected: { bg: '#d6f0fa', border: '#2a9bbf', text: '#1a6e8a' },
        },
        'TE': {
            highest: { bg: '#f02c68', border: '#d41e56', text: '#fff' },
            selected: { bg: '#fdd6e3', border: '#d41e56', text: '#a01040' },
        },
        'CTEM': {
            highest: { bg: '#7b3ff2', border: '#5a23bf', text: '#fff' },
            selected: { bg: '#ece1ff', border: '#5a23bf', text: '#3f1d8a' },
        }
    };

    const getCellContent = (impact, complexity) => {
        const key = `i-${impact}_c-${complexity}`;
        const items = results.impactComplexityMap.get(key) || [];

        return items.map((item, idx) => {
            const section = item.section_id || (item.componentKey || '').split('.')[0];
            const colors = sectionColorMap[section] || sectionColorMap['CTI'];

            let bgColor = '#fff';
            let borderColor = '#999';
            let textColor = '#666';
            let hasCheck = false;
            let borderStyle = 'dashed';

            if (item.selected && item.highestValue) {
                bgColor = colors.highest.bg;
                borderColor = colors.highest.border;
                textColor = colors.highest.text;
                hasCheck = true;
                borderStyle = 'solid';
            } else if (item.selected) {
                bgColor = colors.selected.bg;
                borderColor = colors.selected.border;
                textColor = colors.selected.text;
                borderStyle = 'solid';
            }

            const displayKey = item.uid || item.componentKey;
            const itemId = `${impact}-${complexity}-${idx}`;
            const isHovered = hoveredItem === itemId;

            const tooltipTitle = `${displayKey} - ${item.heading}`;
            let tooltipDesc = '';
            if (item.selected && item.highestValue) {
                tooltipDesc = 'This is the highest possible score for this component';
            } else if (item.selected) {
                tooltipDesc = item.choiceDescription || 'Current score selection (not the highest possible value)';
            } else {
                tooltipDesc = item.choiceDescription || 'Suggested level that has not been selected';
            }

            return (
                <span
                    key={idx}
                    className="aiq-matrix-item-wrapper"
                    onMouseEnter={() => setHoveredItem(itemId)}
                    onMouseLeave={() => setHoveredItem(null)}
                    style={{
                        position: 'relative',
                        display: 'inline-block',
                    }}
                >
                    <span
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '3px 8px',
                            margin: '2px',
                            fontSize: '11px',
                            fontWeight: '600',
                            background: bgColor,
                            color: textColor,
                            border: `1px ${borderStyle} ${borderColor}`,
                            borderRadius: '2px',
                            cursor: 'pointer'
                        }}
                    >
                        {hasCheck && '✓ '}{displayKey}
                    </span>
                    {isHovered && (
                        <div className="aiq-matrix-tooltip">
                            <div className="aiq-matrix-tooltip-title">{tooltipTitle}</div>
                            <div className="aiq-matrix-tooltip-desc">{tooltipDesc}</div>
                        </div>
                    )}
                </span>
            );
        });
    };

    return (
        <div className="aiq-matrix-container">
            <h3 style={{ textAlign: 'center', marginBottom: '20px' }}>Impact / Complexity Matrix</h3>
            <div className="aiq-matrix-wrapper">
                <div className="aiq-matrix-grid">
                    <div className="aiq-matrix-header-spacer"></div>
                    {cols.map(c => (
                        <div key={c} className="aiq-matrix-header-col">{complexityLabels[c]} Complexity</div>
                    ))}

                    {rows.map(r => (
                        <React.Fragment key={r}>
                            <div className="aiq-matrix-header-row">{impactLabels[r]} Impact</div>

                            {cols.map(c => (
                                <div key={`${r}-${c}`} className={`aiq-matrix-cell cell-i${r}-c${c}`}>
                                    {getCellContent(r, c)}
                                </div>
                            ))}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            <style jsx>{`
                .aiq-matrix-container {
                    margin: 40px 0;
                }
                .aiq-matrix-wrapper {
                    display: grid;
                    grid-template-rows: 1fr 30px;
                    gap: 10px;
                }
                .aiq-axis-y-label {
                    writing-mode: vertical-rl;
                    transform: rotate(180deg);
                    text-align: center;
                    font-weight: bold;
                    color: #666;
                }
                .aiq-axis-x-label {
                    grid-column: 2;
                    text-align: center;
                    font-weight: bold;
                    color: #666;
                }
                .aiq-matrix-grid {
                    display: grid;
                    grid-template-columns: 90px 1fr 1fr 1fr; /* Header + 3 cols */
                    gap: 2px; /* Borders via gap? */
                    background: #fff;
                }
                .aiq-matrix-header-col {
                    text-align: center;
                    font-weight: 600;
                    padding: 10px;
                    background: #f5f5f5;
                }
                .aiq-matrix-header-row {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 600;
                    background: #f5f5f5;
                    padding: 0 10px;
                }
                .aiq-matrix-cell {
                    border: 1px solid #eee;
                    padding: 10px;
                    min-height: 100px;
                    background: #fff;
                }
                /* Quadrant Colors (Optional) */
                .cell-i3-c1 { background: rgba(255, 77, 77, 0.1); } /* High Impact, Low Complexity (Quick Wins) */

                .aiq-matrix-item {
                    font-size: 11px;
                    background: #eee;
                    padding: 2px 6px;
                    border-radius: 4px;
                    margin-bottom: 4px;
                    display: inline-block;
                    margin-right: 4px;
                    cursor: help;
                }
                    .aiq-matrix-highest {
                        background: #2a1b5c;
                        color: white;
                        font-weight: bold;
                    }
                    .aiq-matrix-item-wrapper {
                        position: relative;
                        z-index: 1;
                    }
                    .aiq-matrix-item-wrapper:hover {
                        z-index: 100;
                    }
                    .aiq-matrix-tooltip {
                        position: absolute;
                        bottom: calc(100% + 8px);
                        left: 50%;
                        transform: translateX(-50%);
                        background: #f5f5f5;
                        border: 1px solid #ddd;
                        border-radius: 4px;
                        padding: 10px 14px;
                        min-width: 240px;
                        max-width: 320px;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                        z-index: 1000;
                        pointer-events: none;
                        animation: aiq-matrix-tooltip-fade 0.15s ease-out;
                    }
                    .aiq-matrix-tooltip::after {
                        content: '';
                        position: absolute;
                        top: 100%;
                        left: 50%;
                        transform: translateX(-50%);
                        border: 6px solid transparent;
                        border-top-color: #ddd;
                    }
                    .aiq-matrix-tooltip::before {
                        content: '';
                        position: absolute;
                        top: 100%;
                        left: 50%;
                        transform: translateX(-50%);
                        border: 5px solid transparent;
                        border-top-color: #f5f5f5;
                        z-index: 1;
                    }
                    .aiq-matrix-tooltip-title {
                        font-size: 12px;
                        font-weight: 700;
                        color: #333;
                        margin-bottom: 4px;
                        white-space: nowrap;
                    }
                    .aiq-matrix-tooltip-desc {
                        font-size: 11px;
                        font-weight: 400;
                        color: #555;
                        line-height: 1.4;
                        white-space: normal;
                    }
                    @keyframes aiq-matrix-tooltip-fade {
                        from {
                            opacity: 0;
                            transform: translateX(-50%) translateY(4px);
                        }
                        to {
                            opacity: 1;
                            transform: translateX(-50%) translateY(0);
                        }
                    }
                `}</style>

            <div style={{ marginTop: '30px', padding: '20px', border: '1px solid #ddd', background: '#fafafa' }}>
                <h4 style={{ margin: '0 0 15px 0', fontSize: '16px', fontWeight: '700' }}>Matrix Key</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                            {[
                                { bg: '#ffcc00', text: '#000', label: '✓ CTI' },
                                { bg: '#36bae4', text: '#000', label: '✓ DM' },
                                { bg: '#f02c68', text: '#fff', label: '✓ TE' },
                                { bg: '#7b3ff2', text: '#fff', label: '✓ CTEM' }
                            ].map(c => (
                                <div key={c.label} style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: c.bg,
                                    color: c.text,
                                    padding: '4px 8px',
                                    borderRadius: '3px',
                                    fontWeight: '600',
                                    fontSize: '11px',
                                    textAlign: 'center'
                                }}>
                                    {c.label}
                                </div>
                            ))}
                        </div>
                        <span>Highest possible impact complexity score</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                            {[
                                { bg: '#fff3cc', border: '#e6b800', text: '#8a6d00', label: 'CTI' },
                                { bg: '#d6f0fa', border: '#2a9bbf', text: '#1a6e8a', label: 'DM' },
                                { bg: '#fdd6e3', border: '#d41e56', text: '#a01040', label: 'TE' },
                                { bg: '#ece1ff', border: '#5a23bf', text: '#3f1d8a', label: 'CTEM' }
                            ].map(c => (
                                <div key={c.label} style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: c.bg,
                                    color: c.text,
                                    padding: '4px 8px',
                                    border: `1px solid ${c.border}`,
                                    borderRadius: '3px',
                                    fontWeight: '600',
                                    fontSize: '11px',
                                    textAlign: 'center'
                                }}>
                                    {c.label}
                                </div>
                            ))}
                        </div>
                        <span>Current score selection (not the highest possible value)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            lineHeight: '1.2',
                            background: '#fff',
                            color: '#666',
                            padding: '4px 10px',
                            border: '1px dashed #999',
                            borderRadius: '3px',
                            fontWeight: '600',
                            minWidth: '60px',
                            textAlign: 'center',
                            fontSize: '11px'
                        }}>
                            EX.3
                        </div>
                        <span>Suggested levels that have not been selected</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ImpactComplexityMatrix;
