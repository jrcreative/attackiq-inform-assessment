// localStorage key: when "1", user explicitly opted out of the CTEM assessment.
// Mirrors the upstream aiq-inform-tool helper so that JSON exports / uploads
// behave identically across both implementations.
export const CTEM_SKIP_STORAGE_KEY = 'inform_ctem_skip';

const isStorageAvailable = () => {
    try {
        return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
    } catch (err) {
        return false;
    }
};

export function readCtemExplicitSkip() {
    if (!isStorageAvailable()) return false;
    try {
        return window.localStorage.getItem(CTEM_SKIP_STORAGE_KEY) === '1';
    } catch (err) {
        return false;
    }
}

export function writeCtemExplicitSkip(skipped) {
    if (!isStorageAvailable()) return;
    try {
        if (skipped) {
            window.localStorage.setItem(CTEM_SKIP_STORAGE_KEY, '1');
        } else {
            window.localStorage.removeItem(CTEM_SKIP_STORAGE_KEY);
        }
    } catch (err) {
        // ignore quota / privacy-mode errors
    }
}
