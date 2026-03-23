const http = require("http");

// 🚀 START SERVER FIRST (IMPORTANT FOR RENDER)
const port = process.env.PORT || 10000;

http.createServer((req, res) => {
  res.writeHead(200);
  res.end("Dexcom bridge running");
}).listen(port, () => {
  console.log(`🌐 Server running on port ${port}`);
});

// ================= BELOW IS YOUR LOGIC =================

const axios = require("axios");
const cron = require("node-cron");

const DEXCOM_USERNAME = process.env.DEXCOM_USERNAME;
const DEXCOM_PASSWORD = process.env.DEXCOM_PASSWORD;
const NIGHTSCOUT_URL = process.env.NIGHTSCOUT_URL;
const NIGHTSCOUT_API_SECRET = process.env.NIGHTSCOUT_API_SECRET;

let sessionId = null;

async function login() {
  try {
    const res = await axios.post(
      "https://share2.dexcom.com/ShareWebServices/Services/General/LoginPublisherAccountByName",
      {
        accountName: DEXCOM_USERNAME,
        password: DEXCOM_PASSWORD,
        applicationId: "d89443d2-327c-4a6f-89e5-496bbb0317db",
      }
    );

    sessionId = res.data;
    console.log("✅ Logged into Dexcom");
  } catch (err) {
    console.error("❌ Dexcom login failed:", err.response?.data || err.message);
    sessionId = null;
  }
}

async function fetchGlucose() {
  if (!sessionId) {
    console.log("⚠️ No session, logging in...");
    await login();
    if (!sessionId) return;
  }

  try {
    const res = await axios.post(
      "https://share2.dexcom.com/ShareWebServices/Services/Publisher/ReadPublisherLatestGlucoseValues",
      {
        sessionId: sessionId,
        minutes: 1440,
        maxCount: 1,
      }
    );

    const data = res.data?.[0];
    if (!data) return;

    const glucose = data.Value;
    const date = new Date(data.WT).getTime();

    console.log(`📊 Glucose: ${glucose}`);

    await axios.post(
      `${NIGHTSCOUT_URL}/api/v1/entries.json`,
      [
        {
          sgv: glucose,
          date: date,
          dateString: new Date(date).toISOString(),
          type: "sgv",
        },
      ],
      {
        headers: {
          "API-SECRET": NIGHTSCOUT_API_SECRET,
        },
      }
    );

    console.log("🚀 Sent to Nightscout");
  } catch (err) {
    console.error("❌ Fetch error:", err.response?.data || err.message);
    sessionId = null;
  }
}

cron.schedule("*/5 * * * *", fetchGlucose);

console.log("Dexcom bridge running...");
login();
