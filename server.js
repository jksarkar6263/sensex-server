import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors()); // allow frontend fetches without CORS issues

// In-memory tick store keyed by expiry (DD-MM-YYYY)
let sensexTicks = {};

// Function to fetch Sensex futures CMP from NiftyTrader API
async function fetchSensexFutureCMP() {
  try {
    const resp = await fetch(
      "https://webapi.niftytrader.in/webapi/Symbol/future-expiry-data?symbol=sensex&exchange=bse"
    );
    const data = await resp.json();
    const records = data?.resultData || [];
    if (!records.length) {
      console.log("No records returned from NiftyTrader");
      return;
    }

    console.log("Fetched records:", records);

    // Loop through all expiry contracts (near + next month)
    for (const row of records) {
      // Format expiry as DD-MM-YYYY to match dropdown
      const expiryDate = new Date(row.expiry_date);
      const formattedExpiry = expiryDate
        .toLocaleDateString("en-GB") // gives DD/MM/YYYY
        .replace(/\//g, "-");        // → DD-MM-YYYY

      const tick = {
        time: row.time, // use API's time field directly
        ltp: Number(row.ltp ?? row.last_price ?? row.close_price),
        expiry: formattedExpiry
      };

      if (!sensexTicks[formattedExpiry]) sensexTicks[formattedExpiry] = [];
      if (!sensexTicks[formattedExpiry].find(t => t.time === tick.time)) {
        sensexTicks[formattedExpiry].push(tick);
        console.log(`Logged tick for expiry ${formattedExpiry}:`, tick);
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

// Poll every minute between 9:15 and 15:30 IST
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
