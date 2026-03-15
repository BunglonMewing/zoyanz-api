const axios = require("axios");

module.exports = function (app) {

    class YTDL {
        constructor() {
            this.baseUrl = 'https://ytdownloader.io';
            this.nonce = 'cf1ae5b0cc';
            this.headers = {
                'Accept': '*/*',
                'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
                'Content-Type': 'application/json',
                'Origin': this.baseUrl,
                'Referer': this.baseUrl + '/',
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
                'x-visolix-nonce': this.nonce
            };
            this.validFormats = {
                audio: ['MP3', 'M4A', 'WEBM', 'AAC', 'FLAC', 'OPUS', 'OGG', 'WAV'],
                video: ['MP4 (360p)', 'MP4 (480p)', 'MP4 (720p)', 'MP4 (1080p)', 'MP4 (1440p)', 'WEBM (4K)']
            };
            this.formatMap = {
                'MP3': 'mp3',
                'M4A': 'm4a',
                'WEBM': 'webm_audio',
                'AAC': 'aac',
                'FLAC': 'flac',
                'OPUS': 'opus',
                'OGG': 'ogg',
                'WAV': 'wav',
                'MP4 (360p)': '360',
                'MP4 (480p)': '480',
                'MP4 (720p)': '720',
                'MP4 (1080p)': '1080',
                'MP4 (1440p)': '1440',
                'WEBM (4K)': '2160'
            };
        }

        validateFormat(format) {
            const allFormats = [...this.validFormats.audio, ...this.validFormats.video];
            if (!allFormats.includes(format)) {
                throw new Error(`Format "${format}" tidak valid. Gunakan format: ${allFormats.join(', ')}`);
            }
        }

        async getVideoInfo(url, format) {
            const payload = {
                url: url,
                format: this.formatMap[format],
                captcha_response: null
            };
            
            const response = await axios.post(
                `${this.baseUrl}/wp-json/visolix/api/download`,
                payload,
                { headers: this.headers, timeout: 15000 }
            );
            
            const html = response.data.data;
            const videoId = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([^&?]+)/)?.[1];
            const downloadId = html.match(/download-btn-([a-zA-Z0-9]+)/)?.[1];
            const thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
            
            if (!downloadId) throw new Error("Gagal mendapatkan download ID");
            
            return { videoId, downloadId, thumbnail };
        }

        async getProgress(downloadId) {
            const payload = { id: downloadId };
            const response = await axios.post(
                `${this.baseUrl}/wp-json/visolix/api/progress`,
                payload,
                { headers: this.headers, timeout: 10000 }
            );
            return response.data;
        }

        async getSecureUrl(downloadUrl, downloadId) {
            const payload = {
                url: downloadUrl,
                host: 'youtube',
                video_id: downloadId
            };
            const response = await axios.post(
                `${this.baseUrl}/wp-json/visolix/api/youtube-secure-url`,
                payload,
                { headers: this.headers, timeout: 10000 }
            );
            return response.data.secure_url;
        }

        async downloadVideo(url, format) {
            this.validateFormat(format);
            
            // Step 1: Get video info
            const info = await this.getVideoInfo(url, format);
            
            // Step 2: Check progress
            let progress = await this.getProgress(info.downloadId);
            let attempts = 0;
            const maxAttempts = 30; // Maksimal 30 kali percobaan (60 detik)
            
            while (progress.progress < 1000 && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 2000));
                progress = await this.getProgress(info.downloadId);
                attempts++;
            }
            
            if (progress.progress < 1000) {
                throw new Error("Timeout menunggu proses download");
            }
            
            // Step 3: Get secure URL
            const secureUrl = await this.getSecureUrl(progress.download_url, info.downloadId);
            
            return {
                videoId: info.videoId,
                title: progress.title || "Unknown Title",
                thumbnail: info.thumbnail,
                format: format,
                fileSize: progress.filesize || null,
                downloadUrl: progress.download_url,
                secureUrl: secureUrl
            };
        }
    }

    // 📌 ROUTE YTDL
    app.get("/download/ytdl", async (req, res) => {
        try {
            const { url, format = 'MP4 (720p)' } = req.query;

            if (!url) {
                return res.status(400).json({
                    status: false,
                    error: "Parameter 'url' wajib diisi"
                });
            }

            // Validasi URL YouTube
            const youtubeRegex = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([^&?]+)/;
            if (!youtubeRegex.test(url)) {
                return res.status(400).json({
                    status: false,
                    error: "URL YouTube tidak valid"
                });
            }

            const scraper = new YTDL();
            const result = await scraper.downloadVideo(url, format);

            res.json({
                status: true,
                creator: "ZoYanz",
                result: result
            });

        } catch (error) {
            res.status(500).json({
                status: false,
                error: error.message
            });
        }
    });

    // 📌 ROUTE untuk melihat format yang tersedia
    app.get("/download/ytdl/formats", async (req, res) => {
        try {
            const scraper = new YTDL();
            res.json({
                status: true,
                creator: "ZoYanz",
                formats: scraper.validFormats
            });
        } catch (error) {
            res.status(500).json({
                status: false,
                error: error.message
            });
        }
    });

};