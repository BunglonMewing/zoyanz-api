const axios = require("axios");
const cheerio = require("cheerio");

module.exports = function (app) {

    class Transfermarkt {
        constructor() {
            this.baseUrl = 'https://www.transfermarkt.co.id';
            this.headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
            };
        }

        async searchPlayer(query) {
            try {
                const searchUrl = `${this.baseUrl}/schnellsuche/ergebnis/schnellsuche?query=${encodeURIComponent(query)}`;
                const { data } = await axios.get(searchUrl, { 
                    headers: this.headers,
                    timeout: 15000 
                });
                
                const $ = cheerio.load(data);
                const results = [];

                // Ambil semua hasil pencarian dari tabel
                $('#player-grid tbody tr').each((i, el) => {
                    const name = $(el).find('.hauptlink a').first().text().trim();
                    const detailUrl = $(el).find('.hauptlink a').first().attr('href');
                    
                    // Ekstrak ID dari URL
                    let id = null;
                    if (detailUrl) {
                        const idMatch = detailUrl.match(/spieler\/(\d+)/);
                        if (idMatch) id = idMatch[1];
                    }
                    
                    // Perbaiki URL detail jika perlu
                    let fullDetailUrl = detailUrl;
                    if (detailUrl && !detailUrl.startsWith('http')) {
                        fullDetailUrl = this.baseUrl + detailUrl;
                    }
                    
                    if (name && id) {
                        results.push({
                            name,
                            position: $(el).find('td.zentriert').first().text().trim() || 'N/A',
                            age: $(el).find('td.zentriert').eq(1).text().trim() || 'N/A',
                            club: $(el).find('.tiny_wappen').first().attr('title') || 'N/A',
                            nationality: $(el).find('.flaggenrahmen').first().attr('title') || 'N/A',
                            marketValue: $(el).find('.rechts.hauptlink').first().text().trim() || 'N/A',
                            image: $(el).find('.bilderrahmen-fixed').attr('src') || null,
                            detailUrl: fullDetailUrl,
                            id
                        });
                    }
                });

                return results;
            } catch (error) {
                throw new Error(`Gagal mencari pemain: ${error.message}`);
            }
        }

        async getPlayerDetail(playerId) {
            try {
                // Perbaiki URL detail - gunakan format yang benar
                const detailUrl = `https://www.transfermarkt.co.id/profil/spieler/${playerId}`;
                
                const { data } = await axios.get(detailUrl, { 
                    headers: this.headers,
                    timeout: 15000 
                });
                
                const $ = cheerio.load(data);
                
                // Ambil informasi dari tabel detail
                const info = {};
                $('.info-table .info-table__content').each((i, el) => {
                    const text = $(el).text().trim().replace(/\s+/g, ' ');
                    if (i % 2 === 0) {
                        info.label = text;
                    } else if (info.label) {
                        // Bersihkan label dan simpan
                        const cleanLabel = info.label.replace(/[:\s]/g, '').trim();
                        info[cleanLabel] = text;
                    }
                });

                // Ambil statistik pemain
                const stats = [];
                $('.responsive-table table tbody tr').each((i, el) => {
                    const cols = $(el).find('td');
                    if (cols.length >= 4) {
                        const competition = $(cols[0]).text().trim().replace(/\s+/g, ' ');
                        const apps = $(cols[1]).text().trim();
                        const goals = $(cols[2]).text().trim();
                        const assists = $(cols[3]).text().trim();
                        if (competition && competition !== '' && !competition.includes('Total') && !competition.includes('Total')) {
                            stats.push({ competition, apps, goals, assists });
                        }
                    }
                });

                // Ambil nilai pasar
                let marketValue = 'N/A';
                const marketValueElement = $('.data-header__market-value-wrapper').first();
                if (marketValueElement.length) {
                    const marketValueText = marketValueElement.text().trim().replace(/\s+/g, ' ');
                    marketValue = marketValueText.split('Update')[0].trim();
                }

                // Ambil nama pemain - coba beberapa selector
                let name = 'N/A';
                const nameSelectors = ['h1', '.data-header__headline-wrapper', '.spielername-profil'];
                for (const selector of nameSelectors) {
                    const el = $(selector).first();
                    if (el.length) {
                        name = el.text().trim().replace(/\s+/g, ' ').replace(/#\d+/g, '').trim();
                        if (name && name !== 'N/A') break;
                    }
                }
                
                // Ambil klub dan logo
                let club = 'N/A';
                let clubLogo = null;
                
                const clubElement = $('.data-header__club a').first();
                if (clubElement.length) {
                    club = clubElement.text().trim() || 'N/A';
                }
                
                const logoElement = $('.data-header__box--big img').first();
                if (logoElement.length) {
                    clubLogo = logoElement.attr('src') || logoElement.attr('data-src') || null;
                    if (clubLogo && !clubLogo.startsWith('http')) {
                        clubLogo = 'https:' + clubLogo;
                    }
                }

                // Ambil foto pemain
                let image = null;
                const imageElement = $('.data-header__profile-image').first();
                if (imageElement.length) {
                    image = imageElement.attr('src') || null;
                    if (image && !image.startsWith('http')) {
                        image = 'https:' + image;
                    }
                }

                // Fungsi helper untuk mengambil info dengan aman
                const getInfo = (key) => {
                    const value = info[key] || 'N/A';
                    return value.replace(/\s+/g, ' ').trim();
                };

                return {
                    id: playerId,
                    name,
                    image,
                    club,
                    clubLogo,
                    fullName: getInfo('Namalengkap'),
                    age: getInfo('TanggallahirUmur'),
                    birthplace: getInfo('Tempatkelahiran')?.replace(/[^\w\s,]/g, '').trim() || 'N/A',
                    height: getInfo('Tinggi'),
                    nationality: getInfo('Kewarganegaraan'),
                    position: getInfo('Posisi'),
                    foot: getInfo('Kakidominan'),
                    agent: getInfo('Agenpemain'),
                    joined: getInfo('Bergabung'),
                    contract: getInfo('Kontrakberakhir'),
                    marketValue: marketValue,
                    stats: stats.slice(0, 10) // Batasi 10 statistik teratas
                };
            } catch (error) {
                throw new Error(`Gagal mengambil detail pemain: ${error.message}`);
            }
        }

        async getPlayer(query) {
            // Cari pemain berdasarkan query
            const searchResults = await this.searchPlayer(query);
            
            if (searchResults.length === 0) {
                throw new Error(`Pemain dengan nama "${query}" tidak ditemukan`);
            }

            // Ambil detail pemain pertama
            const firstResult = searchResults[0];
            
            try {
                const detail = await this.getPlayerDetail(firstResult.id);
                return {
                    search: searchResults.slice(0, 5), // Batasi 5 hasil pencarian
                    detail: detail
                };
            } catch (detailError) {
                // Jika gagal mengambil detail, tetap kembalikan hasil pencarian
                return {
                    search: searchResults.slice(0, 5),
                    detail: null,
                    note: "Detail pemain tidak dapat diambil, namun hasil pencarian tersedia"
                };
            }
        }
    }

    // 📌 ROUTE - Pencarian pemain di Transfermarkt
    app.get("/search/transfermarkt", async (req, res) => {
        try {
            const { q } = req.query;

            if (!q || q.trim() === '') {
                return res.status(400).json({
                    status: false,
                    creator: "Azor & Yanz",
                    error: "Parameter 'q' (nama pemain) wajib diisi"
                });
            }

            const scraper = new Transfermarkt();
            const result = await scraper.getPlayer(q);

            res.json({
                status: true,
                creator: "Azor & Yanz",
                query: q,
                result: result
            });

        } catch (error) {
            res.status(500).json({
                status: false,
                creator: "Azor & Yanz",
                error: error.message
            });
        }
    });

    // 📌 ROUTE - Pencarian daftar pemain (tanpa detail)
    app.get("/search/transfermarkt/list", async (req, res) => {
        try {
            const { q, limit = 10 } = req.query;

            if (!q || q.trim() === '') {
                return res.status(400).json({
                    status: false,
                    creator: "Azor & Yanz",
                    error: "Parameter 'q' (nama pemain) wajib diisi"
                });
            }

            const scraper = new Transfermarkt();
            const results = await scraper.searchPlayer(q);
            
            // Batasi jumlah hasil
            const limitedResults = results.slice(0, Math.min(parseInt(limit) || 10, 30));

            res.json({
                status: true,
                creator: "Azor & Yanz",
                query: q,
                total: results.length,
                results: limitedResults
            });

        } catch (error) {
            res.status(500).json({
                status: false,
                creator: "Azor & Yanz",
                error: error.message
            });
        }
    });

};