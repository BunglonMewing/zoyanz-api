const axios = require("axios");

module.exports = function (app) {

    // 📌 ROUTE - Langsung mengembalikan gambar (blob)
    app.get("/maker/brat", async (req, res) => {
        try {
            const { text } = req.query;

            if (!text || text.trim() === '') {
                return res.status(400).send('Parameter "text" wajib diisi');
            }

            const apiUrl = `https://api.deline.web.id/maker/brat?text=${encodeURIComponent(text)}`;
            
            const response = await axios.get(apiUrl, {
                responseType: 'stream',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 9; Redmi 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.77 Mobile Safari/537.36',
                },
                timeout: 15000
            });

            res.set('Content-Type', response.headers['content-type'] || 'image/png');
            
            // Pipe gambar langsung ke response
            response.data.pipe(res);

        } catch (error) {
            res.status(500).send(`Error: ${error.message}`);
        }
    });

};