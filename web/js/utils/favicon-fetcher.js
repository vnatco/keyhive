/**
 * Favicon Fetcher Utility
 * Fetches favicons via the server API (/api/icons) which handles:
 *   - Cache lookup
 *   - Server-side fetch from the domain + third-party services
 *   - Resize to 32x32 PNG, return as base64 data URI
 *
 * The API endpoint is unauthenticated (public favicon data) so both
 * cloud and local users can use it. Only writing to the cache (POST)
 * requires authentication.
 *
 * Previously, client-side fetching was attempted using Image elements
 * and third-party favicon services (Google, icon.horse, faviconkit),
 * but this broke due to CORS restrictions and CSP. The old client-side
 * code is preserved below (commented out) in case it's needed later.
 */

const FaviconFetcher = {
    /**
     * Fetch favicon from a website URL
     * @param {string} websiteUrl - The website URL
     * @returns {Promise<string|null>} - Base64 encoded image or null if failed
     */
    async fetch(websiteUrl) {
        if (!websiteUrl) return null;

        try {
            const url = new URL(websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`);
            const domain = url.hostname;

            // All icon fetching goes through the server API
            // The endpoint is unauthenticated - works for both cloud and local users
            const data = await ApiClient.get(`/icons?domain=${encodeURIComponent(domain)}`);
            if (data.success && data.data?.icon) {
                // Cache result for cloud users (POST requires auth, will silently fail for local users)
                const isCloud = localStorage.getItem('keyhive_mode') !== 'local';
                if (isCloud && typeof ApiClient !== 'undefined') {
                    try {
                        await ApiClient.post('/icons', { domain, icon_data: data.data.icon });
                    } catch (e) {
                        // Cache write failure is non-critical
                    }
                }
                return data.data.icon;
            }

            return null;
        } catch (e) {
            return null;
        }
    },

    /**
     * Convert uploaded file to base64
     * @param {File} file
     * @returns {Promise<string|null>}
     */
    async fromFile(file) {
        if (!file || !file.type.startsWith('image/')) {
            return null;
        }

        return new Promise((resolve) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    try {
                        const canvas = document.createElement('canvas');
                        const size = 32;
                        canvas.width = size;
                        canvas.height = size;

                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, size, size);

                        resolve(canvas.toDataURL('image/png'));
                    } catch (e) {
                        resolve(null);
                    }
                };
                img.onerror = () => resolve(null);
                img.src = e.target.result;
            };

            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
        });
    }
};

// =============================================================================
// OLD CLIENT-SIDE FAVICON FETCHING (preserved for reference)
// Disabled because third-party favicon services don't support CORS headers,
// so Image + canvas toDataURL() fails. All fetching now goes through the
// server API which has no CORS restrictions.
// =============================================================================
//
// async fetchClientSide(domain) {
//     const sources = [
//         `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
//         `https://icon.horse/icon/${domain}?size=large`,
//         `https://api.faviconkit.com/${domain}/128`,
//     ];
//
//     for (const source of sources) {
//         try {
//             const base64 = await this.fetchAndConvert(source);
//             if (base64) return base64;
//         } catch (e) {
//             continue;
//         }
//     }
//
//     return null;
// },
//
// async fetchAndConvert(imageUrl) {
//     return new Promise((resolve) => {
//         const img = new Image();
//         img.crossOrigin = 'anonymous';
//
//         img.onload = () => {
//             try {
//                 const canvas = document.createElement('canvas');
//                 const size = 32;
//                 canvas.width = size;
//                 canvas.height = size;
//
//                 const ctx = canvas.getContext('2d');
//                 ctx.imageSmoothingEnabled = true;
//                 ctx.imageSmoothingQuality = 'high';
//
//                 const scale = Math.min(size / img.width, size / img.height);
//                 const scaledWidth = img.width * scale;
//                 const scaledHeight = img.height * scale;
//                 const x = (size - scaledWidth) / 2;
//                 const y = (size - scaledHeight) / 2;
//
//                 ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
//
//                 const base64 = canvas.toDataURL('image/png', 1.0);
//
//                 if (base64 && base64.length > 200) {
//                     resolve(base64);
//                 } else {
//                     resolve(null);
//                 }
//             } catch (e) {
//                 resolve(null);
//             }
//         };
//
//         img.onerror = () => resolve(null);
//         setTimeout(() => resolve(null), 5000);
//         img.src = imageUrl;
//     });
// },

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FaviconFetcher;
}
