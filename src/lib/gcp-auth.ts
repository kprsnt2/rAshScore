/**
 * GCP Authentication Module (WIF via Google Auth Library)
 * 
 * Uses google-auth-library to automatically pick up credentials from the environment.
 * When running in GitHub Actions with google-github-actions/auth,
 * GOOGLE_APPLICATION_CREDENTIALS is set automatically via Workload Identity Federation.
 */
import { GoogleAuth } from 'google-auth-library';

const auth = new GoogleAuth({
    scopes: 'https://www.googleapis.com/auth/cloud-platform'
});

/**
 * Get a valid GCP OAuth2 access token.
 * Automatically handles Workload Identity Federation (WIF) token exchange and caching.
 */
export async function getAccessToken(): Promise<string> {
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    
    if (!tokenResponse.token) {
        throw new Error("Failed to retrieve GCP access token");
    }
    
    return tokenResponse.token;
}

/**
 * Get the GCP project ID.
 */
export function getProjectId(): string {
    return process.env.GCP_PROJECT_ID || 'rashscore';
}

/**
 * Get the GCP region.
 */
export function getRegion(): string {
    return process.env.GCP_REGION || 'us-central1';
}
