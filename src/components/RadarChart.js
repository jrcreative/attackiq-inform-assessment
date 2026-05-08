import React from 'react';
import {
    Chart as ChartJS,
    RadialLinearScale,
    PointElement,
    LineElement,
    Filler,
    Tooltip,
    Legend,
} from 'chart.js';
import { Radar } from 'react-chartjs-2';

ChartJS.register(
    RadialLinearScale,
    PointElement,
    LineElement,
    Filler,
    Tooltip,
    Legend
);

const getComponentScore = (q) => {
    if (q.isNotApplicable) return 0;
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

const ratioToLevel = (ratio) => {
    if (ratio == null) return null;
    if (ratio <= 0)   return 0;
    if (ratio <= 0.2) return 1;
    if (ratio <= 0.4) return 2;
    if (ratio <= 0.6) return 3;
    if (ratio <= 0.8) return 4;
    return 5;
};

const HISTORICAL_PALETTE = [
    { border: 'rgba(64, 0, 143, 0.85)',   bg: 'rgba(64, 0, 143, 0.18)' },
    { border: 'rgba(54, 186, 228, 0.85)', bg: 'rgba(54, 186, 228, 0.18)' },
    { border: 'rgba(255, 159, 28, 0.85)', bg: 'rgba(255, 159, 28, 0.18)' },
    { border: 'rgba(46, 196, 182, 0.85)', bg: 'rgba(46, 196, 182, 0.18)' },
];

const formatHistoricalLabel = (record, index) => {
    const date = record.downloadedDate ? new Date(record.downloadedDate) : null;
    if (date && !Number.isNaN(date.getTime())) {
        return date.toLocaleDateString();
    }
    return `Previous ${index + 1}`;
};

const RadarChart = ({ scores, historical = [] }) => {
    const labels = [];
    const currentValues = [];

    const sectionIds = [];

    scores.scoresBySection.forEach(section => {
        if (!section.questions) return;
        if (section.scored === false) return;

        let total = 0;
        let count = 0;
        section.questions.forEach(q => {
            total += getComponentScore(q);
            count++;
        });
        const avg = count > 0 ? Math.round(total / count) : 0;

        labels.push(section.shortname || section.section_id);
        currentValues.push(avg);
        sectionIds.push(section.section_id);
    });

    const datasets = [
        {
            label: "Today's Results",
            data: currentValues,
            backgroundColor: 'rgba(240, 44, 104, 0.25)',
            borderColor: 'rgba(240, 44, 104, 0.85)',
            borderWidth: 2,
            pointBackgroundColor: 'rgba(240, 44, 104, 0.85)',
            pointRadius: 3,
        },
    ];

    historical.forEach((record, idx) => {
        const palette = HISTORICAL_PALETTE[idx % HISTORICAL_PALETTE.length];
        const sectionMap = new Map();
        (record.sections || []).forEach(s => {
            if (!s || !s.section_id) return;
            const ratio = (typeof s.ratio === 'number')
                ? s.ratio
                : (s.totalPoints != null && s.possiblePoints && s.possiblePoints > 0
                    ? s.totalPoints / s.possiblePoints
                    : null);
            sectionMap.set(s.section_id, ratioToLevel(ratio));
        });

        const data = sectionIds.map(id => {
            const v = sectionMap.get(id);
            return v == null ? 0 : v;
        });

        datasets.push({
            label: formatHistoricalLabel(record, idx),
            data,
            backgroundColor: palette.bg,
            borderColor: palette.border,
            borderWidth: 1.5,
            borderDash: [4, 3],
            pointBackgroundColor: palette.border,
            pointRadius: 2,
        });
    });

    const data = { labels, datasets };

    const options = {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
            r: {
                angleLines: { color: '#ddd' },
                grid:       { color: '#e0e0e0' },
                suggestedMin: 0,
                suggestedMax: 5,
                ticks: {
                    stepSize: 1,
                    backdropColor: 'transparent',
                    font: { size: 10 },
                    color: '#999',
                },
                pointLabels: {
                    font: { size: 12, family: 'Inter, sans-serif' },
                    color: '#333',
                },
            },
        },
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    font: { family: 'Inter, sans-serif', size: 12 },
                    usePointStyle: true,
                    pointStyle: 'rect',
                },
            },
        },
    };

    return <Radar data={data} options={options} />;
};

export default RadarChart;
