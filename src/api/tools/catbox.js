const axios = require("axios");
const FormData = require("form-data");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

module.exports = function (app) {

    // Konfigurasi multer untuk upload file
    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            const uploadDir = path.join(__dirname, "../../../uploads");
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }
            cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
            const ext = path.extname(file.originalname);
            cb(null, "upload-" + uniqueSuffix + ext);
        }
    });

    const upload = multer({ 
        storage: storage,
        limits: {
            fileSize: 200 * 1024 * 1024 // 200MB
        }
    }).single("file");

    // Fungsi upload ke Catbox
    async function uploadToCatbox(filePath) {
        return new Promise((resolve, reject) => {
            const form = new FormData();
            form.append('fileToUpload', fs.createReadStream(filePath));
            form.append('reqtype', 'fileupload');

            axios.post('https://catbox.moe/user/api.php', form, {
                headers: {
                    ...form.getHeaders(),
                    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36'
                },
                timeout: 60000
            })
            .then(response => resolve(response.data))
            .catch(err => reject(err));
        });
    }

    // 📌 ROUTE UPLOAD KE CATBOX
    app.post("/tools/catbox", (req, res) => {
        upload(req, res, async (err) => {
            let uploadedFile = null;
            
            try {
                if (err) {
                    return res.status(400).json({
                        status: false,
                        creator: "Azor & Yanz",
                        error: err.message
                    });
                }

                if (!req.file) {
                    return res.status(400).json({
                        status: false,
                        creator: "Azor & Yanz",
                        error: "Tidak ada file yang diupload. Pastikan field name 'file'"
                    });
                }

                uploadedFile = req.file;
                const filePath = uploadedFile.path;

                // Upload ke Catbox
                const result = await uploadToCatbox(filePath);

                // Hapus file setelah upload
                try {
                    fs.unlinkSync(filePath);
                } catch (unlinkErr) {
                    console.error("Gagal menghapus file:", unlinkErr.message);
                }

                // Cek hasil upload
                if (result && (result.startsWith('http://') || result.startsWith('https://'))) {
                    res.json({
                        status: true,
                        creator: "Azor & Yanz",
                        result: {
                            url: result,
                            filename: uploadedFile.originalname,
                            size: uploadedFile.size,
                            mimetype: uploadedFile.mimetype
                        }
                    });
                } else {
                    res.status(500).json({
                        status: false,
                        creator: "Azor & Yanz",
                        error: result || "Gagal upload ke Catbox"
                    });
                }

            } catch (error) {
                if (uploadedFile && fs.existsSync(uploadedFile.path)) {
                    try {
                        fs.unlinkSync(uploadedFile.path);
                    } catch (unlinkErr) {
                        console.error("Gagal menghapus file:", unlinkErr.message);
                    }
                }

                res.status(500).json({
                    status: false,
                    creator: "Azor & Yanz",
                    error: error.message || "Gagal mengupload file"
                });
            }
        });
    });

};