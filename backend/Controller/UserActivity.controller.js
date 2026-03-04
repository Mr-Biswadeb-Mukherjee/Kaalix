import { fetchRecentUserActivity } from "../Services/userActivity.service.js";

const parseLimit = (rawLimit) => {
  const parsed = Number.parseInt(rawLimit, 10);
  if (!Number.isFinite(parsed)) return 20;
  if (parsed < 1) return 1;
  if (parsed > 50) return 50;
  return parsed;
};

export const FetchRecentUserActivity = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    const activities = await fetchRecentUserActivity({
      userId,
      limit: parseLimit(req.query?.limit),
    });

    return res.status(200).json({
      success: true,
      activities,
    });
  } catch (err) {
    console.error("Error in FetchRecentUserActivity:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch user activity logs.",
      code: "USER_ACTIVITY_FETCH_FAILED",
    });
  }
};
