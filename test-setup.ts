async function test() {
  const payload = {
    "0": {
      "json": {
        "card": "KTC Proud",
        "profile": "Boss Personal",
        "page": "Boss OS Page",
        "adAccount": "Ad Account 01",
        "subscription": "Canva Pro"
      }
    }
  };
  
  try {
    const res = await fetch("http://localhost:5173/api/trpc/cardManager.createLinkSetup?batch=1", {
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
