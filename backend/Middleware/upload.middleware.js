import multer from "multer";
import path from "path";
import fs from "fs";
import sharp from "sharp";
import { fileURLToPath } from "url";
import { fileTypeFromFile } from "file-type";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOAD_CONFIG = {
  dir: path.join(__dirname, "../public/uploads"),
  maxSize: 5 * 1024 * 1024, // 5MB
  allowedMimes: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/bmp",
    "image/tiff",
  ],
  avatarSize: { width: 400, height: 400 },
};

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_CONFIG.dir)) {
  fs.mkdirSync(UPLOAD_CONFIG.dir, { recursive: true });
}

// Multer storage (temporary files)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_CONFIG.dir),
  filename: (req, file, cb) =>
    cb(null, `temp-${Date.now()}${path.extname(file.originalname)}`),
});

// Multer file filter (basic MIME type check)
const fileFilter = (req, file, cb) => {
  if (UPLOAD_CONFIG.allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Only image files are allowed (jpg, png, webp, gif, bmp, tiff)."
      ),
      false
    );
  }
};

// Multer upload instance
export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: UPLOAD_CONFIG.maxSize },
});

// Validate file signature (magic number)
const validateFileSignature = async (filePath) => {
  const fileType = await fileTypeFromFile(filePath);
  return fileType && UPLOAD_CONFIG.allowedMimes.includes(fileType.mime);
};

export const processAvatar = async (req, res, next) => {
  try {
    if (!req.file) return next(); // No file uploaded, skip

    const tempFilePath = req.file.path;

    // ✅ Validate file signature (magic number)
    const fileType = await fileTypeFromFile(tempFilePath);
    if (!fileType || !UPLOAD_CONFIG.allowedMimes.includes(fileType.mime)) {
      await fs.promises.unlink(tempFilePath);
      return res.status(400).json({ message: "Invalid image file. Allowed: jpg, png, webp, gif, bmp, tiff." });
    }

    // Prepare final filename
    const finalFilename = `avatar_${req.user.user_id}.jpg`;
    const finalPath = path.join(UPLOAD_CONFIG.dir, finalFilename);

    // Resize & convert to JPEG
    await sharp(tempFilePath)
      .resize(UPLOAD_CONFIG.avatarSize.width, UPLOAD_CONFIG.avatarSize.height, { fit: "cover" })
      .toFormat("jpeg", { quality: 90 })
      .toFile(finalPath);

    // Cleanup temp file
    await fs.promises.unlink(tempFilePath);

    // Attach processed avatar path to request for controller
    req.processedAvatarPath = `/uploads/${finalFilename}`;
    next();
  } catch (err) {
    console.error("❌ Error processing avatar:", err.message);
    try { if (req.file?.path) await fs.promises.unlink(req.file.path); } catch {}
    return res.status(400).json({ message: "Failed to process avatar. Please upload a valid image." });
  }
};

// ✅ Graceful Multer error handling middleware
export const handleUploadErrors = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File too large. Max 5MB allowed.",
      });
    }
    return res.status(400).json({ success: false, message: err.message });
  } else if (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next();
};
