import User from "../models/User.model.js";
import ExpressError from "../utils/ExpreeError.util.js";
import { successResponse } from "../utils/response.util.js";
import { createToken } from "../utils/token.js";

const userData = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
});
const authData = (user) => ({
  token: createToken(user.id),
  user: userData(user),
});

export const registerUser = async ({ name, email, password }) => {
  if (!name || !email || !password)
    throw new ExpressError(400, "Name, email and password are required");
  try {
    const user = await User.create({ name, email, password });
    return successResponse(authData(user), "Registration successful", 201);
  } catch (error) {
    if (error.code === 11000)
      throw new ExpressError(409, "Email already registered");
    throw error;
  }
};

export const loginUser = async ({ email, password }) => {
  if (!email || !password)
    throw new ExpressError(400, "Email and password are required");
  const user = await User.findOne({ email }).select("+password");
  if (!user || !(await user.comparePassword(password)))
    throw new ExpressError(401, "Invalid email or password");
  return successResponse(authData(user), "Login successful");
};
