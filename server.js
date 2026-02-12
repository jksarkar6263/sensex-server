import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;

// In-memory tick store keyed by expiry
let sensexTicks = {};

// Function to fetch Sensex futures CMP from NiftyTrader API
async function fetchSensexFutureCMP() {
  try {
    const resp = await fetch("https://webapi.niftytrader.in/webapi/Symbol/future-expiry-data?symbol=sensex&exchange=bse");
    const data = await resp.json();
    const records = data?.resultData || [];
    if (!records.length) {
      console.log("No records returned from NiftyTrader");
      return;
    }

    console.log("Fetched records:", records);

    // Loop through all expiry contracts (near + next month)
    for (const row of records) {
      const expiry = String(row.expiry_date).slice(0, 10);
      const tick = {
        time: new Date().toLocaleTimeString("en-IN", { hour12: false }),
        ltp: Number(row.ltp ?? row.last_price), // <-- fallback to last_price
        expiry
      };

      if (!sensexTicks[expiry]) sensexTicks[expiry] = [];
      if (!sensexTicks[expiry].find(t => t.time === tick.time)) {
        sensexTicks[expiry].push(tick);
        console.log(`Logged tick for expiry ${expiry}:`, tick);
      }
    }
  } catch (err) {
    console.error("Error fetching Sensex CMP:", err);
  }
}

// Reset ticks at 9:15 daily
function resetAtMarketOpen() {
  const now = new Date();
  if (now.getHours() === 9 && now.getMinutes() === 15) {
    sensexTicks = {};
    console.log("Reset Sensex ticks at market open");
  }
}

// Poll every minute between 9:15 and 15:30
setInterval(() => {
  const now = new Date();
  const hr = now.getHours();
  const min = now.getMinutes();
  if (hr >= 9 && (hr < 15 || (hr === 15 && min <= 30))) {
    resetAtMarketOpen();
    fetchSensexFutureCMP();
  }
}, 60 * 1000);

// API endpoint to serve ticks to frontend
app.get("/api/sensexTicks", (req, res) => {
  res.json({ result: 1, resultMessage: "Success", resultData: sensexTicks });
});

// Root route for Render health check
app.get("/", (req, res) => {
  res.send("Sensex server is running. Use /api/sensexTicks to get data.");
});

app.listen(PORT, () => {
  console.log(`Sensex server running on http://localhost:${PORT}`);
});
