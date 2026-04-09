/**
 * Base URL for backend API calls.
 * Falls back to localhost:8000 if NEXT_PUBLIC_API_URL is not configured.
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
