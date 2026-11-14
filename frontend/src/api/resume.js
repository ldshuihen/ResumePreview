import axios from 'axios'

const http = axios.create({
  baseURL: '/api',
  timeout: 8000
})

export const resumeApi = {
  listResumes: () => http.get('/resumes').then(r => r.data),
  getResume: (id) => http.get(`/resumes/${id}`).then(r => r.data),
  createResume: (data) => http.post('/resumes', data).then(r => r.data),
  updateResume: (id, data) => http.put(`/resumes/${id}`, data).then(r => r.data),
  deleteResume: (id) => http.delete(`/resumes/${id}`),
  listTemplates: () => http.get('/templates').then(r => r.data),
  polishText: (text, mode = 'star') => http.post('/ai/polish', { text, mode }).then(r => r.data),
  uploadAvatar: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return http.post('/upload/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then(r => r.data)
  }
}

