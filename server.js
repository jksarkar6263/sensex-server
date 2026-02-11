// server.js
import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = 3000;

// In-memory tick store (reset daily at 9:15)
let sensexTicks = [];

// Function to fetch Sensex futures CMP from your API endpoint
async function fetchSensexFutureCMP() {
  try {
    const resp = await fetch("http://localhost:5000/api/futures?symbol=sensex");
    const data = await resp.json();
    const records = data?.resultData || [];
    if (!records.length) return;

    // Pick near-month expiry (first record)
    const chartRow = records[0];
    const tick = {
      time: chartRow.time,       // e.g. "09:15:00"
      ltp: Number(chartRow.ltp), // CMP
      prevClose: Number(chartRow.prev_close),
      expiry: String(chartRow.expiry_date).slice(0,10)
    };

    // Avoid duplicates
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

app.listen(PORT, () => {
  console.log(`Sensex server running on http://localhost:${PORT}`);
});