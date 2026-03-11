const axios = require("axios");
const cheerio = require("cheerio");

module.exports = function (app) {
    async function OtakuDesuHome() {
        try {
            const res = await axios.get(
                "https://otakudesu.blog/",
                {
                    headers: {
                        "User-Agent":
                            "Mozilla/5.0 (Linux; Android 9; Redmi 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.77 Mobile Safari/537.36"
                    }
                }
            );

            const $ = cheerio.load(res.data);
            const hasil = {
                ongoing: [],
                complete: []
            };

            // Scrape ONGOING anime
            $(".venz ul li").each((i, el) => {
                const $el = $(el);
                
                // Cek apakah ini bagian ongoing (ada tulisan On-going di parent)
                const isOngoing = $el.closest('.rseries').find('.rvad h1').text().includes('On-going');
                
                const anime = {
                    judul: $el.find(".jdlflm").text().trim(),
                    link: $el.find(".thumb a").attr("href") || null,
                    thumbnail: $el.find(".thumbz img").attr("src") || null,
                    episode: $el.find(".epz").text().replace("Episode", "").trim(),
                    hari: $el.find(".epztipe").text().trim(),
                    tanggal: $el.find(".newnime").text().trim()
                };

                // Hanya tambah jika judul tidak kosong
                if (anime.judul) {
                    if (isOngoing) {
                        hasil.ongoing.push(anime);
                    } else {
                        hasil.complete.push(anime);
                    }
                }
            });

            // Filter duplikat judul
            hasil.ongoing = hasil.ongoing.filter((v, i, a) => 
                a.findIndex(t => t.judul === v.judul) === i
            );
            hasil.complete = hasil.complete.filter((v, i, a) => 
                a.findIndex(t => t.judul === v.judul) === i
            );

            return hasil;
        } catch (error) {
            return {
                code: 503,
                status: false,
                error: error.message || error
            };
        }
    }

    // 📌 ROUTE EXPRESS
    app.get("/anime/otakudesuhome", async (req, res) => {
        try {
            const data = await OtakuDesuHome();
            
            // Jika error, kirim status 503
            if (data.code === 503) {
                return res.status(503).json(data);
            }
            
            res.json({
                status: true,
                ...data
            });
        } catch (err) {
            res.status(500).json({ 
                status: false,
                error: err.message 
            });
        }
    });
};