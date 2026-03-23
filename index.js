const http = require("http");
const axios = require("axios");
const cron = require("node-cron");

// 🚀 START SERVER FIRST (Render requirement)
const port = process.env.PORT || 10000;

http.createServer((req, res) => {
  res.writeHead(200);
  res.end("Dexcom bridge running");
}).listen(port, () => {
  console.log(`🌐 Server running on port ${port}`);
});

// ================= CONFIG =================

const USERNAME = process.env.DEXCOM_USERNAME;
const PASSWORD = process.env.DEXCOM_PASSWORD;
const NIGHTSCOUT_URL = process.env.NIGHTSCOUT_URL;
const API_SECRET = process.env.NIGHTSCOUT_API_SECRET;

let sessionId = null;

// ================= LOGIN =================

async function login() {
  try {
    console.log("🔐 Attempting Dexcom login...");

    const res = await axios.post(
      "https://share2.dexcom.com/ShareWebServices/Services/General/LoginPublisherAccountByName",
      {
        accountName: USERNAME,
        password: PASSWORD,
        applicationId: "d89443d2-327c-4a6f-89e5-496bbb0317db",
      },
      { timeout: 10000 }
    );

    sessionId = res.data;

    console.log("✅ Dexcom login successful");
  } catch (err) {
    console.error(
      "❌ Login failed:",
      err.response?.data?.Code || err.message
    );
    sessionId = null;
  }
}

// ================= FETCH =================

async function fetchGlucose() {
  try {
    if (!sessionId) {
      await login();
      if (!sessionId) return;
    }

    console.log("📡 Fetching glucose...");

    const res = await axios.post(
      "https://share2.dexcom.com/ShareWebServices/Services/Publisher/ReadPublisherLatestGlucoseValues",
      {
        sessionId,
        minutes: 1440,
        maxCount: 1,
      },
      { timeout: 10000 }
    );

    const data = res.data?.[0];

    if (!data) {
      console.log("⚠️ No glucose data yet");
      return;
    }

    const glucose = data.Value;
    const timestamp = new Date(data.WT).getTime();

    console.log(`📊 Glucose: ${glucose}`);

    await sendToNightscout(glucose, timestamp);
  } catch (err) {
    console.error(
      "❌ Fetch failed:",
      err.response?.data?.Code || err.message
    );

    // force re-login next cycle
    sessionId = null;
  }
}

// ================= PUSH =================

async function sendToNightscout(glucose, timestamp) {
  try {
    await axios.post(
      `${NIGHTSCOUT_URL}/api/v1/entries.json`,
      [
        {
          sgv: glucose,
          date: timestamp,
          dateString: new Date(timestamp).toISOString(),
          type: "sgv",
        },
      ],
      {
        headers: {
          "API-SECRET": API_SECRET,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );

    console.log("🚀 Sent to Nightscout");
  } catch (err) {
    console.error(
      "❌ Nightscout error:",
      err.response?.data || err.message
    );
  }
}

// ================= SCHEDULE =================

cron.schedule("*/5 * * * *", () => {
  console.log("⏱ Poll cycle starting...");
  fetchGlucose();
});

// ================= START =================

console.log("Dexcom bridge running...");
login();
