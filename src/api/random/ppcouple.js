const axios = require("axios");

module.exports = function (app) {

    // 📌 ROUTE - Mendapatkan pasangan foto profil (cowo & cewe)
    app.get("/random/ppcouple", async (req, res) => {
        try {
            const response = await axios.get('https://api.deline.web.id/random/ppcouple', {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 9; Redmi 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.77 Mobile Safari/537.36'
                },
                timeout: 10000
            });

            // Data dari API eksternal
            const data = response.data;

            // Mengembalikan response dengan format yang sama
            res.json({
                status: data.status || true,
                creator: "Azor & Yanz",
                result: data.result
            });

        } catch (error) {
            res.status(500).json({
                status: false,
                error: `Gagal mengambil data ppcouple: ${error.message}`
            });
        }
    });

};