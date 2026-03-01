import { generateCaptcha } from "../Services/captcha.service.js";

export const GetCaptcha = async (req, res, next) => {
  try {
    const { id, image } = await generateCaptcha();
    return res.status(200).json({ id, image });
  } catch (err) {
    return next(err);
  }
};
