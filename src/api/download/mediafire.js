const axios = require("axios");
const cheerio = require("cheerio");

module.exports = function (app) {

    function getMimeTypeFromUrl(url) {
        if (!url) return 'unknown';

        const fileName = url.split('/').pop().split('?')[0];
        const extension = fileName.split('.').pop().toLowerCase();

        const mimeTypes = {
            '7z': 'application/x-7z-compressed',
            'zip': 'application/zip',
            'rar': 'application/x-rar-compressed',
            'apk': 'application/vnd.android.package-archive',
            'exe': 'application/x-msdownload',
            'pdf': 'application/pdf',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xls': 'application/vnd.ms-excel',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'ppt': 'application/vnd.ms-powerpoint',
            'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'mp3': 'audio/mpeg',
            'mp4': 'video/mp4',
            'txt': 'text/plain',
            'json': 'application/json',
            'js': 'application/javascript',
            'html': 'text/html',
            'css': 'text/css'
        };

        return mimeTypes[extension] || 'application/octet-stream';
    }

    async function mediafire(url) {
        try {
            const { data: html } = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
                },
                timeout: 15000
            });

            const $ = cheerio.load(html);

            const title = $('meta[property="og:title"]').attr('content');
            const images = $('meta[property="og:image"]').attr('content');
            const link_download = $('#downloadButton').attr('href');
            const sizes = $('#downloadButton').text().trim();
            const description = $('meta[property="og:description"]').attr('content') || 'No description available.';
            
            // Extract file size
            const size = sizes.replace('Download (', '').replace(')', '');
            
            // Get file info from page
            const fileInfo = $('.dl-info').text() || '';
            const uploadDate = $('.upload-date').text() || $('.dl-info .date').text() || '';
            
            const mimetype = getMimeTypeFromUrl(link_download);
            
            // Extract filename from title or URL
            const filename = title || link_download?.split('/').pop()?.split('?')[0] || 'unknown';

            return { 
                status: true,
                creator: "Azor & Yanz",
                result: {
                    meta: {
                        title: title || 'Unknown Title',
                        filename: filename,
                        thumbnail: images || null,
                        description: description,
                        file_size: size || 'Unknown',
                        upload_date: uploadDate || 'Unknown',
                        file_type: mimetype.split('/')[1]?.toUpperCase() || 'Unknown'
                    },
                    download: {
                        url: link_download,
                        size: size,
                        mimetype: mimetype,
                        direct_link: link_download
                    }
                }
            };

        } catch (error) {
            throw new Error(`Gagal mengambil data dari MediaFire: ${error.message}`);
        }
    }

    // 📌 ROUTE UTAMA - MediaFire Downloader
    app.get("/download/mediafire", async (req, res) => {
        try {
            const { url } = req.query;

            if (!url) {
                return res.status(400).json({
                    status: false,
                    creator: "Azor & Yanz",
                    error: "Parameter 'url' wajib diisi"
                });
            }

            // Validasi URL MediaFire
            if (!url.includes('mediafire.com')) {
                return res.status(400).json({
                    status: false,
                    creator: "Azor & Yanz",
                    error: "URL harus dari MediaFire (mediafire.com)"
                });
            }

            const result = await mediafire(url);

            res.json(result);

        } catch (error) {
            res.status(500).json({
                status: false,
                creator: "Azor & Yanz",
                error: error.message
            });
        }
    });

    // 📌 ROUTE INFORMASI - Untuk cek status
    app.get("/download/mediafire/info", async (req, res) => {
        res.json({
            status: true,
            creator: "Azor & Yanz",
            message: "MediaFire Downloader API siap digunakan",
            usage: {
                endpoint: "/download/mediafire",
                parameter: "?url=[mediafire_url]",
                example: "/download/mediafire?url=https://www.mediafire.com/file/b89hlvgqub8uwhn/example.zip/file"
            }
        });
    });

};