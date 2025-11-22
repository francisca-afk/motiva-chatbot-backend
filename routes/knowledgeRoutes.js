const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const { uploadKnowledgeFile, processKnowledgeFile, getKnowledgeFiles, deleteKnowledgeFile } = require('../controllers/knowledgeController');


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); 
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });


router.post('/business/:businessId/upload', auth, upload.single('file'), uploadKnowledgeFile);

router.post("/:knowledgeId/process", auth, processKnowledgeFile);

router.get('/business/:businessId/files', auth, getKnowledgeFiles);

router.delete('/:knowledgeId/delete', auth, deleteKnowledgeFile);

module.exports = router;
