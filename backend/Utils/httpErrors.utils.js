const HTTP_ERROR_CODES = Object.freeze({
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  405: "METHOD_NOT_ALLOWED",
  409: "CONFLICT",
  423: "LOCKED",
  429: "TOO_MANY_REQUESTS",
  500: "INTERNAL_SERVER_ERROR",
});

const HTTP_ERROR_MESSAGES = Object.freeze({
  400: "Bad request.",
  401: "Unauthorized request.",
  403: "Forbidden.",
  404: "Requested route was not found.",
  405: "Method not allowed.",
  409: "Request conflict.",
  423: "Resource is locked.",
  429: "Too many requests.",
  500: "Internal server error.",
});

const HTTP_ERROR_TITLES = Object.freeze({
  400: "Bad request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not found",
  405: "Method not allowed",
  409: "Conflict",
  423: "Locked",
  429: "Too many requests",
  500: "Server error",
});

const normalizeHttpStatus = (statusCode) => {
  if (Number.isInteger(statusCode) && statusCode >= 400 && statusCode <= 599) {
    return statusCode;
  }
  return 500;
};

const defaultErrorCode = (statusCode) =>
  HTTP_ERROR_CODES[statusCode] || `HTTP_${statusCode}_ERROR`;

const defaultErrorMessage = (statusCode) =>
  HTTP_ERROR_MESSAGES[statusCode] || "Request failed.";

const defaultErrorTitle = (statusCode) =>
  HTTP_ERROR_TITLES[statusCode] || "Request failed";

const resolveErrorMeta = (statusCode) => {
  const status = normalizeHttpStatus(statusCode);

  return {
    status,
    code: defaultErrorCode(status),
    title: defaultErrorTitle(status),
    message: defaultErrorMessage(status),
  };
};

export {
  normalizeHttpStatus,
  defaultErrorCode,
  defaultErrorMessage,
  defaultErrorTitle,
  resolveErrorMeta,
};
