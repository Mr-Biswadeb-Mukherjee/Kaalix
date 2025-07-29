import dotenv from "dotenv";
dotenv.config();

import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET;

const generateToken = (payload) => {
  return jwt.sign(payload, SECRET, { expiresIn: "1h" });
};
console.log("🔐 JWT_SECRET (jwt.js):", SECRET);

export { generateToken };
