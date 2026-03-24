/**
 * JSON Generator for MITRE INFORM Assessment
 *
 * Generates JSON output matching the MITRE schema for interoperability
 * and future product import capabilities.
 *
 * Schema reference: inform-schema.json
 *
 * Note: User answers are now keyed by componentKey (e.g., 'CTI.1', 'DM.2')
 * representing grouped questions by Component.
 */

/**
 * Generate MITRE-compatible JSON from assessment results
 *
 * @param {Array} rawData - The flat assessment data from JSON file
 * @param {Object} userAnswers - User's answers { 'componentKey': [selectedIndices] }
 * @param {Object} results - Processed results from scoring.js
 * @returns {Object} MITRE-compatible JSON object
 */
export const generateMitreJSON = (rawData, userAnswers, results) => {
    // Group raw data by component (Dimension ID + Component ID)
    const sectionsMap = {
        'CTI': {
            section_id: 'CTI',
            name: 'Cyber Threat Intelligence - Best Practices and Maturity Levels',
            shortname: 'Cyber Threat Intelligence',
            questions: [],
            totalPoints: 0,
            possiblePoints: 0
        },
        'DM': {
            section_id: 'DM',
            name: 'Defensive Measures - Best Practices and Maturity Levels',
            shortname: 'Defensive Measures',
            questions: [],
            totalPoints: 0,
            possiblePoints: 0
        },
        'TE': {
            section_id: 'TE',
            name: 'Test & Evaluation - Best Practices and Maturity Levels',
            shortname: 'Test & Evaluation',
            questions: [],
            totalPoints: 0,
            possiblePoints: 0
        }
    };

    // Group data by Component (componentKey = DimensionID.ComponentID)
    const questionsMap = {};
    rawData.forEach(row => {
        const componentKey = `${row['Dimension ID']}.${row['Component ID']}`;
        const sectionId = row['Dimension ID'];

        if (!questionsMap[componentKey]) {
            questionsMap[componentKey] = {
                choices: [],
                heading: row.Question,
                component: row.Component,
                subheading: row['Question Subheading'] || '',
                tooltip: row['Question Tooltip'] || '',
                type: row['Question Type'] === 'Radio Buttons' ? 'select' : 'multiselect',
                uid: componentKey,
                weight: row['Component Weight'],
                score: [],
                impact: 0,
                complexity: 0,
                totalPoints: 0,
                irrelevant: false,
                possiblePoints: 0,
                _sectionId: sectionId
            };
        }

        // Add choice (each row is a choice option)
        questionsMap[componentKey].choices.push({
            cmm_v1: row['CTI CMM V1.2 Mapping'] ? [row['CTI CMM V1.2 Mapping']] : [''],
            cmm_v2: row['SOC CMM V2.3.4 Mapping'] || '',
            complexity: row.Complexity || 0,
            ctem: row['CTEM Mapping'] || '',
            impact: row.Impact || 0,
            level_id: row['Level ID'] || 0,
            points: row.Points || 0,
            red_team: row['Red Team CMM V1 Mapping'] || '',
            text: row['Level Description'] || '',
            tooltip: row['Level Tooltip'] || '',
            uid: row.UID
        });
    });

    // Sort choices and calculate possible points for each question
    Object.values(questionsMap).forEach(question => {
        // Sort choices by level_id
        question.choices.sort((a, b) => a.level_id - b.level_id);

        // Calculate possible points based on question type
        if (question.type === 'select') {
            // Radio: max points is highest single choice
            question.possiblePoints = Math.max(...question.choices.map(c => c.points));
        } else {
            // Checkbox: sum of all choice points
            question.possiblePoints = question.choices.reduce((acc, c) => acc + c.points, 0);
        }
    });

    // Process user answers and calculate scores for each question
    Object.values(questionsMap).forEach(question => {
        // Get answers by componentKey (the new structure)
        const rawAnswer = userAnswers[question.uid];
        const isNotApplicable = rawAnswer === 'N/A';
        const selectedIndices = isNotApplicable ? [] : (rawAnswer || []);

        // Calculate scores based on selected choices
        let totalPoints = 0;
        let maxImpact = 0;
        let maxComplexity = 0;
        const scoreArray = [];

        selectedIndices.forEach(idx => {
            if (question.choices[idx]) {
                const choice = question.choices[idx];
                totalPoints += choice.points;
                maxImpact = Math.max(maxImpact, choice.impact);
                maxComplexity = Math.max(maxComplexity, choice.complexity);
                scoreArray.push(String(idx));
            }
        });

        question.score = scoreArray;
        question.totalPoints = totalPoints;
        question.impact = maxImpact;
        question.complexity = maxComplexity;
        question.irrelevant = isNotApplicable || selectedIndices.includes(-1);

        // Remove internal tracking field and add to section
        const sectionId = question._sectionId;
        delete question._sectionId;

        if (sectionsMap[sectionId]) {
            sectionsMap[sectionId].questions.push(question);
            sectionsMap[sectionId].totalPoints += totalPoints;
            sectionsMap[sectionId].possiblePoints += question.possiblePoints;
        }
    });

    // Sort questions within each section by component number
    Object.values(sectionsMap).forEach(section => {
        section.questions.sort((a, b) => {
            const aNum = parseInt(a.uid.split('.')[1]);
            const bNum = parseInt(b.uid.split('.')[1]);
            return aNum - bNum;
        });
    });

    // Calculate overall score
    let overallTotalPoints = 0;
    let overallPossiblePoints = 0;

    Object.values(sectionsMap).forEach(section => {
        overallTotalPoints += section.totalPoints;
        overallPossiblePoints += section.possiblePoints;
    });

    const overallScore = overallPossiblePoints > 0 ? overallTotalPoints / overallPossiblePoints : 0;

    // Build final JSON structure matching MITRE schema
    const mitreJSON = {
        sections: [
            sectionsMap.CTI,
            sectionsMap.DM,
            sectionsMap.TE,
            {
                name: 'Your Score',
                totalPoints: overallTotalPoints,
                possiblePoints: overallPossiblePoints,
                overallScore: overallScore
            }
        ],
        downloadedDate: new Date().toISOString()
    };

    return mitreJSON;
};

/**
 * Validate JSON against MITRE schema structure
 *
 * @param {Object} json - JSON object to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export const validateMitreJSON = (json) => {
    const errors = [];

    if (!json.sections || !Array.isArray(json.sections)) {
        errors.push('Missing or invalid "sections" array');
    }

    if (!json.downloadedDate) {
        errors.push('Missing "downloadedDate" field');
    }

    if (json.sections) {
        json.sections.forEach((section, idx) => {
            if (section.questions) {
                // Assessment section
                if (!section.section_id) errors.push(`Section ${idx}: Missing section_id`);
                if (!section.name) errors.push(`Section ${idx}: Missing name`);
                if (!section.shortname) errors.push(`Section ${idx}: Missing shortname`);
            } else {
                // Score section
                if (section.overallScore === undefined) errors.push(`Section ${idx}: Missing overallScore`);
            }
        });
    }

    return {
        valid: errors.length === 0,
        errors
    };
};

export default generateMitreJSON;
