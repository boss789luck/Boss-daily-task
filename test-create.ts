async function test() {
  const payload = {
    "0": {
      "json": {
        "cardName": "test01",
        "bankName": "",
        "cardNumber": "",
        "expiry": "",
        "cvv": "",
        "cardholderName": ""
      }
    }
  };
  
  try {
    const res = await fetch("http://localhost:5173/api/trpc/cardManager.createCard?batch=1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    
    console.log("Status:", res.status, res.statusText);
    const text = await res.text();
    console.log("Body:", text);
  } catch (e) {
    console.error("Fetch failed:", e);
  }
}

test();
