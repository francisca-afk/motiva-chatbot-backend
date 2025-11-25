const ALLOWED_MIME_TYPES = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
  //  "text/markdown",
  ];
  const ALLOWED_IMAGE_MIME_TYPES = [
    "image/jpeg",
    "image/png"
  ];
  
  const MAX_FILE_SIZE_MB = 10;
  const MAX_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024;
  const MAX_IMAGE_SIZE_MB = 10;
  const MAX_IMAGE_SIZE = MAX_IMAGE_SIZE_MB * 1024 * 1024;
  exports.validateFile = (file) => {
    if (!file) {
      throw new Error("No file provided");
    }
  
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new Error("Unsupported file type");
    }
  
    if (file.size > MAX_SIZE) {
      throw new Error(`File must be smaller than ${MAX_FILE_SIZE_MB}MB`);
    }
  
    return true;
  };

  exports.validateImage = (file) => {
    if (!file) {
        throw new Error("No file provided");
    }

    if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype)) {
      throw new Error("Unsupported image type");
    }
  
    if (file.size > MAX_IMAGE_SIZE) {
      throw new Error(`Image must be smaller than ${MAX_IMAGE_SIZE}MB`);
    }
  
    return true;
  };