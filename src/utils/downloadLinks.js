export const createDownloadToken = () => {
    if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
        const array = new Uint8Array(16);
        window.crypto.getRandomValues(array);
        const randomString = Array.from(array)
            .map((byte) => byte.toString(36).padStart(2, '0'))
            .join('')
            .slice(0, 24);
        return `aiq_${randomString}`;
    }

    return `aiq_${Date.now()}_${Math.random().toString(36).slice(2)}`;
};

export const buildDownloadTokenLink = (token) => {
    if (!token || typeof window === 'undefined') {
        return '';
    }

    return `${window.location.origin}${window.location.pathname}?download_token=${encodeURIComponent(token)}`;
};
