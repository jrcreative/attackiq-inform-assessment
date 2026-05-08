

const SCORED_SECTION_IDS = ['CTI', 'DM', 'TE', 'CTEM'];

const isSectionLike = (entry) => Boolean(entry && entry.section_id && Array.isArray(entry.questions));

const isScoredSection = (section) => SCORED_SECTION_IDS.includes(section.section_id);

const isMultiSelectType = (type) => type === 'multiselect' || type === 'dropdownMultiSelect';
const isSingleSelectType = (type) => type === 'select' || type === 'dropdownSelect';

export const calculateSectionScore = (section) => {
    let score = 0;

    if (!section.section_id && section.overallScore) {
        score = section.overallScore;
    }

    let weights = 0;
    let applicableCount = 0;
    section.questions?.forEach(q => {
        if (q.isNotApplicable) return;

        applicableCount++;
        if (q.possiblePoints > 0) {
            score += (q.totalPoints / q.possiblePoints) * q.weight;
        }

        if (q.totalPoints >= 0) {
            weights += q.weight;
        }
    });

    if (applicableCount === 0) {
        return -1;
    }

    if (section.section_id && weights > 0) {
        score = score / weights;
    }

    switch (true) {
        case score < 0:
            return -1;
        case score === 0:
            return 0;
        case score <= 0.2:
            return 1;
        case score <= 0.4:
            return 2;
        case score <= 0.6:
            return 3;
        case score <= 0.8:
            return 4;
        case score <= 1:
            return 5;
        default:
            return 0;
    }
};

export const getScoreLabel = (level) => {
    switch (level) {
        case -1: return "N/A";
        case 0: return "None";
        case 1: return "Initial";
        case 2: return "Developing";
        case 3: return "Defined";
        case 4: return "Managed";
        case 5: return "Optimized";
        default: return "";
    }
};

export const processResults = (data, userAnswers, options = {}) => {
    const { ctemSkipped = false } = options;
    const scoresBySection = [];
    const impactComplexityMap = new Map();

    const addToMap = (impact, complexity, question, choiceInfo, selected, highestValue, empty) => {
        if (!impact || impact <= 0) return;
        const key = `i-${impact}_c-${complexity}`;
        if (!impactComplexityMap.has(key)) {
            impactComplexityMap.set(key, []);
        }
        impactComplexityMap.get(key).push({
            componentKey: question.componentKey,
            uid: choiceInfo?.uid || question.componentKey,
            heading: question.heading,
            choiceDescription: choiceInfo?.description || '',
            section_id: question.section_id,
            impact,
            complexity,
            selected,
            highestValue,
            empty
        });
    };

    const sections = (Array.isArray(data) ? data : []).filter(isSectionLike);

    sections.forEach(section => {
        const includeInScoring = isScoredSection(section) && !(section.section_id === 'CTEM' && ctemSkipped);

        const processedQuestions = section.questions.map(q => {
            const componentKey = q.uid;
            const normalizedChoices = (q.choices || []).map(c => ({
                uid: c.uid,
                description: c.text,
                points: typeof c.points === 'number' ? c.points : 0,
                impact: typeof c.impact === 'number' ? c.impact : 0,
                complexity: typeof c.complexity === 'number' ? c.complexity : 0,
                tooltip: c.tooltip || '',
                levelId: typeof c.level_id === 'number' ? c.level_id : 0,
                primaryOwner: c.primaryOwner || '',
                levelGoal: c.levelGoal || '',
                recommendations: Array.isArray(c.recommendations) ? c.recommendations : []
            }));

            return {
                componentKey,
                uid: componentKey,
                section_id: section.section_id,
                heading: q.heading,
                subheading: q.subheading,
                questionText: q.subheading || q.heading,
                tooltip: q.tooltip || '',
                weight: typeof q.weight === 'number' ? q.weight : 0,
                type: q.type,
                choices: normalizedChoices
            };
        });

        const scoredQuestions = [];

        processedQuestions.forEach(question => {
            const rawAnswer = userAnswers[question.componentKey];
            const isNotApplicable = rawAnswer === 'N/A';
            const answerIndices = isNotApplicable
                ? []
                : (Array.isArray(rawAnswer) ? rawAnswer : []);

            if (isNotApplicable) {
                scoredQuestions.push({
                    ...question,
                    totalPoints: -1,
                    possiblePoints: 0,
                    isNotApplicable: true,
                    hasAnswer: false
                });
                return;
            }

            let points = 0;
            let maxImpact = 0;
            let maxComplexity = 0;

            answerIndices.forEach(idx => {
                const choice = question.choices[idx];
                if (!choice) return;
                points += choice.points;
                maxImpact = Math.max(maxImpact, choice.impact);
                maxComplexity = Math.max(maxComplexity, choice.complexity);
            });

            const hasAnswer = answerIndices.length > 0;
            let highest = true;

            if (includeInScoring) {
                if (isSingleSelectType(question.type)) {
                    if (!hasAnswer || answerIndices[0] < question.choices.length - 1) {
                        const highestChoice = question.choices[question.choices.length - 1];
                        if (highestChoice && highestChoice.impact > 0) {
                            addToMap(
                                highestChoice.impact,
                                highestChoice.complexity,
                                question,
                                highestChoice,
                                false,
                                true,
                                !hasAnswer
                            );
                        }
                        highest = false;
                    }
                } else if (isMultiSelectType(question.type)) {
                    question.choices.forEach((choice, index) => {
                        if (!answerIndices.includes(index) && choice.impact > 0) {
                            addToMap(
                                choice.impact,
                                choice.complexity,
                                question,
                                choice,
                                false,
                                false,
                                !hasAnswer
                            );
                            highest = false;
                        }
                    });
                }

                if (hasAnswer && maxImpact > 0) {
                    addToMap(maxImpact, maxComplexity, question, null, true, highest, false);
                }
            }

            const possiblePoints = question.choices.reduce((acc, c) => acc + (c.points || 0), 0);

            scoredQuestions.push({
                ...question,
                totalPoints: points,
                possiblePoints,
                isNotApplicable: false,
                hasAnswer
            });
        });

        const applicableQuestions = scoredQuestions.filter(q => !q.isNotApplicable);
        const sectionTotal = applicableQuestions.reduce((acc, q) => acc + q.totalPoints, 0);
        const sectionPossible = applicableQuestions.reduce((acc, q) => acc + q.possiblePoints, 0);

        scoresBySection.push({
            section_id: section.section_id,
            name: section.name,
            shortname: section.shortname,
            section_weight: typeof section.section_weight === 'number' ? section.section_weight : 0,
            scored: includeInScoring,
            questions: scoredQuestions,
            totalPoints: sectionTotal,
            possiblePoints: sectionPossible,
            applicableCount: applicableQuestions.length,
            notApplicableCount: scoredQuestions.length - applicableQuestions.length
        });
    });

    let overallScore = 0;
    let weightSum = 0;

    scoresBySection.forEach(s => {
        if (!s.scored) return;
        if (s.possiblePoints <= 0) return;
        const ratio = s.totalPoints / s.possiblePoints;
        overallScore += ratio * s.section_weight;
        weightSum += s.section_weight;
    });

    if (weightSum > 0) {
        overallScore = overallScore / weightSum;
    }

    return {
        scoresBySection,
        overallScore,
        impactComplexityMap
    };
};
