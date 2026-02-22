import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5000/api/v1';

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Add token to requests
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Get token from localStorage
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('accessToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle token refresh and errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle token expiration
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          const response = await axios.post(
            `${API_BASE_URL}/auth/refresh-token`,
            { refreshToken }
          );

          const { accessToken, refreshToken: newRefreshToken } = response.data.data;
          localStorage.setItem('accessToken', accessToken);
          if (newRefreshToken) {
            localStorage.setItem('refreshToken', newRefreshToken);
          }

          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // Redirect to login on refresh failure
        if (typeof window !== 'undefined') {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/auth/login';
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;

// Auth API endpoints
export const authAPI = {
  login: (email: string, password: string) =>
    apiClient.post('/auth/login', { email, password }),

  forgotPassword: (email: string) =>
    apiClient.post('/auth/forget', { email }),

  resetPassword: (email: string, otp: string, password: string, confirmPassword: string) =>
    apiClient.post('/auth/reset-password', { email, otp, password, confirmPassword }),

  changePassword: (oldPassword: string, newPassword: string) =>
    apiClient.post('/auth/change-password', { oldPassword, newPassword }),

  refreshToken: (refreshToken: string) =>
    apiClient.post('/auth/refresh-token', { refreshToken }),
};

// Dashboard API endpoints
export const dashboardAPI = {
  getOverview: (period: 'day' | 'week' | 'month' | 'year' = 'month') =>
    apiClient.get(`/seller/dashboard/overview?period=${period}`),

  getSalesHistory: (page = 1, limit = 10) =>
    apiClient.get(`/seller/dashboard/sales?page=${page}&limit=${limit}`),
};

// Category API endpoints
export const categoryAPI = {
  getCategories: () => apiClient.get('/category'),
};

// Product API endpoints
export const productAPI = {
  getMyProducts: (page = 1, limit = 10) =>
    apiClient.get(`/product/my?page=${page}&limit=${limit}`),

  getProductById: (id: string) => apiClient.get(`/product/${id}`),

  addProduct: (data: FormData) =>
    apiClient.post('/product/add', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  updateProduct: (id: string, data: FormData) =>
    apiClient.put(`/product/${id}`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  deleteProduct: (id: string) => apiClient.delete(`/product/${id}`),
};

// Order API endpoints
export const orderAPI = {
  getOrders: (status?: string, page = 1, limit = 10) =>
    apiClient.get('/order', {
      params: {
        status,
        page,
        limit,
      },
    }),

  getOrderDetails: (orderId: string) => apiClient.get(`/order/${orderId}`),

  updateOrderStatus: (orderId: string, status: string, trackingNumber?: string) =>
    apiClient.patch(`/order/${orderId}/status`, { status, trackingNumber }),
};

// Subscription API endpoints
export const subscriptionAPI = {
  getSubscriptions: () => apiClient.get('/subscription'),
};

// User API endpoints
export const userAPI = {
  getProfile: () => apiClient.get('/user/profile'),

  updateProfile: (data: any) => apiClient.put('/user/profile', data),

  changePassword: (currentPassword: string, newPassword: string, confirmPassword: string) =>
    apiClient.put('/user/password', { currentPassword, newPassword, confirmPassword }),
};

// Shop API endpoints
export const shopAPI = {
  getMyShop: () => apiClient.get('/shop/my'),
  updateMyShop: (data: FormData) =>
    apiClient.put('/shop/my', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

// Chat API endpoints
export const chatAPI = {
  getMyCustomers: () => apiClient.get('/chat/my-customers'),
  getChatById: (chatId: string) => apiClient.get(`/chat/${chatId}`),
  sendMessage: (
    chatId: string,
    message: string,
    files?: File[],
    options?: { askPrice?: boolean; productId?: string }
  ) => {
    if (files && files.length > 0) {
      const fd = new FormData();
      fd.append('chatId', chatId);
      if (message) fd.append('message', message);
      if (options?.askPrice !== undefined) fd.append('askPrice', String(options.askPrice));
      if (options?.productId) fd.append('productId', options.productId);
      files.forEach((file) => fd.append('files', file));
      return apiClient.post('/chat/message', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }

    return apiClient.post('/chat/message', {
      chatId,
      message,
      askPrice: options?.askPrice,
      productId: options?.productId,
    });
  },
};

// Payment API endpoints
export const paymentAPI = {
  createPayment: (data: {
    userId: string;
    price: number;
    subscriptionId?: string;
    orderId?: string;
    type: 'subscription' | 'order';
    billingPeriod?: 'monthly' | 'yearly';
  }) => apiClient.post('/payment/create-payment', data),
  confirmPayment: (paymentIntentId: string) =>
    apiClient.post('/payment/confirm-payment', { paymentIntentId }),
};
