const axios = require("axios");

module.exports = function (app) {

    /**
     * VERSI 1: Pencarian sederhana dengan ringkasan
     */
    async function simpleWikiScrape(searchTerm) {
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
            'Accept': 'application/json'
        };

        try {
            // 1. Cari artikel
            const searchRes = await axios.get(
                'https://id.wikipedia.org/w/api.php',
                {
                    params: {
                        action: 'query',
                        list: 'search',
                        srsearch: searchTerm,
                        format: 'json',
                        srlimit: 5
                    },
                    headers,
                    timeout: 10000
                }
            );

            const results = searchRes.data.query.search;
            if (!results || results.length === 0) {
                return { error: 'Tidak ditemukan' };
            }

            const pageTitle = results[0].title;

            // 2. Ambil ringkasan
            const pageRes = await axios.get(
                'https://id.wikipedia.org/w/api.php',
                {
                    params: {
                        action: 'query',
                        titles: pageTitle,
                        prop: 'extracts|info|pageimages',
                        exintro: 1,
                        explaintext: 1,
                        inprop: 'url',
                        pithumbsize: 300,
                        format: 'json'
                    },
                    headers,
                    timeout: 10000
                }
            );

            const pages = pageRes.data.query.pages;
            const pageId = Object.keys(pages)[0];
            const page = pages[pageId];

            return {
                status: 'success',
                type: 'simple',
                title: page.title,
                url: page.fullurl,
                thumbnail: page.thumbnail?.source || null,
                summary: page.extract || "Tidak ada ringkasan",
                search_results: results.map(r => ({
                    title: r.title,
                    snippet: r.snippet.replace(/<\/?[^>]+(>|$)/g, "") // Bersihkan HTML
                }))
            };

        } catch (error) {
            throw new Error(`Gagal mengambil data Wikipedia: ${error.message}`);
        }
    }

    /**
     * VERSI 2: Pencarian detail dengan artikel lengkap
     */
    async function wikiDeepSearch(searchTerm) {
        try {
            const res = await axios.get('https://id.wikipedia.org/w/api.php', {
                params: {
                    action: 'parse',
                    format: 'json',
                    page: searchTerm,
                    prop: 'text|images|sections|displaytitle',
                    formatversion: 2,
                    redirects: true
                },
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36'
                },
                timeout: 15000
            });

            if (res.data.error) throw new Error("Artikel tidak ditemukan");

            let html = res.data.parse.text;

            // Bersihkan HTML
            html = html.replace(/<table[^>]*>[\s\S]*?<\/table>/g, '');
            html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/g, '');
            html = html.replace(/<div class="toc"[^>]*>[\s\S]*?<\/div>/g, '');
            html = html.replace(/<div class="hatnote"[^>]*>[\s\S]*?<\/div>/g, '');
            html = html.replace(/<div class="navbox"[^>]*>[\s\S]*?<\/div>/g, '');

            // Konversi ke teks
            let cleanText = html
                .replace(/<h([1-6])[^>]*>(.*?)<\/h\1>/g, '\n\n=== $2 ===\n')
                .replace(/<p[^>]*>/g, '\n')
                .replace(/<[^>]*>/g, '')
                .replace(/&[a-z0-9#]+;/gi, '')
                .replace(/\[\d+\]|\[[a-z]\]/g, '');

            // Rapikan
            const finalArticle = cleanText
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0)
                .join('\n\n');

            // Batasi panjang artikel (opsional, untuk menghindari response terlalu besar)
            const maxLength = 10000;
            const truncatedArticle = finalArticle.length > maxLength 
                ? finalArticle.substring(0, maxLength) + "...\n\n[Artikel dipotong, terlalu panjang]"
                : finalArticle;

            return {
                status: true,
                type: 'deep',
                title: res.data.parse.title,
                pageid: res.data.parse.pageid,
                total_sections: res.data.parse.sections?.length || 0,
                url: `https://id.wikipedia.org/wiki/${encodeURIComponent(res.data.parse.title)}`,
                article: truncatedArticle,
                images: res.data.parse.images?.slice(0, 10).map(img => 
                    `https://id.wikipedia.org/wiki/Istimewa:Cari_Media?search=${encodeURIComponent(img)}`
                ) || []
            };

        } catch (error) {
            throw new Error(`Gagal mengambil artikel detail: ${error.message}`);
        }
    }

    /**
     * VERSI MOBILE: Fallback sederhana
     */
    async function mobileFallback(searchTerm) {
        try {
            const mobileRes = await axios.get(
                `https://id.m.wikipedia.org/wiki/${encodeURIComponent(searchTerm)}`,
                {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Mobile Safari/537.36'
                    },
                    timeout: 8000
                }
            );

            // Ambil judul dari HTML (sederhana)
            const titleMatch = mobileRes.data.match(/<title>(.*?)<\/title>/);
            const title = titleMatch ? titleMatch[1].replace(' - Wikipedia bahasa Indonesia', '') : searchTerm;

            return {
                status: true,
                type: 'mobile_fallback',
                title: title,
                url: `https://id.m.wikipedia.org/wiki/${encodeURIComponent(searchTerm)}`,
                note: 'Diambil dari versi mobile Wikipedia'
            };

        } catch (error) {
            throw new Error(`Fallback mobile juga gagal: ${error.message}`);
        }
    }

    // 📌 ROUTE UTAMA - Pencarian Wikipedia
    app.get("/search/wikipedia", async (req, res) => {
        try {
            const { q, mode = 'simple' } = req.query;

            if (!q || q.trim() === '') {
                return res.status(400).json({
                    status: false,
                    error: "Parameter 'q' (query pencarian) wajib diisi"
                });
            }

            let result;

            try {
                if (mode === 'deep') {
                    // Mode detail lengkap
                    result = await wikiDeepSearch(q);
                } else {
                    // Mode simple (default)
                    result = await simpleWikiScrape(q);
                }
            } catch (primaryError) {
                // Jika gagal, coba fallback ke mobile
                try {
                    result = await mobileFallback(q);
                } catch (fallbackError) {
                    throw new Error(`Semua metode gagal: ${primaryError.message}`);
                }
            }

            res.json({
                status: true,
                creator: "ZoYanz",
                query: q,
                mode: mode,
                result: result
            });

        } catch (error) {
            res.status(500).json({
                status: false,
                error: error.message
            });
        }
    });

    // 📌 ROUTE untuk mencari daftar artikel (tanpa detail)
    app.get("/search/wikipedia/list", async (req, res) => {
        try {
            const { q, limit = 10 } = req.query;

            if (!q || q.trim() === '') {
                return res.status(400).json({
                    status: false,
                    error: "Parameter 'q' wajib diisi"
                });
            }

            const headers = {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36',
                'Accept': 'application/json'
            };

            const searchRes = await axios.get(
                'https://id.wikipedia.org/w/api.php',
                {
                    params: {
                        action: 'query',
                        list: 'search',
                        srsearch: q,
                        format: 'json',
                        srlimit: Math.min(parseInt(limit) || 10, 50)
                    },
                    headers,
                    timeout: 8000
                }
            );

            const results = searchRes.data.query.search.map(item => ({
                title: item.title,
                snippet: item.snippet.replace(/<\/?[^>]+(>|$)/g, ""),
                size: item.size,
                wordcount: item.wordcount,
                timestamp: item.timestamp
            }));

            res.json({
                status: true,
                creator: "Azor & Yanz",
                query: q,
                total: searchRes.data.query.searchinfo?.totalhits || results.length,
                results: results
            });

        } catch (error) {
            res.status(500).json({
                status: false,
                error: error.message
            });
        }
    });

};