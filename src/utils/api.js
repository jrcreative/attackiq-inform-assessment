
export const submitResults = async (answers, result) => {
    const endpoint = window.aiqInformData?.root_id ? '/wp-json/aiq/v1/submit' : 'http://attackiq.local/wp-json/aiq/v1/submit';

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                answers,
                result: {
                    overallScore: result.overallScore,
                    sectionScores: result.scoresBySection.map(s => ({
                        id: s.section_id,
                        score: s.totalPoints
                    }))
                },
                email: 'anonymous@user.com' 
            })
        });

        const data = await response.json();
        return data.success;
    } catch (err) {
        console.error('Submission Error:', err);
        return false;
    }
};
