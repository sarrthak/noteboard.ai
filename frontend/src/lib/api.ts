import axios from "axios";

/**
 * Base URL for backend API calls (client-side).
 * Falls back to localhost:8000 if NEXT_PUBLIC_API_URL is not configured.
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Base URL for server-side API calls (e.g. NextAuth authorize).
 * Inside Docker, localhost doesn't reach the backend container — use
 * INTERNAL_API_URL (e.g. http://backend_api:8000) when available.
 */
export const SERVER_API_BASE_URL =
  process.env.INTERNAL_API_URL || API_BASE_URL;

export function createAuthenticatedApi(accessToken: string) {
  return axios.create({
    baseURL: API_BASE_URL,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}
