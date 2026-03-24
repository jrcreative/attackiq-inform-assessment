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

export const processResults = (data, userAnswers) => {
    const scoresBySection = [];
    const impactComplexityMap = new Map();

    const addToMap = (impact, complexity, question, choiceInfo, selected, highestValue, empty) => {
        const key = `i-${impact}_c-${complexity}`;
        if (!impactComplexityMap.has(key)) {
            impactComplexityMap.set(key, []);
        }
        impactComplexityMap.get(key).push({
            componentKey: question.componentKey,
            uid: choiceInfo?.uid || question.componentKey,
            heading: question.heading,
            choiceDescription: choiceInfo?.description || '',
            impact,
            complexity,
            selected,
            highestValue,
            empty
        });
    };

    const questionsMap = {};
    data.forEach(row => {
        const componentKey = `${row['Dimension ID']}.${row['Component ID']}`;

        if (!questionsMap[componentKey]) {
            questionsMap[componentKey] = {
                componentKey,
                uid: componentKey,
                heading: row.Component,
                questionText: row.Question,
                section_id: row['Dimension ID'],
                weight: row['Component Weight'],
                type: row['Question Type'] === 'Radio Buttons' ? 'select' : 'multiselect',
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
    const sections = ['CTI', 'DM', 'TE'];
    const groupedSections = sections.map(secId => {
        return {
            section_id: secId,
            name: data.find(d => d['Dimension ID'] === secId)?.Dimension || secId,
            shortname: secId,
            questions: []
        };
    });

    Object.values(questionsMap).forEach(q => {
        const sec = groupedSections.find(s => s.section_id === q.section_id);
        if (sec) sec.questions.push(q);
    });
    groupedSections.forEach(sec => {
        sec.questions.sort((a, b) => {
            const aNum = parseInt(a.componentKey.split('.')[1]);
            const bNum = parseInt(b.componentKey.split('.')[1]);
            return aNum - bNum;
        });
    });

    groupedSections.forEach(section => {
        const processedQuestions = [];

        section.questions.forEach(question => {
            const rawAnswer = userAnswers[question.componentKey];
            const isNotApplicable = rawAnswer === 'N/A';
            const answerIndices = isNotApplicable ? [] : (rawAnswer || []);
            let points = 0;
            let maxImpact = 0;
            let maxComplexity = 0;

            if (isNotApplicable) {
                processedQuestions.push({
                    ...question,
                    totalPoints: -1,
                    possiblePoints: 0,
                    weight: question.weight,
                    isNotApplicable: true
                });
                return; 
            }

            answerIndices.forEach(idx => {
                if (question.choices[idx]) {
                    const choice = question.choices[idx];
                    points += choice.points;
                    maxImpact = Math.max(maxImpact, choice.impact);
                    maxComplexity = Math.max(maxComplexity, choice.complexity);
                }
            });

            const hasAnswer = answerIndices.length > 0;
            let highest = true;

            if (question.type === "select") {
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
            } else if (question.type === "multiselect") {
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

            if (hasAnswer) {
                addToMap(maxImpact, maxComplexity, question, null, true, highest, false);
            }

            const possiblePoints = question.choices.reduce((acc, c) => acc + c.points, 0);

            processedQuestions.push({
                ...question,
                totalPoints: points,
                possiblePoints: possiblePoints,
                weight: question.weight,
                isNotApplicable: false,
                hasAnswer: hasAnswer
            });
        });

        const applicableQuestions = processedQuestions.filter(q => !q.isNotApplicable);
        const sectionTotal = applicableQuestions.reduce((acc, q) => acc + q.totalPoints, 0);
        const sectionPossible = applicableQuestions.reduce((acc, q) => acc + q.possiblePoints, 0);

        scoresBySection.push({
            ...section,
            questions: processedQuestions,
            totalPoints: sectionTotal,
            possiblePoints: sectionPossible,
            applicableCount: applicableQuestions.length,
            notApplicableCount: processedQuestions.length - applicableQuestions.length
        });
    });

    let overallScore = 0;
    scoresBySection.forEach(s => {
        let ratio = 0;
        if (s.possiblePoints > 0) {
            ratio = s.totalPoints / s.possiblePoints;
        }

        if (s.section_id === "CTI") overallScore += ratio * 0.35;
        else if (s.section_id === "DM") overallScore += ratio * 0.40;
        else if (s.section_id === "TE") overallScore += ratio * 0.25;
    });

    return {
        scoresBySection,
        overallScore,
        impactComplexityMap
    };
};
