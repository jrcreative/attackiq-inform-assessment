import React, { createContext, useContext, useReducer } from 'react';
import assessmentData from '../data/inform-component-all-data.json';
import { readCtemExplicitSkip, writeCtemExplicitSkip } from '../utils/ctemSkip';

const AssessmentContext = createContext();

const initialState = {
    step: 0,
    answers: {},
    ctemSkipped: readCtemExplicitSkip(),
    data: assessmentData
};

function assessmentReducer(state, action) {
    switch (action.type) {
        case 'NEXT_STEP':
            return { ...state, step: state.step + 1 };
        case 'PREV_STEP':
            return { ...state, step: Math.max(0, state.step - 1) };
        case 'RESET':
            writeCtemExplicitSkip(false);
            return { ...state, step: 0, answers: {}, ctemSkipped: false };
        case 'SET_ANSWER':
            return {
                ...state,
                answers: {
                    ...state.answers,
                    [action.uid]: action.value
                }
            };
        case 'GO_TO_STEP':
            return { ...state, step: action.step };
        case 'SET_ANSWERS':
            return { ...state, answers: action.answers };
        case 'SET_CTEM_SKIPPED':
            writeCtemExplicitSkip(Boolean(action.value));
            return { ...state, ctemSkipped: Boolean(action.value) };
        default:
            return state;
    }
}

export function AssessmentProvider({ children }) {
    const [state, dispatch] = useReducer(assessmentReducer, initialState);

    return (
        <AssessmentContext.Provider value={{ state, dispatch }}>
            {children}
        </AssessmentContext.Provider>
    );
}

export function useAssessment() {
    return useContext(AssessmentContext);
}
