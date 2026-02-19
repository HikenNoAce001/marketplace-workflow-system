import { useAuthStore } from "@/stores/auth-store";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

async function fetchWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const { getToken, setToken, logout } = useAuthStore.getState();

  // Skip Content-Type for FormData — browser needs to set the multipart boundary
  const isFormData = options.body instanceof FormData;

  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      ...(!isFormData && { "Content-Type": "application/json" }),
      ...(getToken() && { Authorization: `Bearer ${getToken()}` }),
      ...options.headers,
    },
    credentials: "include",
  });

  if (res.status === 401) {
    const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });

    if (refreshRes.ok) {
      const data = await refreshRes.json();
      setToken(data.access_token);
      return fetchWithAuth(url, options); // retry with fresh token
    }

    logout();
    if (typeof window !== "undefined") {
      window.location.href = "/auth/login";
    }
  }

  return res;
}

export const api = {
  get: (url: string) => fetchWithAuth(url),

  post: (url: string, body?: unknown) =>
    fetchWithAuth(url, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: (url: string, body?: unknown) =>
    fetchWithAuth(url, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: (url: string) => fetchWithAuth(url, { method: "DELETE" }),

  upload: (url: string, formData: FormData) =>
    fetchWithAuth(url, {
      method: "POST",
      body: formData,
      headers: {},
    }),

  // XHR-based upload for progress tracking (fetch doesn't support upload progress)
  uploadWithProgress: (
    url: string,
    formData: FormData,
    onProgress: (percent: number) => void,
  ): Promise<Response> => {
    const { getToken } = useAuthStore.getState();

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_BASE}${url}`);

      const token = getToken();
      if (token) {
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      }

      xhr.withCredentials = true;

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };

      xhr.onload = () => {
        const response = new Response(xhr.responseText, {
          status: xhr.status,
          statusText: xhr.statusText,
          headers: { "Content-Type": "application/json" },
        });
        resolve(response);
      };

      xhr.onerror = () => {
        reject(new Error("Network error during upload"));
      };

      xhr.send(formData);
    });
  },
};
