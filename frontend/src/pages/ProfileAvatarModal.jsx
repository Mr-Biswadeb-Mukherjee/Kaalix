// ProfileAvatarModal.jsx
import { useEffect, useState } from "react";
import { Button, TextField } from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import LinkIcon from "@mui/icons-material/Link";
import Cropper from "react-easy-crop";
import { useToast } from "../Components/UI/Toast";
import API from "@amon/shared";
import { getBackendErrorMessage, parseApiResponse } from "../Utils/apiError";

const ProfileAvatarModal = ({
  isModalOpen,
  setIsModalOpen,
  token,
  setUserInfo,
  setAvatarPreview
}) => {
  const { addToast } = useToast();

  const [modalStep, setModalStep] = useState("choice");
  const [urlInput, setUrlInput] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);

  // cropper states
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  useEffect(() => {
    if (!isModalOpen) {
      setModalStep("choice");
      setUrlInput("");
      setSelectedImage(null);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
    }
  }, [isModalOpen]);

  // helper to crop
  const getCroppedImg = async (imageSrc, cropPixels) => {
    const image = new Image();
    image.src = imageSrc;
    await new Promise((resolve) => {
      image.onload = resolve;
    });

    const canvas = document.createElement("canvas");
    canvas.width = cropPixels.width;
    canvas.height = cropPixels.height;
    const ctx = canvas.getContext("2d");

    ctx.drawImage(
      image,
      cropPixels.x,
      cropPixels.y,
      cropPixels.width,
      cropPixels.height,
      0,
      0,
      cropPixels.width,
      cropPixels.height
    );

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        const fileUrl = URL.createObjectURL(blob);
        resolve({ blob, fileUrl });
      }, "image/jpeg");
    });
  };

  const handleChoiceKeyDown = (event, nextStep) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setModalStep(nextStep);
    }
  };

  if (!isModalOpen) return null;

  return (
    <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Update Profile Picture</h2>

        {modalStep === "choice" && (
          <div className="upload-choice-icons">
            {/* Upload from Device */}
            <div
              className="icon-option"
              role="button"
              tabIndex={0}
              onClick={() => setModalStep("device")}
              onKeyDown={(event) => handleChoiceKeyDown(event, "device")}
            >
              <CloudUploadIcon className="upload-icon upload-icon-device" />
              <p>Upload from Device</p>
            </div>

            {/* Upload from URL */}
            <div
              className="icon-option"
              role="button"
              tabIndex={0}
              onClick={() => setModalStep("url")}
              onKeyDown={(event) => handleChoiceKeyDown(event, "url")}
            >
              <LinkIcon className="upload-icon upload-icon-link" />
              <p>Upload from URL</p>
            </div>
          </div>
        )}

        {modalStep === "device" && (
          <div className="upload-device">
            <input
              type="file"
              accept="image/*"
              id="fileUpload"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  if (!file.type.startsWith("image/")) {
                    addToast("Only image files are allowed!", "error");
                    e.target.value = "";
                    return;
                  }

                  const fileUrl = URL.createObjectURL(file);
                  setSelectedImage(fileUrl);
                  setModalStep("preview");
                }
              }}
            />
            <label htmlFor="fileUpload">
              <Button variant="contained" component="span">
                Choose File
              </Button>
            </label>
            <Button variant="text" onClick={() => setModalStep("choice")}>
              Back
            </Button>
          </div>
        )}

        {modalStep === "url" && (
          <div className="upload-url">
            <TextField
              fullWidth
              label="Image URL"
              variant="outlined"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
            />
            <div className="upload-url-actions">
              <Button
                variant="contained"
                onClick={() => {
                  if (urlInput.trim()) {
                    const lowerUrl = urlInput.toLowerCase();
                    if (!lowerUrl.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
                      addToast("Please enter a valid image URL!", "error");
                      return;
                    }

                    setSelectedImage(urlInput);
                    setModalStep("preview");
                  }
                }}
              >
                Upload
              </Button>
              <Button variant="text" onClick={() => setModalStep("choice")}>
                Back
              </Button>
            </div>
          </div>
        )}

        {modalStep === "preview" && (
          <div className="preview-wrapper">
            <div className="zoom-badge">{zoom.toFixed(1)}x</div>

            <div className="preview-container">
              <Cropper
                image={selectedImage}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={(val) => setZoom(Number(val))}
                onCropComplete={(croppedArea, croppedAreaPixelsValue) => {
                  setCroppedAreaPixels(croppedAreaPixelsValue);
                }}
              />
            </div>

            <div className="preview-controls">
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
              />

              <div className="preview-buttons">
                <button
                  className="save-btn"
                  onClick={async () => {
                    if (!croppedAreaPixels) return;
                    const { blob, fileUrl } = await getCroppedImg(
                      selectedImage,
                      croppedAreaPixels
                    );

                    const formData = new FormData();
                    formData.append("avatar", blob, "avatar.jpg");

                    try {
                      const res = await fetch(API.system.protected.updateavatar.endpoint, {
                        method: "POST",
                        headers: { Authorization: `Bearer ${token}` },
                        body: formData
                      });

                      const data = await parseApiResponse(res);

                      addToast("Profile picture updated successfully!", "success");

                      setUserInfo((prev) => ({
                        ...prev,
                        avatarUrl: `${data.avatarUrl}?t=${Date.now()}`
                      }));
                      setAvatarPreview(`${data.avatarUrl}?t=${Date.now()}`);
                    } catch (err) {
                      addToast(getBackendErrorMessage(err), "error");
                    }

                    URL.revokeObjectURL(fileUrl);
                    setIsModalOpen(false);
                  }}
                >
                  Save
                </button>

                <button className="cancel-btn" onClick={() => setModalStep("choice")}>
                  Back
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="modal-actions">
          <Button onClick={() => setIsModalOpen(false)}>Close</Button>
        </div>
      </div>
    </div>
  );
};

export default ProfileAvatarModal;
