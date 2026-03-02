import { getMonitoringSnapshot } from "../Middleware/APILogger.middleware.js";

export const FetchMonitoringSnapshot = async (req, res) => {
  void req;
  try {
    const monitoring = getMonitoringSnapshot();
    return res.status(200).json({
      success: true,
      monitoring,
    });
  } catch (err) {
    console.error("Error in FetchMonitoringSnapshot:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch monitoring snapshot.",
      code: "MONITORING_FETCH_FAILED",
    });
  }
};
