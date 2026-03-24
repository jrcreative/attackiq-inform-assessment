import { createRoot } from 'react-dom/client';
import { AssessmentProvider } from './context/AssessmentContext';
import WizardWrapper from './components/WizardWrapper';
import './style.css';

const App = () => {
    return (
        <AssessmentProvider>
            <div className="aiq-assessment-container" style={{ maxWidth: '800px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
                <WizardWrapper />
            </div>
        </AssessmentProvider>
    );
};

document.addEventListener('DOMContentLoaded', () => {
    const rootElement = document.getElementById('aiq-inform-assessment-root');
    if (rootElement) {
        const root = createRoot(rootElement);
        root.render(<App />);
    }
});
