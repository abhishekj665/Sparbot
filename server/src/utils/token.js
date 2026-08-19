import crypto from "crypto";
import { env } from "../config/env.js";

const encode = (value) => Buffer.from(value).toString("base64url");

export const createToken = (userId) => {
  const payload = encode(
    JSON.stringify({ userId, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 }),
  );
  const signature = crypto
    .createHmac("sha256", env.tokenSecret)
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
};

export const readToken = (token) => {
  const [payload, signature] = token.split(".");
  const expected = crypto
    .createHmac("sha256", env.tokenSecret)
    .update(payload)
    .digest("base64url");
  if (
    !payload ||
    !signature ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  )
    return null;
  const data = JSON.parse(Buffer.from(payload, "base64url").toString());
  return data.exp > Date.now() ? data : null;
};
