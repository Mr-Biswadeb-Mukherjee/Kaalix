import multer from "multer";
import path from "path";
import fs from "fs";
import sharp from "sharp";
import { fileURLToPath } from "url";
import { fileTypeFromBuffer } from "file-type";

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
  maxDimensions: { width: 5000, height: 5000 }, // prevent huge images
};

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_CONFIG.dir)) {
  fs.mkdirSync(UPLOAD_CONFIG.dir, { recursive: true });
}

// Multer memory storage
const storage = multer.memoryStorage();

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

// Process avatar safely
export const processAvatar = async (req, res, next) => {
  try {
    if (!req.file) return next(); // no file uploaded

    const buffer = req.file.buffer;

    // Validate file signature (magic number)
    const fileType = await fileTypeFromBuffer(buffer);
    if (!fileType || !UPLOAD_CONFIG.allowedMimes.includes(fileType.mime)) {
      return res.status(400).json({ message: "Invalid image file." });
    }

    // Validate dimensions
    const metadata = await sharp(buffer).metadata();
    if (
      metadata.width > UPLOAD_CONFIG.maxDimensions.width ||
      metadata.height > UPLOAD_CONFIG.maxDimensions.height
    ) {
      return res.status(400).json({ message: "Image dimensions too large." });
    }

    // Prepare final filename
    const finalFilename = `avatar_${req.user.user_id}.jpg`;
    const finalPath = path.join(UPLOAD_CONFIG.dir, finalFilename);

    // Resize & convert to JPEG
    await sharp(buffer)
      .resize(UPLOAD_CONFIG.avatarSize.width, UPLOAD_CONFIG.avatarSize.height, { fit: "cover" })
      .jpeg({ quality: 90 })
      .toFile(finalPath);

    // Attach processed avatar path to request
    req.processedAvatarPath = `/uploads/${finalFilename}`;
    next();
  } catch (err) {
    console.error("❌ Error processing avatar:", err.message);
    return res.status(400).json({ message: "Failed to process avatar. Please upload a valid image." });
  }
};

// Graceful Multer error handling middleware
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
