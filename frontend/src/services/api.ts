import axios, { AxiosError, AxiosRequestConfig } from "axios";
import type { 
  User, 
  Job, 
  JobFilters, 
  Application, 
  ApplicationStatus,
  Resume, 
  CoverLetter, 
  Interview, 
  Analytics,
  AgentStatus,
  AgentLog,
  ChatMessage,
  UserSettings,
  DashboardStats,
  Activity
} from "@/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("token");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: async (email: string, password: string) => {
    const response = await api.post<{ access_token: string; token_type: string; expires_in: number }>("/api/auth/login", {
      email,
      password,
    });
    // Store token and fetch user separately
    if (response.data.access_token) {
      localStorage.setItem("token", response.data.access_token);
    }
    // Fetch user data after login
    const userResponse = await api.get<User>("/api/auth/me");
    return { access_token: response.data.access_token, user: userResponse.data };
  },

  register: async (name: string, email: string, password: string) => {
    const response = await api.post<{ access_token: string; token_type: string; expires_in: number }>("/api/auth/register", {
      full_name: name,
      email,
      password,
    });
    // Store token and fetch user separately
    if (response.data.access_token) {
      localStorage.setItem("token", response.data.access_token);
    }
    // Fetch user data after registration
    const userResponse = await api.get<User>("/api/auth/me");
    return { access_token: response.data.access_token, user: userResponse.data };
  },

  logout: () => {
    localStorage.removeItem("token");
  },

  getCurrentUser: async () => {
    const response = await api.get<User>("/api/auth/me");
    return response.data;
  },
};

// Jobs API
export const jobsApi = {
  getJobs: async (filters?: JobFilters) => {
    const response = await api.get<{ items: Job[] }>("/api/jobs", { params: filters });
    return response.data.items || [];
  },

  getJobById: async (id: string) => {
    const response = await api.get<Job>(`/api/jobs/${id}`);
    return response.data;
  },

  scrapeJobs: async () => {
    const response = await api.post<{ message: string }>("/api/jobs/scrape");
    return response.data;
  },
};

// Applications API
export const applicationsApi = {
  getApplications: async () => {
    const response = await api.get<{ items: Application[] }>("/api/applications");
    return response.data.items || [];
  },

  getApplicationById: async (id: string) => {
    const response = await api.get<Application>(`/api/applications/${id}`);
    return response.data;
  },

  createApplication: async (jobId: string, resumeId?: string, coverLetterId?: string) => {
    const response = await api.post<Application>("/api/applications", {
      jobId,
      resumeId,
      coverLetterId,
    });
    return response.data;
  },

  updateApplicationStatus: async (id: string, status: ApplicationStatus) => {
    const response = await api.patch<Application>(`/api/applications/${id}/status`, {
      status,
    });
    return response.data;
  },

  deleteApplication: async (id: string) => {
    await api.delete(`/api/applications/${id}`);
  },
};

// Resumes API
export const resumesApi = {
  getResumes: async () => {
    const response = await api.get<{ items: Resume[] }>("/api/resumes");
    return response.data.items || [];
  },

  getResumeById: async (id: string) => {
    const response = await api.get<Resume>(`/api/resumes/${id}`);
    return response.data;
  },

  uploadResume: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post<Resume>("/api/resumes/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  generateResume: async (jobId: string) => {
    const response = await api.post<Resume>("/api/resumes/generate", { jobId });
    return response.data;
  },

  deleteResume: async (id: string) => {
    await api.delete(`/api/resumes/${id}`);
  },
};

// Cover Letters API
export const coverLettersApi = {
  getCoverLetters: async () => {
    const response = await api.get<{ items: CoverLetter[] }>("/api/cover-letters");
    return response.data.items || [];
  },

  getCoverLetterById: async (id: string) => {
    const response = await api.get<CoverLetter>(`/api/cover-letters/${id}`);
    return response.data;
  },

  generateCoverLetter: async (jobId: string) => {
    const response = await api.post<CoverLetter>("/api/cover-letters/generate", { jobId });
    return response.data;
  },

  deleteCoverLetter: async (id: string) => {
    await api.delete(`/api/cover-letters/${id}`);
  },
};

// Interviews API
export const interviewsApi = {
  getInterviews: async () => {
    const response = await api.get<{ items: Interview[] }>("/api/interviews");
    return response.data.items || [];
  },

  getInterviewById: async (id: string) => {
    const response = await api.get<Interview>(`/api/interviews/${id}`);
    return response.data;
  },

  createInterview: async (applicationId: string, interviewDate: string, interviewType: string) => {
    const response = await api.post<Interview>("/api/interviews", {
      applicationId,
      interviewDate,
      interviewType,
    });
    return response.data;
  },

  updateInterview: async (id: string, data: Partial<Interview>) => {
    const response = await api.patch<Interview>(`/api/interviews/${id}`, data);
    return response.data;
  },
};

// Analytics API
export const analyticsApi = {
  getAnalytics: async () => {
    const response = await api.get<Analytics>("/api/analytics");
    return response.data;
  },

  getDashboardStats: async () => {
    const response = await api.get<DashboardStats>("/api/analytics/stats");
    return response.data;
  },

  getActivityFeed: async (limit?: number) => {
    const response = await api.get<Activity[]>("/api/analytics/activity", { 
      params: { limit } 
    });
    return response.data;
  },
};

// Agent API
export const agentApi = {
  getStatus: async () => {
    const response = await api.get<AgentStatus>("/api/agent/status");
    return response.data;
  },

  updateStatus: async (status: Partial<AgentStatus>) => {
    const response = await api.patch<AgentStatus>("/api/agent/status", status);
    return response.data;
  },

  runAgentCycle: async () => {
    const response = await api.post<AgentLog>("/api/agent/run");
    return response.data;
  },

  pauseAutomation: async () => {
    const response = await api.post<AgentStatus>("/api/agent/pause");
    return response.data;
  },

  getLogs: async (limit?: number) => {
    const response = await api.get<AgentLog[]>("/api/agent/logs", { 
      params: { limit } 
    });
    return response.data;
  },
};

// Chat API
export const chatApi = {
  sendMessage: async (message: string, conversationId?: string) => {
    const response = await api.post<ChatMessage>("/api/chat/message", {
      message,
      conversationId,
    });
    return response.data;
  },

  getConversations: async () => {
    const response = await api.get("/api/chat/conversations");
    return response.data;
  },

  getConversation: async (id: string) => {
    const response = await api.get(`/api/chat/conversations/${id}`);
    return response.data;
  },
};

// Settings API
export const settingsApi = {
  getSettings: async () => {
    const response = await api.get<UserSettings>("/api/settings");
    return response.data;
  },

  updateSettings: async (settings: Partial<UserSettings>) => {
    const response = await api.patch<UserSettings>("/api/settings", settings);
    return response.data;
  },
};

// Profile API
export const profileApi = {
  getProfile: async () => {
    const response = await api.get("/api/profile");
    return response.data;
  },

  updateProfile: async (profile: Record<string, unknown>) => {
    const response = await api.patch("/api/profile", profile);
    return response.data;
  },

  addSkill: async (skill: { name: string; proficiency: string }) => {
    const response = await api.post("/api/profile/skills", skill);
    return response.data;
  },

  removeSkill: async (skillId: string) => {
    const response = await api.delete(`/api/profile/skills/${skillId}`);
    return response.data;
  },
};

export default api;
