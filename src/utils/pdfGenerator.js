import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { getScoreLabel } from './scoring';

const SECTION_COLORS = {
    CTI:  { rgb: [255, 204, 0],  textRgb: [0, 0, 0]   },
    DM:   { rgb: [54, 186, 228], textRgb: [0, 0, 0]   },
    TE:   { rgb: [240, 44, 104], textRgb: [255, 255, 255] },
    CTEM: { rgb: [123, 63, 242], textRgb: [255, 255, 255] }
};

const SECTION_WEIGHTS = { CTI: '28%', DM: '32%', TE: '20%', CTEM: '20%' };

const getQuestionScore = (q) => {
    if (q.isNotApplicable) return -1;
    if (!q.hasAnswer) return 0;
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

export const generatePDF = async (elementId, filename = 'AttackIQ-INFORM-Assessment-Report.pdf', scores = {}) => {
    const { results, overallLevel, overallLabel, calculateSectionScore, recommendationGroups = [] } = scores;

    if (!results || !results.scoresBySection) {
        console.error('No results data provided for PDF generation');
        return false;
    }

    try {
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageWidth = 210;
        const pageHeight = 297;
        const margin = 15;
        const contentWidth = pageWidth - (margin * 2);

        const addWrappedText = (text, x, y, maxWidth, lineHeight = 5) => {
            const lines = pdf.splitTextToSize(text, maxWidth);
            lines.forEach((line, i) => {
                pdf.text(line, x, y + (i * lineHeight));
            });
            return y + (lines.length * lineHeight);
        };


        pdf.setFillColor(14, 8, 43); 
        pdf.rect(0, 0, pageWidth, 70, 'F');

        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(28);
        pdf.setFont('helvetica', 'bold');
        const logoSvgBase64 = 'PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4gPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZlcnNpb249IjEuMSIgaWQ9IkxheWVyXzEiIHg9IjAiIHk9IjAiIHZpZXdCb3g9IjAgMCA0NzkuOSA1MSIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSI+PHN0eWxlPi5zdDB7ZmlsbC1ydWxlOmV2ZW5vZGQ7Y2xpcC1ydWxlOmV2ZW5vZGQ7ZmlsbDojZmZmfTwvc3R5bGU+PHBhdGggY2xhc3M9InN0MCIgZD0iTTE5NS45IDkuOGMtMS41LTIuMi0zLjEtNC40LTQuNy02LjUtLjctLjktMS42LTEuMy0yLjgtMS4zLTEuOC4xLTIuOCAxLjMtMy43IDIuNi04LjQgMTIuMS0xNi44IDI0LjMtMjUuMSAzNi40LS4yLjItLjMuNS0uNS45aDYuOWMuNiAwIC45LS4yIDEuMy0uNyA0LjctNi44IDkuNS0xMy43IDE0LjItMjAuNSAyLjMtMy40IDQuNy02LjggNy4xLTEwLjMgMy44IDUuNCA3LjQgMTAuOCAxMS4yIDE2LjJoLTEyLjRjLS4zIDAtLjggMC0xIC4zLTEuMyAxLjgtMi42IDMuNy00IDUuN2gyMC41Yy43IDAgMS4xLjIgMS40LjcgMS4yIDEuOSAyLjYgMy43IDMuOCA1LjYuNyAxIDEuMiAyLjMgMi4xIDIuOC45LjUgMi40LjEgMy42LjFoNC4xYy0uMy0uNC0uNC0uNy0uNi0xLTcuMS0xMC4zLTE0LjItMjAuNi0yMS40LTMxek01OS43IDJjLS40IDAtLjkuMy0xLjEuNi0xLjEgMS41LTIuMiAzLjEtMy4zIDQuNi0uMS4yLS4yLjQtLjMuN2gyMi4xdjMzLjloN3YtMzRoMTcuMWMuMyAwIC44IDAgMS0uMiAxLjMtMS44IDIuNi0zLjYgNC01LjZINTkuN3pNMjM4LjkgOGMyLjctLjEgNS40IDAgOC4xIDBoMjMuOWMuNCAwIC45LS4xIDEuMS0uNCAxLjMtMS44IDIuNS0zLjYgMy45LTUuNkgyMzljLTEuMyAwLTIuNi4xLTMuOC40LTMuNC44LTUuOSAyLjUtNi44IDYuMS0uMyAxLjItLjQgMi40LS40IDMuN3YxOGMwIDEuMyAwIDIuNi4yIDMuOS4zIDMuMSAxLjggNS40IDQuNiA2LjcgMS44LjkgMy44IDEuMyA1LjggMS4zaDM2LjhjLjEgMCAuMyAwIC41LS4xLTEuMi0xLjgtMi40LTMuNC0zLjQtNS4xLS40LS42LS45LS45LTEuNy0uOWgtMzEuN2MtMi44IDAtNC4xLTEuMy00LjEtNC4xVjEyYzAtMi42IDEuMy0zLjkgMy45LTR6TTE2MiAyaC00NC41Yy0xLjcgMC0yLjkuMy0zLjcgMS45QzExMyA1LjMgMTEyIDYuNSAxMTEgOGgyMi4xdjM0aDdWOGgxN2MuNiAwIDEtLjIgMS40LS43IDEtMS42IDIuMS0zLjEgMy4xLTQuNi4yLS4yLjItLjQuNC0uN3pNMzYuOSA5LjhjLTEuNS0yLjItMy4xLTQuNC00LjctNi41LS43LS45LTEuNi0xLjMtMi44LTEuMy0xLjguMS0yLjggMS4zLTMuNyAyLjZDMTcuMyAxNi43IDguOSAyOC44LjUgNDFjLS4yLjItLjMuNS0uNS45aDYuOWMuNiAwIC45LS4yIDEuMy0uNyA0LjctNi44IDkuNS0xMy43IDE0LjItMjAuNSAyLjMtMy40IDQuNy02LjggNy4xLTEwLjMgMy44IDUuNCA3LjQgMTAuOCAxMS4yIDE2LjJIMjguM2MtLjMgMC0uOCAwLTEgLjMtMS4zIDEuOC0yLjYgMy43LTQgNS43aDIwLjVjLjcgMCAxLjEuMiAxLjQuNyAxLjIgMS45IDIuNiAzLjcgMy44IDUuNi43IDEgMS4yIDIuMyAyLjEgMi44LjkuNSAyLjQuMSAzLjYuMWg0LjFjLS4zLS40LS40LS43LS42LTEtNy0xMC4zLTE0LjEtMjAuNi0yMS4zLTMxek0zNDEuOSAyLjJsLS4xLS4ySDMzMmMtLjMgMC0uNy4yLS45LjUtNi41IDUuMy0xMi45IDEwLjctMTkuNCAxNi0uNC4zLS45LjUtMS40LjVoLTExLjVjLS4zIDAtLjYgMC0uOS0uMVYySDI5MXYzOS45aDYuOVYyNS4xYy4yIDAgLjItLjEuMy0uMWgxMy4yYy40IDAgLjguMiAxLjEuNSA2LjUgNS4zIDEzLjEgMTAuNyAxOS42IDE2IC4zLjMuOC40IDEuMi40aDljLjIgMCAuNC0uMS44LS4xLTguMy02LjgtMTYuNi0xMy41LTI0LjgtMjAuMyA3LjktNi40IDE1LjctMTIuOSAyMy42LTE5LjN6TTQ2MS4xIDMuMmMtMS44LS44LTMuOC0xLjItNS43LTEuMmgtMjdjLTEuNCAwLTIuOC4xLTQuMS40LTQuMy44LTcuMSA0LTcuMiA4LjItLjEgNy43LS4xIDE1LjMgMCAyMyAuMSAzLjUgMS44IDYuMSA1IDcuNSAyLjEuOSA0LjIgMS4xIDYuNCAxLjFoMTkuN2MxIDAgMS41LjMgMiAxLjEgMS41IDIuNCAzIDQuNyA0LjUgNy4xLjIuMy41LjYuOC42IDIuMi4xIDQuNSAwIDYuOSAwLTItMy0zLjktNS45LTUuOS04LjkuNC0uMS42LS4xLjktLjEgMy4yLS40IDYtMS41IDcuNS00LjYuOS0xLjcgMS4xLTMuNSAxLjEtNS40VjE0LjNjMC0xLjQgMC0yLjctLjEtNC4xLS4zLTMuMy0xLjktNS43LTQuOC03em0tMS45IDI5YzAgMi4zLTEgMy42LTMuMyAzLjktLjguMS0xLjcuMS0yLjUgMC0uMyAwLS42LS40LS44LS43LTEuOC0yLjctMy42LTUuNC01LjMtOC4yLS4zLS41LS43LS44LTEuMy0uN2gtNi4yYzIgMy4yIDQgNi4zIDYgOS42LS41IDAtLjguMS0xLjEuMWgtMTYuNGMtLjUgMC0xLS4xLTEuNS0uMi0xLjktLjQtMi44LTEuNS0yLjgtMy40di0yMWMwLTIuMiAxLjQtMy41IDMuNi0zLjYgMS42LS4xIDMuMi0uMSA0LjgtLjEgNy44IDAgMTUuNSAwIDIzLjMuMSAyLjYgMCAzLjggMS40IDMuOCAzLjktLjMgNi44LS4zIDEzLjUtLjMgMjAuM3pNMzgzLjEgNy43aDE1Yy40IDAgLjktLjEgMS4xLS4zIDEuMy0xLjcgMi41LTMuNSAzLjgtNS41aC00MmMtLjQgMC0uOSAwLTEuMS4yLTEuMyAxLjctMi41IDMuNS0zLjkgNS41aDIwLjFWMzZoLTEyLjRjLTEuMiAwLTIuNS0uMy0zLjQuMi0uOS40LTEuNCAxLjctMiAyLjYtLjcgMS0xLjMgMS45LTIgMi45LjIuMS4zLjEuMy4xaDQxLjljLjQgMCAuOC0uMyAxLjEtLjYgMS4xLTEuNCAyLjEtMi45IDMuMS00LjQuMS0uMi4yLS40LjQtLjdoLTE5LjlWNy43eiI+PC9wYXRoPjxnPjxwYXRoIGNsYXNzPSJzdDAiIGQ9Ik00NzcuMSA0LjN2LS4yYzAtLjktLjctMS41LTEuOS0xLjVoLTIuMXY0LjhoMVY1LjhoMS4xbC44IDEuNmgxLjFsLTEtMS45Yy42LS4yIDEtLjcgMS0xLjJ6bS0xLS4xYzAgLjQtLjMuNy0uOS43aC0xLjFWMy41aDEuMWMuNiAwIC45LjIuOS43eiI+PC9wYXRoPjxwYXRoIGNsYXNzPSJzdDAiIGQ9Ik00NzUgMGMtMi44IDAtNSAyLjItNSA1czIuMSA1IDUgNSA1LTIuMiA1LTVjLS4xLTIuOC0yLjItNS01LTV6bTAgOS4zYy0yLjUgMC00LjItMS44LTQuMi00LjNTNDcyLjYuNyA0NzUgLjdjMi41IDAgNC4yIDEuOCA0LjIgNC4zcy0xLjggNC4zLTQuMiA0LjN6Ij48L3BhdGg+PC9nPjwvc3ZnPiA=';

        try {
            const svgDataUrl = 'data:image/svg+xml;base64,' + logoSvgBase64;
            const logoImg = new Image();
            logoImg.src = svgDataUrl;
            await new Promise((resolve, reject) => {
                logoImg.onload = resolve;
                logoImg.onerror = reject;
            });

            const logoCanvas = document.createElement('canvas');
            const logoWidth = 50; 
            const aspectRatio = logoImg.naturalHeight / logoImg.naturalWidth;
            const logoHeight = logoWidth * aspectRatio;
            logoCanvas.width = logoImg.naturalWidth * 2;
            logoCanvas.height = logoImg.naturalHeight * 2;
            const logoCtx = logoCanvas.getContext('2d');
            logoCtx.drawImage(logoImg, 0, 0, logoCanvas.width, logoCanvas.height);
            const logoPng = logoCanvas.toDataURL('image/png');

            pdf.addImage(logoPng, 'PNG', margin, 20, logoWidth, logoHeight);
        } catch (logoErr) {
            console.warn('Logo render failed, using text fallback:', logoErr);
            pdf.text('ATTACKIQ', margin, 30);
        }

        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(188, 159, 223);
        pdf.text('This report presents the results of your threat-informed defense', margin, 42);
        pdf.text('maturity assessment based on MITRE INFORM', margin, 49);

        const today = new Date().toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
        pdf.setFontSize(10);
        pdf.text(`Generated: ${today}`, margin, 55);

        pdf.setTextColor(14, 8, 43);
        pdf.setFontSize(24);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Your Assessment Results', margin, 95);

        pdf.setDrawColor(64, 0, 143);
        pdf.setLineWidth(1);
        pdf.line(margin, 100, margin + 60, 100);

        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(51, 51, 51);
        const introText = 'This report presents the results of your INFORM (Informed Defense) security assessment. The INFORM framework evaluates your organization\'s threat-informed defense capabilities across three key dimensions: Cyber Threat Intelligence (CTI), Defensive Measures (DM), and Test & Evaluation (TE).\n\nEach dimension is scored on a maturity scale from 1 (Initial) to 5 (Optimized), providing insights into your current security posture and areas for improvement.';
        addWrappedText(introText, margin, 115, contentWidth, 6);

        let yPos = 160;
        pdf.setFillColor(242, 241, 244);
        pdf.roundedRect(margin, yPos, contentWidth, 50, 3, 3, 'F');

        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(14, 8, 43);
        pdf.text('Assessment Summary', margin + 10, yPos + 12);

        const overallStr = String(overallLevel || 0);
        pdf.setFontSize(36);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(64, 0, 143);
        pdf.text(overallStr, pageWidth - margin - 30, yPos + 18, { align: 'center' });

        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(101, 97, 107);
        pdf.text(overallLabel || 'Overall Score', pageWidth - margin - 30, yPos + 26, { align: 'center' });

        const sectionScoreY = yPos + 35;
        const sectionWidth = (contentWidth - 20) / 3;

        results.scoresBySection.forEach((section, idx) => {
            const colors = SECTION_COLORS[section.section_id] || SECTION_COLORS.CTI;
            const sScore = calculateSectionScore ? calculateSectionScore(section) : 0;
            const xPos = margin + 10 + (idx * sectionWidth);

            pdf.setFillColor(...colors.rgb);
            pdf.roundedRect(xPos, sectionScoreY, sectionWidth - 10, 10, 1, 1, 'F');

            pdf.setFontSize(9);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(...colors.textRgb);
            const scoreLabel = sScore === -1 ? 'N/A' : String(sScore);
            pdf.text(`${section.section_id}: ${scoreLabel}`, xPos + (sectionWidth - 10) / 2, sectionScoreY + 7, { align: 'center' });
        });

        yPos = 225;
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(14, 8, 43);
        pdf.text('Maturity Level Scale', margin, yPos);

        yPos += 10;
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');

        const levels = [
            { level: 1, name: 'Initial', desc: 'Ad hoc and reactive processes' },
            { level: 2, name: 'Developing', desc: 'Some repeatable practices exist' },
            { level: 3, name: 'Defined', desc: 'Documented and consistent processes' },
            { level: 4, name: 'Managed', desc: 'Measured and integrated practices' },
            { level: 5, name: 'Optimized', desc: 'Proactive and continuously refined' }
        ];

        levels.forEach((l, idx) => {
            const isCurrentLevel = overallLevel === l.level;
            if (isCurrentLevel) {
                pdf.setFillColor(64, 0, 143);
                pdf.roundedRect(margin, yPos + (idx * 10) - 3, contentWidth, 9, 1, 1, 'F');
                pdf.setTextColor(255, 255, 255);
            } else {
                pdf.setTextColor(51, 51, 51);
            }
            pdf.setFont('helvetica', 'bold');
            pdf.text(`${l.level}`, margin + 5, yPos + (idx * 10) + 3);
            pdf.text(l.name, margin + 15, yPos + (idx * 10) + 3);
            pdf.setFont('helvetica', 'normal');
            pdf.text(`- ${l.desc}`, margin + 45, yPos + (idx * 10) + 3);
        });

        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        pdf.text('Powered by AttackIQ | www.attackiq.com', pageWidth / 2, pageHeight - 10, { align: 'center' });

        pdf.addPage();

        pdf.setFillColor(64, 0, 143);
        pdf.rect(0, 0, pageWidth, 25, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Detailed Score Breakdown', margin, 17);

        yPos = 40;

        results.scoresBySection.forEach((section) => {
            const colors = SECTION_COLORS[section.section_id] || SECTION_COLORS.CTI;
            const sScore = calculateSectionScore ? calculateSectionScore(section) : 0;
            const scoreLabel = sScore === -1 ? 'N/A' : String(sScore);

            if (yPos > pageHeight - 50) {
                pdf.addPage();
                yPos = 20;
            }

            pdf.setFillColor(...colors.rgb);
            pdf.roundedRect(margin, yPos, contentWidth, 12, 2, 2, 'F');

            pdf.setTextColor(...colors.textRgb);
            pdf.setFontSize(11);
            pdf.setFont('helvetica', 'bold');
            pdf.text(`${section.section_id} - ${section.name}`, margin + 5, yPos + 8);

            pdf.setFontSize(9);
            pdf.text(
                `Score: ${scoreLabel}  |  Weight: ${SECTION_WEIGHTS[section.section_id] || ''}`,
                pageWidth - margin - 5, yPos + 8, { align: 'right' }
            );

            yPos += 18;

            if (section.questions) {
                section.questions.forEach((q) => {
                    if (yPos > pageHeight - 20) {
                        pdf.addPage();
                        yPos = 20;
                    }

                    const qScore = getQuestionScore(q);
                    const isNA = q.isNotApplicable;
                    const isSkipped = !isNA && !q.hasAnswer;
                    const isMax = !isNA && !isSkipped && qScore === 5;

                    const displayName = `${q.uid || q.componentKey} - ${q.heading}`;
                    const truncated = displayName.length > 65
                        ? displayName.substring(0, 65) + '...'
                        : displayName;

                    pdf.setFontSize(9);
                    pdf.setFont('helvetica', 'normal');

                    if (isNA) {
                        pdf.setTextColor(187, 187, 187);
                    } else {
                        pdf.setTextColor(101, 97, 107);
                    }
                    pdf.text(truncated, margin + 5, yPos);

                    let scoreText;
                    if (isNA) {
                        scoreText = 'N/A';
                        pdf.setTextColor(153, 153, 153);
                    } else if (isSkipped) {
                        scoreText = '0';
                        pdf.setTextColor(230, 167, 0);
                    } else if (isMax) {
                        scoreText = getScoreLabel(qScore);
                        pdf.setTextColor(40, 167, 69);
                    } else {
                        scoreText = getScoreLabel(qScore);
                        pdf.setTextColor(64, 0, 143);
                    }

                    pdf.setFont('helvetica', 'bold');
                    pdf.text(scoreText, pageWidth - margin - 5, yPos, { align: 'right' });
                    pdf.setFont('helvetica', 'normal');

                    yPos += 6;
                });
            }

            yPos += 10;
        });

        pdf.addPage();

        pdf.setFillColor(64, 0, 143);
        pdf.rect(0, 0, pageWidth, 25, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Visual Analysis', margin, 17);

        try {
            const radarContainer = document.getElementById('aiq-radar-chart-container');
            if (radarContainer) {
                const radarCanvas = radarContainer.querySelector('canvas');
                if (radarCanvas) {
                    const radarImg = radarCanvas.toDataURL('image/png');
                    const chartSize = 120;
                    const chartX = (pageWidth - chartSize) / 2;

                    const availableTop = 25;
                    const availableBottom = pageHeight - 18;
                    const contentBlock = 7 + chartSize;
                    const chartYStart = availableTop + (availableBottom - availableTop - contentBlock) / 2;

                    pdf.setTextColor(14, 8, 43);
                    pdf.setFontSize(12);
                    pdf.setFont('helvetica', 'bold');
                    pdf.text('Maturity Radar', pageWidth / 2, chartYStart, { align: 'center' });

                    pdf.addImage(radarImg, 'PNG', chartX, chartYStart + 7, chartSize, chartSize);
                }
            }
        } catch (e) {
            console.warn('Could not capture radar chart:', e);
        }

        try {
            const matrixEl = document.getElementById('aiq-matrix-container');
            if (matrixEl) {
                const matrixCanvas = await html2canvas(matrixEl, {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    backgroundColor: '#ffffff'
                });
                const matrixImg = matrixCanvas.toDataURL('image/png');

                pdf.addPage();

                pdf.setFillColor(64, 0, 143);
                pdf.rect(0, 0, pageWidth, 25, 'F');
                pdf.setTextColor(255, 255, 255);
                pdf.setFontSize(14);
                pdf.setFont('helvetica', 'bold');
                pdf.text('Impact / Complexity Matrix', margin, 17);

                yPos = 35;

                let matrixWidth = contentWidth;
                let matrixHeight = (matrixCanvas.height * matrixWidth) / matrixCanvas.width;
                const maxMatrixHeight = pageHeight - 50;

                if (matrixHeight > maxMatrixHeight) {
                    matrixHeight = maxMatrixHeight;
                    matrixWidth = (matrixCanvas.width * matrixHeight) / matrixCanvas.height;
                }

                const matrixX = (pageWidth - matrixWidth) / 2;
                pdf.addImage(matrixImg, 'PNG', matrixX, yPos, matrixWidth, matrixHeight);
            }
        } catch (e) {
            console.warn('Could not capture matrix:', e);
        }

        pdf.addPage();

        const renderRecsBanner = () => {
            pdf.setFillColor(64, 0, 143);
            pdf.rect(0, 0, pageWidth, 25, 'F');
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(14);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Recommendations & Next Steps', margin, 17);
        };

        renderRecsBanner();
        yPos = 40;

        // Footer band reserves vertical space at the bottom of every page so
        // recommendation cards don't run into the "Page n of N" line.
        const FOOTER_RESERVE = 25;
        const ensureRoom = (needed) => {
            if (yPos + needed > pageHeight - FOOTER_RESERVE) {
                pdf.addPage();
                renderRecsBanner();
                yPos = 40;
            }
        };

        if (!recommendationGroups || recommendationGroups.length === 0) {
            pdf.setTextColor(14, 8, 43);
            pdf.setFontSize(12);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Improve Your Threat-Informed Defense', margin, yPos);
            yPos += 10;
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(101, 97, 107);
            yPos = addWrappedText(
                'Complete the assessment to receive tailored recommendations for each component where there is room to mature.',
                margin, yPos, contentWidth, 5
            );
            yPos += 8;
        } else {
            pdf.setTextColor(14, 8, 43);
            pdf.setFontSize(12);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Improve Your Threat-Informed Defense', margin, yPos);
            yPos += 10;

            recommendationGroups.forEach((group, idx) => {
                const cb = group.choiceBlock || {};
                const sectionColor = SECTION_COLORS[group.sectionId] || SECTION_COLORS.CTI;

                // Header bar
                ensureRoom(14);
                pdf.setFillColor.apply(pdf, sectionColor.rgb);
                pdf.rect(margin, yPos, contentWidth, 9, 'F');
                pdf.setTextColor.apply(pdf, sectionColor.textRgb);
                pdf.setFontSize(10);
                pdf.setFont('helvetica', 'bold');
                const headerText = `${idx + 1}. ${group.componentLabel || ''}`;
                pdf.text(
                    pdf.splitTextToSize(headerText, contentWidth - 6)[0],
                    margin + 3, yPos + 6
                );
                yPos += 11;

                // Body fields — each line is height-checked so a long card
                // can break across pages cleanly.
                pdf.setTextColor(14, 8, 43);
                pdf.setFontSize(9);

                if (cb.selectedLabel) {
                    ensureRoom(10);
                    pdf.setFont('helvetica', 'bold');
                    pdf.text('Suggested level:', margin, yPos);
                    pdf.setFont('helvetica', 'normal');
                    pdf.setTextColor(51, 51, 51);
                    yPos = addWrappedText(cb.selectedLabel, margin + 32, yPos, contentWidth - 32, 4) + 2;
                    pdf.setTextColor(14, 8, 43);
                }
                if (cb.primaryOwner) {
                    ensureRoom(8);
                    pdf.setFont('helvetica', 'bold');
                    pdf.text('Primary owner:', margin, yPos);
                    pdf.setFont('helvetica', 'normal');
                    pdf.setTextColor(101, 97, 107);
                    yPos = addWrappedText(cb.primaryOwner, margin + 30, yPos, contentWidth - 30, 4) + 2;
                    pdf.setTextColor(14, 8, 43);
                }
                if (cb.levelGoal) {
                    ensureRoom(10);
                    pdf.setFont('helvetica', 'normal');
                    pdf.setTextColor(51, 51, 51);
                    yPos = addWrappedText(cb.levelGoal, margin, yPos, contentWidth, 4.4) + 3;
                    pdf.setTextColor(14, 8, 43);
                }
                if (Array.isArray(cb.recommendations) && cb.recommendations.length > 0) {
                    ensureRoom(8);
                    pdf.setFont('helvetica', 'bold');
                    pdf.setFontSize(9);
                    pdf.text('Next Steps', margin, yPos);
                    yPos += 5;
                    pdf.setFont('helvetica', 'normal');
                    pdf.setTextColor(51, 51, 51);
                    cb.recommendations.forEach((line) => {
                        ensureRoom(8);
                        pdf.text('•', margin + 2, yPos);
                        yPos = addWrappedText(line, margin + 7, yPos, contentWidth - 7, 4.4) + 1.5;
                    });
                    pdf.setTextColor(14, 8, 43);
                }

                yPos += 6;
            });
        }

        // CTA banner — fixed height; if it doesn't fit, paginate.
        ensureRoom(48);
        pdf.setFillColor(14, 8, 43);
        pdf.roundedRect(margin, yPos, contentWidth, 40, 3, 3, 'F');

        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Ready to Improve Your Security Posture?', margin + 10, yPos + 15);

        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(188, 159, 223);
        pdf.text('Contact AttackIQ to learn how our platform can help you validate', margin + 10, yPos + 27);
        pdf.text('and improve your threat-informed defense capabilities.', margin + 10, yPos + 34);

        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        pdf.text('www.attackiq.com', pageWidth - margin - 35, yPos + 30);

        const totalPages = pdf.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            pdf.setPage(i);
            pdf.setFillColor(255, 255, 255);
            pdf.rect(0, pageHeight - 18, pageWidth, 18, 'F');
            pdf.setFontSize(8);
            pdf.setTextColor(150, 150, 150);
            if (i === 1) {
                pdf.text('Powered by AttackIQ | www.attackiq.com', pageWidth / 2, pageHeight - 10, { align: 'center' });
            } else {
                pdf.text(`Page ${i} of ${totalPages} | AttackIQ INFORM Assessment`, pageWidth / 2, pageHeight - 10, { align: 'center' });
            }
        }

        pdf.save(filename);
        return true;

    } catch (err) {
        console.error('PDF Generation Error:', err);
        return false;
    }
};

export default generatePDF;
