const axios = require("axios");

module.exports = function (app) {

    async function createBratImage(text) {
        try {
            const apiUrl = `https://api.deline.web.id/maker/brat?text=${encodeURIComponent(text)}`;
            
            const response = await axios.get(apiUrl, {
                responseType: 'arraybuffer', // Penting untuk menerima blob
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 9; Redmi 7) AppleWebKit/537.36'
                },
                timeout: 15000
            });

            const base64Image = Buffer.from(response.data, 'binary').toString('base64');
            const dataUrl = `data:image/png;base64,${base64Image}`;

            return {
                status: true,
                text: text,
                image: dataUrl, 
            };

        } catch (error) {
            throw new Error(`Gagal membuat gambar BRAT: ${error.message}`);
        }
    }

    // 📌 ROUTE - Mengembalikan JSON dengan base64 image
    app.get("/maker/brat", async (req, res) => {
        try {
            const { text } = req.query;

            if (!text || text.trim() === '') {
                return res.status(400).json({
                    status: false,
                    error: "Parameter 'text' wajib diisi"
                });
            }

            const result = await createBratImage(text);
            res.json(result);

        } catch (error) {
            res.status(500).json({
                status: false,
                error: error.message
            });
        }
    });

    // 📌 ROUTE ALTERNATIF - Mengembalikan langsung gambar (blob)
    app.get("/maker/brat/image", async (req, res) => {
        try {
            const { text } = req.query;

            if (!text || text.trim() === '') {
                return res.status(400).send('Parameter "text" wajib diisi');
            }

            const apiUrl = `https://api.deline.web.id/maker/brat?text=${encodeURIComponent(text)}`;
            
            const response = await axios.get(apiUrl, {
                responseType: 'stream',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 9; Redmi 7) AppleWebKit/537.36'
                }
            });

            res.set('Content-Type', response.headers['content-type'] || 'image/png');
            response.data.pipe(res);

        } catch (error) {
            res.status(500).send(`Error: ${error.message}`);
        }
    });

};