import { deleteacc, findUserByEmail } from "./user.service.js";

/**
 * Express handler: Delete a user account.
 * Sets res.locals.deletedUserId for JWT revocation in server.js
 */
export const DeleteAccount = async (req, res) => {
  const { email, password } = req.body;

  // 🔎 Validate input
  if (!email || typeof email !== "string") {
    return res.status(400).json({ success: false, message: "Hmm… that doesn’t look like a valid email." });
  }
  if (!password || typeof password !== "string") {
    return res.status(400).json({ success: false, message: "Please enter your account password to confirm." });
  }

  try {
    // 1️⃣ Find user first
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "We couldn’t find an account with that email. Are you sure it’s yours?",
        tip: "Double-check the email you typed or try logging in to verify."
      });
    }

    // 2️⃣ Delete from DB (profiles + users)
    await deleteacc(email, password);

    // 3️⃣ Set deleted user ID for JWT revocation in server.js
    res.locals.deletedUserId = user.user_id;

    // 4️⃣ Success response with personal touch
    return res.status(200).json({
      success: true,
      message: `Hi ${user.first_name || 'there'}, your account has been permanently deleted. We’re sad to see you go! You’ll be redirected shortly.`
    });
  } catch (err) {
    console.error("Error deleting user account:", err);

    if (err.message.includes("Email does not match")) {
      return res.status(404).json({
        success: false,
        message: "Hmm… the email you entered doesn’t match our records. Did you mistype it?",
        tip: "Try checking for typos or use your registered email."
      });
    } else if (err.message.includes("Invalid password")) {
      return res.status(401).json({
        success: false,
        message: "Oops! That password doesn’t seem correct.",
        tip: "Make sure you enter the password associated with this email."
      });
    } else {
      return res.status(500).json({
        success: false,
        message: "Something went wrong while deleting your account. Please try again later."
      });
    }
  }
};
