import { resolveErrorMeta } from "../Utils/httpErrors.utils.js";

const getErrorDetails = (req, res) => {
  const parsedStatus = Number.parseInt(req.params.statusCode, 10);

  if (!Number.isInteger(parsedStatus) || parsedStatus < 400 || parsedStatus > 599) {
    return res.status(400).json({
      code: "INVALID_HTTP_STATUS",
      title: "Bad request",
      message: "Status code must be an integer between 400 and 599.",
    });
  }

  return res.status(200).json({
    success: true,
    error: resolveErrorMeta(parsedStatus),
  });
};

export { getErrorDetails };
