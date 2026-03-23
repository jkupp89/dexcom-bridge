const axios = require("axios");
const cron = require("node-cron");

const DEXCOM_USERNAME = process.env.DEXCOM_USERNAME;
const DEXCOM_PASSWORD = process.env.DEXCOM_PASSWORD;
const NIGHTSCOUT_URL = process.env.NIGHTSCOUT_URL;
const NIGHTSCOUT_API_SECRET = process.env.NIGHTSCOUT_API_SECRET;

let sessionId = null;

async function login() {
  const res = await axios.post(
    "https://share2.dexcom.com/ShareWebServices/Services/General/LoginPublisherAccountByName",
    {
      accountName: DEXCOM_USERNAME,
      password: DEXCOM_PASSWORD,
      applicationId: "d89443d2-327c-4a6f-89e5-496bbb0317db"
    }
  );
  sessionId = res.data;
  console.log("Logged into Dexcom");
}

async function getGlucose() {
  const res = await axios.post(
    "https://share2.dexcom.com/ShareWebServices/Services/Publisher/ReadPublisherLatestGlucoseValues",
    {
      sessionId,
      minutes: 1440,
      maxCount: 1
    }
  );

  return res.data[0];
}

async function pushToNightscout(glucose) {
  const sgv = glucose.Value;

  await axios.post(
    `${NIGHTSCOUT_URL}/api/v1/entries`,
    [{
      sgv,
      type: "sgv",
      date: Date.now()
    }],
    {
      headers: {
        "API-SECRET": NIGHTSCOUT_API_SECRET
      }
    }
  );

  console.log("Pushed glucose:", sgv);
}

async function run() {
  try {
    if (!sessionId) await login();
    const glucose = await getGlucose();
    await pushToNightscout(glucose);
  } catch (err) {
    console.error("Error:", err.response?.data || err.message);
    sessionId = null;
  }
}

cron.schedule("*/5 * * * *", run);

console.log("Dexcom bridge running...");
