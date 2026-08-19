import User from "../models/User.model.js";
import ExpressError from "../utils/ExpreeError.util.js";
import { readToken } from "../utils/token.js";

export const protect = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const data = token && readToken(token);
    if (!data) throw new ExpressError(401, "Please sign in");
    req.user = await User.findById(data.userId);
    if (!req.user) throw new ExpressError(401, "User not found");
    next();
  } catch (error) {
    next(error);
  }
};
