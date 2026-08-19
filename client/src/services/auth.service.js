import api from "./api";

export const login = (values) => api.post("/auth/login", values).then((response) => response.data);
export const register = (values) => api.post("/auth/register", values).then((response) => response.data);
