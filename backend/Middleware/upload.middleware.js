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

// ✅ Self-contained avatar processing middleware
export const processAvatar = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No file uploaded." });
  }

  const userId = req.user.user_id;
  const finalFilename = `avatar_${userId}.jpg`;
  const finalPath = path.join(UPLOAD_CONFIG.dir, finalFilename);

  try {
    // Check real file signature
    const isValid = await validateFileSignature(req.file.path);
    if (!isValid) {
      await fs.promises.unlink(req.file.path); // cleanup temp file
      return res.status(400).json({
        success: false,
        message: "Invalid image file. Please upload a valid picture.",
      });
    }

    // Resize & convert to JPEG
    await sharp(req.file.path)
      .resize(UPLOAD_CONFIG.avatarSize.width, UPLOAD_CONFIG.avatarSize.height, { fit: "cover" })
      .toFormat("jpeg", { quality: 90 })
      .toFile(finalPath);

    await fs.promises.unlink(req.file.path); // remove temp file

    return res.json({
      success: true,
      avatarUrl: `/uploads/${finalFilename}?t=${Date.now()}`,
    });
  } catch (err) {
    console.error("❌ Error processing avatar:", err.message);
    try { await fs.promises.unlink(req.file.path); } catch {}
    return res.status(400).json({
      success: false,
      message: "Failed to process avatar. Please upload a valid picture.",
    });
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
