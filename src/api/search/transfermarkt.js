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
                    const id = detailUrl?.match(/spieler\/(\d+)/)?.[1];
                    
                    if (name && id) {
                        results.push({
                            name,
                            position: $(el).find('td.zentriert').first().text().trim() || 'N/A',
                            age: $(el).find('td.zentriert').eq(1).text().trim() || 'N/A',
                            club: $(el).find('.tiny_wappen').first().attr('title') || 'N/A',
                            nationality: $(el).find('.flaggenrahmen').first().attr('title') || 'N/A',
                            marketValue: $(el).find('.rechts.hauptlink').first().text().trim() || 'N/A',
                            image: $(el).find('.bilderrahmen-fixed').attr('src') || null,
                            detailUrl: detailUrl?.startsWith('http') ? detailUrl : this.baseUrl + detailUrl,
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
                const detailUrl = `${this.baseUrl}/profil/spieler/${playerId}`;
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
                        info[info.label] = text;
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
                        if (competition && competition !== '' && !competition.includes('Total')) {
                            stats.push({ competition, apps, goals, assists });
                        }
                    }
                });

                // Ambil nilai pasar
                const marketValueText = $('.data-header__market-value-wrapper').first().text().trim().replace(/\s+/g, ' ');
                const marketValue = marketValueText.split('Update')[0].trim();

                // Ambil nama pemain
                const name = $('h1').first().text().trim().replace(/\s+/g, ' ').replace('#7', '').trim();
                
                // Ambil klub dan logo
                const club = $('.data-header__club a').first().text().trim() || 'N/A';
                let clubLogo = $('.data-header__box--big img').first().attr('src') || 
                              $('.data-header__box--big img').first().attr('data-src') || 
                              null;
                
                // Perbaiki URL logo jika relatif
                if (clubLogo && !clubLogo.startsWith('http')) {
                    clubLogo = this.baseUrl + clubLogo;
                }

                // Ambil foto pemain
                let image = $('.data-header__profile-image').attr('src') || null;
                if (image && !image.startsWith('http')) {
                    image = this.baseUrl + image;
                }

                return {
                    id: playerId,
                    name,
                    image,
                    club,
                    clubLogo,
                    fullName: info['Nama lengkap:'] || 'N/A',
                    age: info['Tanggal lahir / Umur:'] || 'N/A',
                    birthplace: info['Tempat kelahiran:']?.replace(/[^\w\s,]/g, '').trim() || 'N/A',
                    height: info['Tinggi:'] || 'N/A',
                    nationality: info['Kewarganegaraan:']?.replace(/\s+/g, ' ').trim() || 'N/A',
                    position: info['Posisi:'] || 'N/A',
                    foot: info['Kaki dominan:'] || 'N/A',
                    agent: info['Agen pemain:']?.replace(/\s+/g, ' ').trim() || 'N/A',
                    joined: info['Bergabung:'] || 'N/A',
                    contract: info['Kontrak berakhir:'] || 'N/A',
                    marketValue: marketValue || 'N/A',
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
            const detail = await this.getPlayerDetail(firstResult.id);

            return {
                search: searchResults.slice(0, 5), // Batasi 5 hasil pencarian
                detail: detail
            };
        }
    }

    // 📌 ROUTE - Pencarian pemain di Transfermarkt
    app.get("/search/transfermarkt", async (req, res) => {
        try {
            const { q, id } = req.query;

            if (!q && !id) {
                return res.status(400).json({
                    status: false,
                    error: "Parameter 'q' (nama pemain) atau 'id' (ID pemain) wajib diisi"
                });
            }

            const scraper = new Transfermarkt();
            let result;

            if (id) {
                // Jika ada ID, langsung ambil detail
                const detail = await scraper.getPlayerDetail(id);
                result = {
                    detail: detail
                };
            } else {
                // Jika ada query, cari pemain
                result = await scraper.getPlayer(q);
            }

            res.json({
                status: true,
                creator: "ZoYanz",
                query: q || null,
                playerId: id || null,
                result: result
            });

        } catch (error) {
            res.status(500).json({
                status: false,
                error: error.message
            });
        }
    });

    // 📌 ROUTE - Pencarian daftar pemain (tanpa detail)
    app.get("/search/transfermarkt/list", async (req, res) => {
        try {
            const { q, limit = 10 } = req.query;

            if (!q) {
                return res.status(400).json({
                    status: false,
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
                error: error.message
            });
        }
    });

    // 📌 ROUTE - Detail pemain berdasarkan ID
    app.get("/search/transfermarkt/detail", async (req, res) => {
        try {
            const { id } = req.query;

            if (!id) {
                return res.status(400).json({
                    status: false,
                    error: "Parameter 'id' (ID pemain) wajib diisi"
                });
            }

            const scraper = new Transfermarkt();
            const detail = await scraper.getPlayerDetail(id);

            res.json({
                status: true,
                creator: "ZoYanz",
                playerId: id,
                result: detail
            });

        } catch (error) {
            res.status(500).json({
                status: false,
                error: error.message
            });
        }
    });

};