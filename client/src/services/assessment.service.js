import api from "./api";

export const startAssessment = (values) => api.post("/assessments/start", values).then((response) => response.data);
export const askAssistant = (id, values) => api.post(`/assessments/${id}/assistant`, values).then((response) => response.data);
export const submitAssessment = (id, values) => api.post(`/assessments/${id}/submit`, values).then((response) => response.data);
