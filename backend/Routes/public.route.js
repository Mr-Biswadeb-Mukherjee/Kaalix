import express from "express";
import API from "@amon/shared";
import authRouter from "../Controller/Auth.controller.js";
import logoutHandler from "../Controller/Logout.controller.js";
import authMiddleware from "../Middleware/auth.middleware.js";
import { GetCaptcha } from "../Controller/Captcha.controller.js";

const publicRouter = express.Router();

// Captcha
publicRouter.get(API.system.public.captcha.endpoint, GetCaptcha);

// Auth
publicRouter.use(API.system.public.login.endpoint, authRouter);
publicRouter.post(API.system.public.logout.endpoint, authMiddleware({ revoke: false }), logoutHandler);

// Verify Token
publicRouter.post(
  API.system.public.verify.endpoint,
  authMiddleware({ revoke: false, allowDuringOnboarding: true }),
  (req, res) => {
    res.status(200).json({
      message: "Token is valid",
      user: req.user,
      onboarding: req.onboarding || null,
    });
  }
);

export default publicRouter;
