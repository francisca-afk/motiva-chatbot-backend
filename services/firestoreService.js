const { initializeApp } = require("firebase/app");
const { getFirestore } = require("firebase/firestore");
const { getAuth } = require("firebase/auth");
const { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } = require("firebase/storage");
const { v4: uuidv4 } = require("uuid");

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

exports.uploadToFirebase = async (file, businessId) => {
  try {
    const fileName = `${uuidv4()}_${file.originalname}`;
    const fileRef = ref(storage, `knowledge/${businessId}/${fileName}`);
    
    await uploadBytes(fileRef, file.buffer, {
      contentType: file.mimetype,
    });
    
    const downloadURL = await getDownloadURL(fileRef);
    return { url: downloadURL, fileName };
  } catch (err) {
    console.error("Firebase upload error:", err);
    throw new Error("Failed to upload file");
  }
};

exports.deleteFromFirebase = async (downloadURL) => {
  try {
    const decodedUrl = decodeURIComponent(downloadURL.split("?")[0]);
    const pathStart = decodedUrl.indexOf("/o/") + 3;
    const filePath = decodedUrl.substring(pathStart);
    
    const fileRef = ref(storage, filePath);
    await deleteObject(fileRef);
    
    return { success: true };
  } catch (err) {
    console.error("Error deleting from Firebase:", err.message);
    throw new Error("Failed to delete file from Firebase Storage");
  }
};
