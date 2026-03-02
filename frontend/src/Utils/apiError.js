const defaultCodeForStatus = (status) =>
  Number.isInteger(status) ? `HTTP_${status}_ERROR` : "HTTP_ERROR";

const defaultTitle = () => "Request failed";

const defaultMessageForStatus = (statusText = "") =>
  statusText && statusText.trim() ? statusText : "Request failed.";

export const getBackendErrorMessage = (err) => {
  if (!err) return "Request failed.";

  if (typeof err.status === "number") {
    const code =
      typeof err.code === "string" && err.code.trim()
        ? err.code.trim()
        : defaultCodeForStatus(err.status);
    const message =
      typeof err.backendMessage === "string" && err.backendMessage.trim()
        ? err.backendMessage
        : typeof err.message === "string" && err.message.trim()
          ? err.message
          : defaultMessageForStatus();
    return `${err.status} ${code}: ${message}`;
  }

  if (typeof err.message === "string" && err.message.trim()) {
    return err.message;
  }

  return "Request failed.";
};

export const getBackendErrorDisplay = (err) => {
  const status = typeof err?.status === "number" ? err.status : 500;
  const code =
    typeof err?.code === "string" && err.code.trim()
      ? err.code.trim()
      : defaultCodeForStatus(status);
  const message =
    typeof err?.backendMessage === "string" && err.backendMessage.trim()
      ? err.backendMessage
      : typeof err?.message === "string" && err.message.trim()
        ? err.message
        : defaultMessageForStatus();
  const title =
    typeof err?.backendTitle === "string" && err.backendTitle.trim()
      ? err.backendTitle
      : defaultTitle();

  return {
    status,
    code,
    title,
    message,
  };
};

const readJsonSafe = async (response) => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};

const toBackendError = (response, payload = {}) => {
  const status = response.status;
  const code =
    typeof payload.code === "string" && payload.code.trim()
      ? payload.code.trim()
      : defaultCodeForStatus(status);
  const backendTitle =
    typeof payload.title === "string" && payload.title.trim()
      ? payload.title.trim()
      : defaultTitle();
  const backendMessage =
    typeof payload.message === "string" && payload.message.trim()
      ? payload.message
      : defaultMessageForStatus(response.statusText);

  const err = new Error(`${status} ${code}: ${backendMessage}`);
  err.status = status;
  err.code = code;
  err.backendTitle = backendTitle;
  err.backendMessage = backendMessage;
  err.data = payload;
  return err;
};

export const parseApiResponse = async (response, options = {}) => {
  const payload = await readJsonSafe(response);
  const requireSuccess = options.requireSuccess === true;

  if (!response.ok) {
    throw toBackendError(response, payload);
  }

  if (requireSuccess && payload?.success === false) {
    throw toBackendError(response, payload);
  }

  return payload;
};
