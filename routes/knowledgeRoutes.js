const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const multer = require('multer');
const { uploadKnowledgeFile, processKnowledgeFile, getKnowledgeFiles, deleteKnowledgeFile } = require('../controllers/knowledgeController');


const upload = multer({
  storage: multer.memoryStorage()
});


router.post('/business/:businessId/upload', auth, upload.single('file'), uploadKnowledgeFile);

router.post("/:knowledgeId/process", auth, processKnowledgeFile);

router.get('/business/:businessId/files', auth, getKnowledgeFiles);

router.delete('/:knowledgeId/delete', auth, deleteKnowledgeFile);

module.exports = router;
