import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;

// In-memory tick store (reset daily at 9:15)
let sensexTicks = [];

// Function to fetch Sensex futures CMP from your existing API
async function fetchSensexFutureCMP() {
  try {
    // IMPORTANT: use the SAME endpoint your frontend uses
    const resp = await fetch("https://<your-public-api-domain>/api/futureQuote?symbol=SENSEX&expiry=NEAR_MONTH");
    const data = await resp.json();
    const row = data?.resultData;
    if (!row) return;

    const tick = {
      time: new Date().toLocaleTimeString("en-IN", { hour12: false }),
      ltp: Number(row.last_price),
      prevClose: Number(row.prev_close),
      expiry: String(row.expiry_date).slice(0, 10)
    };

    if (!sensexTicks.find(t => t.time === tick.time && t.expiry === tick.expiry)) {
      sensexTicks.push(tick);
      console.log("Logged tick:", tick);
    }
  } catch (err) {
    console.error("Error fetching Sensex CMP:", err);
  }
}

// Reset ticks at 9:15 daily
function resetAtMarketOpen() {
  const now = new Date();
  if (now.getHours() === 9 && now.getMinutes() === 15) {
    sensexTicks = [];
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
