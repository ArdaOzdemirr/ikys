import axios, { AxiosInstance } from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

class ApiClient {
  private client: AxiosInstance;
  private isRefreshing = false;
  private failedQueue: Array<{ resolve: (v: any) => void; reject: (e: any) => void }> = [];

  constructor() {
    this.client = axios.create({ baseURL: API_URL, timeout: 30000 });

    // Request interceptor - access token ekle
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('accessToken');
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    });

    // Response interceptor - 401'de refresh et
    this.client.interceptors.response.use(
      (res) => res,
      async (error) => {
        const original = error.config;
        if (error.response?.status === 401 && !original._retry) {
          if (this.isRefreshing) {
            return new Promise((resolve, reject) => {
              this.failedQueue.push({ resolve, reject });
            }).then((token) => {
              original.headers.Authorization = `Bearer ${token}`;
              return this.client(original);
            });
          }

          original._retry = true;
          this.isRefreshing = true;

          try {
            const refreshToken = localStorage.getItem('refreshToken');
            if (!refreshToken) throw new Error('No refresh token');

            const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
            localStorage.setItem('accessToken', data.accessToken);
            localStorage.setItem('refreshToken', data.refreshToken);

            this.failedQueue.forEach((p) => p.resolve(data.accessToken));
            this.failedQueue = [];

            original.headers.Authorization = `Bearer ${data.accessToken}`;
            return this.client(original);
          } catch (err) {
            this.failedQueue.forEach((p) => p.reject(err));
            this.failedQueue = [];
            localStorage.clear();
            window.location.href = '/login';
            return Promise.reject(err);
          } finally {
            this.isRefreshing = false;
          }
        }
        return Promise.reject(error);
      },
    );
  }

  get<T = any>(url: string, params?: any) {
    return this.client.get<T>(url, { params }).then((r) => r.data);
  }
  post<T = any>(url: string, data?: any) {
    return this.client.post<T>(url, data).then((r) => r.data);
  }
  patch<T = any>(url: string, data?: any) {
    return this.client.patch<T>(url, data).then((r) => r.data);
  }
  put<T = any>(url: string, data?: any) {
    return this.client.put<T>(url, data).then((r) => r.data);
  }
  async getBlob(url: string): Promise<Blob> {
    const r = await this.client.get(url, { responseType: 'blob' });
    return r.data as Blob;
  }
  // Korumalı (JWT gerektiren) dosya url'lerini yeni sekmede açar; düz <a href>
  // çalışmaz çünkü tarayıcı navigasyonu Authorization header'ı eklemez.
  async openProtectedFile(url: string) {
    // Backend mutlak yol döner (örn. /api/v1/payroll/...); baseURL ('/api/v1')
    // ile üst üste binmesin diye o öneki burada düşürüyoruz.
    const path = url.replace(/^\/api\/v1/, '');
    const blob = await this.getBlob(path);
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, '_blank');
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  }
  delete<T = any>(url: string) {
    return this.client.delete<T>(url).then((r) => r.data);
  }
  // PDF gibi binary indirimler için
  download(url: string, filename: string) {
    return this.client.get(url, { responseType: 'blob' }).then((res) => {
      const blob = new Blob([res.data]);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
    });
  }
}

export const api = new ApiClient();
