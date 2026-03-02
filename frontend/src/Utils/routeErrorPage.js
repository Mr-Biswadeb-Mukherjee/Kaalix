import API from "@amon/shared";
import { getBackendErrorDisplay, parseApiResponse } from "./apiError";

const normalizeStatus = (statusCode) => {
  const parsed =
    Number.isInteger(statusCode) ? statusCode : Number.parseInt(statusCode, 10);

  if (Number.isInteger(parsed) && parsed >= 400 && parsed <= 599) {
    return parsed;
  }
  return 500;
};

const getFallbackErrorDetails = (statusCode) => {
  const status = normalizeStatus(statusCode);
  return {
    status,
    code: `HTTP_${status}_ERROR`,
    title: "Request failed",
    message: "Request failed.",
  };
};

const fetchRouteErrorDetails = async (statusCode) => {
  const status = normalizeStatus(statusCode);
  const endpoint = `${API.system.public.routeError.endpoint}/${status}`;

  try {
    const response = await fetch(endpoint, {
      method: API.system.public.routeError.method,
    });
    const payload = await parseApiResponse(response, { requireSuccess: true });

    if (payload?.error && typeof payload.error === "object") {
      return {
        ...getFallbackErrorDetails(status),
        ...payload.error,
      };
    }
  } catch (err) {
    if (typeof err?.status === "number") {
      return getBackendErrorDisplay(err);
    }
  }

  return getFallbackErrorDetails(status);
};

export { fetchRouteErrorDetails, getFallbackErrorDetails };
