import { fetchOrganizationAdminMatrix } from "../../Services/orgAdmin.service.js";
import { rejectNonSuperAdmin } from "./shared.js";

export const FetchOrganizationAdmins = async (req, res) => {
  if (rejectNonSuperAdmin(req, res)) return;

  try {
    const data = await fetchOrganizationAdminMatrix();
    return res.status(200).json({
      success: true,
      ...data,
    });
  } catch (err) {
    console.error("Error in FetchOrganizationAdmins:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};
