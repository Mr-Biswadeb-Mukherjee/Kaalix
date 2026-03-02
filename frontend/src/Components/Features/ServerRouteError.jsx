import { useEffect, useState } from "react";
import RouteError from "./RouteError";
import {
  fetchRouteErrorDetails,
  getFallbackErrorDetails,
} from "../../Utils/routeErrorPage";

const ServerRouteError = ({ status, actionLabel = "", onAction = null }) => {
  const [errorDetails, setErrorDetails] = useState(() =>
    getFallbackErrorDetails(status)
  );

  useEffect(() => {
    let mounted = true;

    const loadErrorDetails = async () => {
      const data = await fetchRouteErrorDetails(status);
      if (!mounted) return;
      setErrorDetails(data);
    };

    loadErrorDetails();

    return () => {
      mounted = false;
    };
  }, [status]);

  return (
    <RouteError
      status={errorDetails.status}
      code={errorDetails.code}
      title={errorDetails.title}
      message={errorDetails.message}
      actionLabel={actionLabel}
      onAction={onAction}
    />
  );
};

export default ServerRouteError;
