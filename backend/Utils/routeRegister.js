import API from "@amon/shared";
import authRouter from "../Modules/auth.js";
import logoutHandler from "../Modules/Logout.js";
import authMiddleware from "../Middleware/authMiddleware.js";
import { generateCaptcha } from "../Modules/captcha.js";

const handlers = {
  // Routers
  auth: authRouter,

  // Functions
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

      if (isProtected) chain.push(authMiddleware);

      const resolved = handlers[handler];
      if (!resolved) {
        console.warn(`⚠️ No handler found for ${endpoint} (${handler})`);
        return;
      }

      if (resolved.name === "router" || resolved.stack) {
        // Looks like an Express Router → always use app.use
        app.use(endpoint, ...chain, resolved);
      } else {
        // Normal handler
        if (Array.isArray(resolved)) {
          chain.push(...resolved);
        } else {
          chain.push(resolved);
        }
        app[method.toLowerCase()](endpoint, ...chain);
      }

      console.log(`✅ Registered [${method}] ${endpoint} -> ${handler}`);
    });
  };

  registerGroup(API.system.public, false);
  registerGroup(API.system.protected, true);
}