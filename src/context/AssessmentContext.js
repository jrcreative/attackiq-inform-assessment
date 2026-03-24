import React, { createContext, useContext, useReducer } from 'react';
import assessmentData from '../data/inform-component-all-data.json';

const AssessmentContext = createContext();

const initialState = {
    step: 0,
    answers: {}, 
    data: assessmentData
};

function assessmentReducer(state, action) {
    switch (action.type) {
        case 'NEXT_STEP':
            return { ...state, step: state.step + 1 };
        case 'PREV_STEP':
            return { ...state, step: Math.max(0, state.step - 1) };
        case 'RESET':
            return { ...state, step: 0, answers: {} };
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
