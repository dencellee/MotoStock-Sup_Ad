/**
 * Get the base URL for API calls
 * Returns the current origin (protocol + host) for relative API requests
 */
export function getApiBaseUrl(): string {
	if (typeof window !== 'undefined') {
		return window.location.origin;
	}
	// Fallback for server-side rendering
	return '';
}
