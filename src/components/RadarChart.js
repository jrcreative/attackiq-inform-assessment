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

const RadarChart = ({ scores }) => {
    const labels = [];
    const dataValues = [];

    scores.scoresBySection.forEach(section => {
        if (!section.questions) return;
        section.questions.forEach(q => {
            labels.push(q.uid || q.componentKey);
            dataValues.push(getComponentScore(q));
        });
    });

    const data = {
        labels,
        datasets: [
            {
                label: "Today's Results",
                data: dataValues,
                backgroundColor: 'rgba(240, 100, 140, 0.3)',
                borderColor: 'rgba(240, 100, 140, 0.8)',
                borderWidth: 2,
                pointBackgroundColor: 'rgba(240, 100, 140, 0.8)',
                pointRadius: 3,
            },
        ],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
            r: {
                angleLines: {
                    color: '#ddd'
                },
                grid: {
                    color: '#e0e0e0'
                },
                suggestedMin: 0,
                suggestedMax: 5,
                ticks: {
                    stepSize: 1,
                    backdropColor: 'transparent',
                    font: { size: 10 },
                    color: '#999'
                },
                pointLabels: {
                    font: {
                        size: 12,
                        family: 'Inter, sans-serif'
                    },
                    color: '#333'
                }
            },
        },
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    font: { family: 'Inter, sans-serif', size: 12 },
                    usePointStyle: true,
                    pointStyle: 'rect',
                }
            }
        }
    };

    return <Radar data={data} options={options} />;
};

export default RadarChart;
