const axios = require("axios");
const cheerio = require("cheerio");

module.exports = function (app) {

    async function searchFdroid(query = 'termux', language = 'id') {
        try {
            const url = `https://search.f-droid.org/?q=${encodeURIComponent(query)}&lang=${language}`;
            const res = await axios.get(url, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Linux; Android 9; Redmi 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.77 Mobile Safari/537.36",
                },
                timeout: 10000
            });

            const $ = cheerio.load(res.data);
            const hasil = [];

            // Setiap aplikasi berada dalam elemen <a class="package-header">
            $('a.package-header').each((i, el) => {
                // Nama aplikasi
                const name = $(el).find('h4.package-name').text().trim();
                if (!name) return; // lewati jika tidak ada nama

                // Deskripsi
                const description = $(el).find('span.package-summary').text().trim();

                // Lisensi
                const license = $(el).find('span.package-license').text().trim() || "Unknown";

                // Link detail aplikasi
                let link = $(el).attr('href');
                // Pastikan link absolut
                if (link && !link.startsWith('http')) {
                    link = `https://f-droid.org${link}`;
                }

                // Icon aplikasi
                let icon = $(el).find('img.package-icon').attr('src');
                if (icon && !icon.startsWith('http')) {
                    // Jika icon relatif (misal /static/...), ubah ke absolut
                    icon = `https://f-droid.org${icon}`;
                }

                hasil.push({
                    name,
                    description,
                    license,
                    link,
                    icon: icon || null
                });
            });

            return {
                status: true,
                query,
                language,
                total: hasil.length,
                results: hasil
            };

        } catch (error) {
            return {
                code: 503,
                status: false,
                error: error.message || error,
            };
        }
    }

    // 📌 ROUTE
    app.get("/search/fdroid", async (req, res) => {
        try {
            const { q, lang = 'id' } = req.query;
            
            if (!q || q.trim() === '') {
                return res.status(400).json({
                    status: false,
                    error: "Parameter 'q' (query pencarian) wajib diisi"
                });
            }

            const data = await searchFdroid(q, lang);
            
            // Jika terjadi error (misal timeout atau website down)
            if (data.code === 503) {
                return res.status(503).json(data);
            }
            
            res.json(data);
            
        } catch (e) {
            res.status(500).json({
                status: false,
                error: e.message,
            });
        }
    });

};