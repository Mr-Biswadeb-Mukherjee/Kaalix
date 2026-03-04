import { fetchRecentLoginHistory } from "../Services/loginHistory.service.js";

const parseLimit = (rawLimit) => {
  const parsed = Number.parseInt(rawLimit, 10);
  if (!Number.isFinite(parsed)) return 10;
  if (parsed < 1) return 1;
  if (parsed > 10) return 10;
  return parsed;
};

export const FetchRecentLoginHistory = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    const logins = await fetchRecentLoginHistory({
      userId,
      limit: parseLimit(req.query?.limit),
    });

    return res.status(200).json({
      success: true,
      logins,
    });
  } catch (err) {
    console.error("Error in FetchRecentLoginHistory:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch login history.",
      code: "LOGIN_HISTORY_FETCH_FAILED",
    });
  }
};
