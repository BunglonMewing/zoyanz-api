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
            });

            const $ = cheerio.load(res.data);
            const hasil = [];

            // Selektor berdasarkan struktur halaman F-Droid
            $(".package-info").each((i, el) => {
                const name = $(el).find(".package-name").text().trim();
                const description = $(el).find(".package-summary").text().trim();
                const license = $(el).find(".package-license").text().trim();
                
                if (name) {
                    hasil.push({
                        name,
                        description,
                        license: license || "Unknown",
                    });
                }
            });

            // Jika selektor di atas tidak bekerja (fallback)
            if (hasil.length === 0) {
                $('a[href^="/packages/"]').each((i, el) => {
                    const parent = $(el).closest("div");
                    const name = $(el).text().trim();
                    const description = parent.find("p").first().text().trim();
                    const license = parent.find(".package-license, .license").text().trim();
                    
                    if (name && !hasil.some(item => item.name === name)) {
                        hasil.push({
                            name,
                            description,
                            license: license || "Unknown",
                        });
                    }
                });
            }

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

    // 📌 ROUTE untuk F-Droid Search
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
            
            // Jika ada error dari fungsi searchFdroid
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