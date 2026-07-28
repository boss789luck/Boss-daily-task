import "dotenv/config";

async function testOpenAI() {
  const key = process.env.OPENAI_DALLE_API_KEY;
  console.log("Testing with key:", key?.substring(0, 10) + "...");
  try {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "gpt-image-2",
        prompt: "A simple red apple",
        n: 1,
        size: "1024x1024",
      }),
    });
    
    console.log("Status:", response.status);
    const text = await response.text();
    console.log("Response:", text);
  } catch (err) {
    console.error("Error:", err);
  }
}

testOpenAI();
