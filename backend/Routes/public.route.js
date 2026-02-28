import express from "express";
import API from "@amon/shared";
import authRouter from "../Services/auth.service.js";
import logoutHandler from "../Services/logout.service.js";
import authMiddleware from "../Middleware/auth.middleware.js";
import { generateCaptcha } from "../Services/captcha.service.js";

const publicRouter = express.Router();

// Captcha
publicRouter.get(API.system.public.captcha.endpoint, async (req, res, next) => {
  try {
    const { id, image } = await generateCaptcha();
    res.status(200).json({ id, image });
  } catch (err) {
    next(err);
  }
});

// Auth
publicRouter.use(API.system.public.login.endpoint, authRouter);
publicRouter.post(API.system.public.logout.endpoint, authMiddleware({ revoke: true }), logoutHandler);

// Verify Token
publicRouter.post(API.system.public.verify.endpoint, authMiddleware({ revoke: false }), (req, res) => {
  res.status(200).json({ message: "Token is valid", user: req.user });
});

export default publicRouter;
