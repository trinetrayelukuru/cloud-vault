import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('cloudvault_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const userService = {
  // Get dashboard data
  async getDashboard() {
    const response = await api.get('/user/dashboard');
    return response.data;
  },

  // Get user profile
  async getProfile() {
    const response = await api.get('/user/profile');
    return response.data;
  },

  // Update user profile
  async updateProfile(name) {
    const response = await api.put('/user/profile', { name });
    return response.data;
  },

  // Get user files list
  async getFiles(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const response = await api.get(`/files/list?${queryString}`);
    return response.data;
  },

  // Upload a file
  async uploadFile(fileData) {
    const formData = new FormData();
    formData.append('file', fileData);
    const response = await api.post('/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  // Download a file
  async downloadFile(fileId) {
    const response = await api.get(`/files/download/${fileId}`);
    return response.data;
  },

  // Verify file integrity
  async verifyFileIntegrity(fileId) {
    const response = await api.post(`/files/${fileId}/verify`);
    return response.data;
  },

  // Delete a file
  async deleteFile(fileId) {
    const response = await api.delete(`/files/${fileId}`);
    return response.data;
  }
};

export default userService;
