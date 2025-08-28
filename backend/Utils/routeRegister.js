import API from "@amon/shared";
import authRouter from "../Modules/auth.js";
import logoutHandler from "../Modules/Logout.js";
import authMiddleware from "../Middleware/authMiddleware.js";
import { generateCaptcha } from "../Modules/captcha.js";
import Ratelimiter from "../Utils/ratelimiter.js";

const handlers = {
  auth: authRouter,
  logout: logoutHandler,
  verify: [
    authMiddleware({ revoke: false }),
    (req, res) => res.status(200).json({ message: "Token is valid", user: req.user })
  ],
  captchaHandler: (req, res) => {
    const { id, image } = generateCaptcha();
    res.status(200).json({ id, image });
  },
};

export default function routeRegister(app) {
  const registerGroup = (group, isProtected = false) => {
    Object.values(group).forEach(({ method, endpoint, handler }) => {
      const chain = [];
      chain.push(Ratelimiter());
      if (isProtected) chain.push(authMiddleware);
      const resolved = handlers[handler];
      if (!resolved) {
        //console.warn(`⚠️ No handler found for ${endpoint} (${handler})`);
        return;
      }

      if (resolved.name === "router" || resolved.stack) {
        app.use(endpoint, ...chain, resolved);
      } else {
        if (Array.isArray(resolved)) chain.push(...resolved);
        else chain.push(resolved);

        app[method.toLowerCase()](endpoint, ...chain);
      }

      //console.log(`✅ Registered [${method}] ${endpoint} -> ${handler}`);
    });
  };

  // --- Register groups ---
  registerGroup(API.system.public, false);
  registerGroup(API.system.protected, true);
}
