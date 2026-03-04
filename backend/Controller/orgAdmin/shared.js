export const isSuperAdmin = (req) => req.user?.role === "sa";

export const rejectNonSuperAdmin = (req, res) => {
  if (isSuperAdmin(req)) return false;
  res.status(403).json({
    success: false,
    message: "Forbidden. Super admin access required.",
  });
  return true;
};
