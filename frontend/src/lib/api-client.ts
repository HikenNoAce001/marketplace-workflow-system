import { useAuthStore } from "@/stores/auth-store";

/**
 * Custom fetch wrapper with automatic token management.
 *
 * WHY NOT AXIOS?
 * - Native fetch integrates with Next.js 16 caching & streaming
 * - Axios adds unnecessary bundle weight
 * - This wrapper is ~40 lines and does everything we need
 *
 * HOW IT WORKS:
 * 1. Every request gets Authorization: Bearer <token> from Zustand
 * 2. If the server returns 401 (token expired), we try to refresh
 * 3. The refresh call sends the httpOnly cookie automatically
 * 4. If refresh works, we retry the original request with the new token
 * 5. If refresh fails, we clear state and redirect to login
 *
 * IMPORTANT: credentials: "include" ensures the httpOnly refresh
 * cookie is sent with every request (needed for refresh endpoint).
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

async function fetchWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // Get auth actions from Zustand store (works outside React components)
  const { getToken, setToken, logout } = useAuthStore.getState();

  // Build the request with auth header
  // Skip Content-Type for FormData — the browser MUST set it automatically
  // with the multipart boundary string. If we set it manually, the server
  // can't parse the multipart body (boundary is missing → 422 error).
  const isFormData = options.body instanceof FormData;

  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      // Only set JSON Content-Type for non-FormData requests
      ...(!isFormData && { "Content-Type": "application/json" }),
      // Only attach token if we have one (login/register don't need it)
      ...(getToken() && { Authorization: `Bearer ${getToken()}` }),
      // Spread any custom headers from the caller
      ...options.headers,
    },
    // "include" means browser sends cookies (our httpOnly refresh token)
    credentials: "include",
  });

  // If 401 = token expired, try to refresh it
  if (res.status === 401) {
    const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include", // sends the httpOnly refresh cookie
    });

    if (refreshRes.ok) {
      // Refresh succeeded — store new token and retry the original request
      const data = await refreshRes.json();
      setToken(data.access_token);
      return fetchWithAuth(url, options); // retry with new token
    }

    // Refresh failed — user's session is truly expired
    logout();
    // Redirect to login (only in browser, not during SSR)
    if (typeof window !== "undefined") {
      window.location.href = "/auth/login";
    }
  }

  return res;
}

/**
 * API client object — provides clean methods for each HTTP verb.
 *
 * Usage examples:
 *   const res = await api.get("/projects");
 *   const res = await api.post("/projects", { title: "My Project" });
 *   const res = await api.upload("/tasks/123/submissions", formData);
 */
export const api = {
  /** GET request — for fetching data */
  get: (url: string) => fetchWithAuth(url),

  /** POST request — for creating resources */
  post: (url: string, body?: unknown) =>
    fetchWithAuth(url, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),

  /** PATCH request — for partial updates */
  patch: (url: string, body?: unknown) =>
    fetchWithAuth(url, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    }),

  /** DELETE request — for removing resources */
  delete: (url: string) => fetchWithAuth(url, { method: "DELETE" }),

  /**
   * File upload — sends FormData (multipart/form-data).
   * We pass empty headers {} so the browser sets Content-Type
   * with the correct multipart boundary automatically.
   * If we set Content-Type manually, the boundary would be missing
   * and the server would reject the upload.
   */
  upload: (url: string, formData: FormData) =>
    fetchWithAuth(url, {
      method: "POST",
      body: formData,
      headers: {}, // Let browser set Content-Type with boundary
    }),

  /**
   * File upload WITH progress tracking — uses XMLHttpRequest.
   *
   * WHY XMLHttpRequest instead of fetch?
   * Native fetch does NOT support upload progress events. The only way
   * to get granular upload progress (0%→100%) is XMLHttpRequest's
   * `upload.onprogress` event. This matters for ZIP files that can be
   * up to 50MB — users need to see something is happening.
   *
   * HOW IT WORKS:
   * 1. Opens XHR to the API endpoint
   * 2. Attaches Bearer token from Zustand (same as fetchWithAuth)
   * 3. Sends FormData (browser sets Content-Type with boundary)
   * 4. Calls onProgress(0-100) as bytes are sent
   * 5. Resolves with parsed JSON on success, rejects on error
   *
   * NOTE: This does NOT handle 401 auto-refresh (XHR makes it complex).
   * If the token expired mid-upload, the user gets an error and retries.
   * Uploads are short-lived (seconds), so token expiry during upload is rare.
   */
  uploadWithProgress: (
    url: string,
    formData: FormData,
    onProgress: (percent: number) => void,
  ): Promise<Response> => {
    const { getToken } = useAuthStore.getState();

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_BASE}${url}`);

      // Attach Bearer token (same as fetchWithAuth)
      const token = getToken();
      if (token) {
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      }

      // Send cookies (refresh token) — equivalent to credentials: "include"
      xhr.withCredentials = true;

      // Track upload progress — fires as bytes are sent to the server
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };

      // Upload complete — resolve with a Response-like object
      xhr.onload = () => {
        // Create a Response object so callers can use the same .ok/.json() pattern
        const response = new Response(xhr.responseText, {
          status: xhr.status,
          statusText: xhr.statusText,
          headers: { "Content-Type": "application/json" },
        });
        resolve(response);
      };

      // Network error — connection failed, CORS blocked, etc.
      xhr.onerror = () => {
        reject(new Error("Network error during upload"));
      };

      // Don't set Content-Type — let browser set it with multipart boundary
      xhr.send(formData);
    });
  },
};
