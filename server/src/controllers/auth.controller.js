import { loginUser, registerUser } from "../services/auth.service.js";

export const register = async (req, res, next) => {
  try {
    const result = await registerUser(req.body);
    res.status(result.status).json(result);
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const result = await loginUser(req.body);
    res.status(result.status).json(result);
  } catch (error) {
    next(error);
  }
};
