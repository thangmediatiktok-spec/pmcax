const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const AdmZip = require('adm-zip');
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const mongoose = require('mongoose');

const tempDir = path.join(__dirname, '../../public/uploads/temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

const upload = multer({ dest: tempDir });

router.get('/', isAuthenticated, isAdmin, (req, res) => {
    res.render('backup/index', {
        title: 'Sao lưu & Phục hồi',
        activeMenu: 'backup'
    });
});

router.get('/export', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const backupData = {};
        const models = mongoose.modelNames();
        
        for (const modelName of models) {
            const Model = mongoose.model(modelName);
            backupData[modelName] = await Model.find({});
        }

        const zip = new AdmZip();
        
        zip.addFile('database.json', Buffer.from(JSON.stringify(backupData)));
        
        const uploadsDir = path.join(__dirname, '../../public/uploads');
        if (fs.existsSync(uploadsDir)) {
            if (fs.existsSync(path.join(uploadsDir, 'avatars'))) {
                zip.addLocalFolder(path.join(uploadsDir, 'avatars'), 'uploads/avatars');
            }
            if (fs.existsSync(path.join(uploadsDir, 'documents'))) {
                zip.addLocalFolder(path.join(uploadsDir, 'documents'), 'uploads/documents');
            }
        }
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `PMCAX_Backup_${timestamp}.zip`;
        
        res.set('Content-Type', 'application/zip');
        res.set('Content-Disposition', `attachment; filename=${fileName}`);
        res.send(zip.toBuffer());

    } catch (err) {
        console.error(err);
        req.flash('error', 'Lỗi khi tạo sao lưu: ' + err.message);
        res.redirect('/backup');
    }
});

router.post('/import', isAuthenticated, isAdmin, upload.single('backupFile'), async (req, res) => {
    try {
        if (!req.file) {
            req.flash('error', 'Vui lòng chọn file backup (.zip)');
            return res.redirect('/backup');
        }

        const zip = new AdmZip(req.file.path);
        const zipEntries = zip.getEntries();
        
        const dbEntry = zipEntries.find(entry => entry.entryName === 'database.json');
        if (!dbEntry) {
            fs.unlinkSync(req.file.path);
            req.flash('error', 'File không hợp lệ (không tìm thấy database.json)');
            return res.redirect('/backup');
        }

        const dbData = JSON.parse(zip.readAsText(dbEntry));

        const models = mongoose.modelNames();
        for (const modelName of models) {
            if (dbData[modelName]) {
                const Model = mongoose.model(modelName);
                await Model.deleteMany({});
                if (dbData[modelName].length > 0) {
                    await Model.insertMany(dbData[modelName]);
                }
            }
        }

        const publicDir = path.join(__dirname, '../../public');
        zipEntries.forEach(entry => {
            if (entry.entryName.startsWith('uploads/')) {
                if (!entry.isDirectory) {
                    const targetPath = path.join(publicDir, path.dirname(entry.entryName));
                    if (!fs.existsSync(targetPath)) {
                        fs.mkdirSync(targetPath, { recursive: true });
                    }
                    fs.writeFileSync(path.join(publicDir, entry.entryName), entry.getData());
                }
            }
        });

        fs.unlinkSync(req.file.path);
        
        req.session.destroy();
        res.redirect('/login?restored=true');

    } catch (err) {
        console.error(err);
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        req.flash('error', 'Lỗi phục hồi dữ liệu: ' + err.message);
        res.redirect('/backup');
    }
});

module.exports = router;
