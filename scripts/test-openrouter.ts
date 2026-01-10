// Debug script to find correct OpenRouter Gemini model IDs
const API_KEY = process.env.OPENROUTER_API_KEY;

interface Model {
  id: string;
  name: string;
  context_length?: number;
  pricing?: {
    prompt: string;
    completion: string;
  };
}

async function listModels(): Promise<Model[]> {
  console.log("=== Fetching available models from OpenRouter ===\n");
  const res = await fetch("https://openrouter.ai/api/v1/models", {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  const data = await res.json();

  // Filter Gemini models
  const geminiModels = data.data.filter((m: Model) =>
    m.id.toLowerCase().includes("gemini")
  );

  console.log("=== Available Gemini Models ===");
  geminiModels.forEach((m: Model) => {
    console.log(`  - ${m.id} (${m.name || "no name"})`);
  });
  console.log(`\nTotal Gemini models: ${geminiModels.length}\n`);

  // Check specifically for gemini-3 variants
  const gemini3Models = geminiModels.filter((m: Model) =>
    m.id.toLowerCase().includes("gemini-3") ||
    m.id.toLowerCase().includes("gemini3")
  );

  if (gemini3Models.length > 0) {
    console.log("=== Gemini 3 Models Found ===");
    gemini3Models.forEach((m: Model) => {
      console.log(`  - ${m.id}`);
    });
  } else {
    console.log("=== NO Gemini 3 Models Found on OpenRouter ===");
  }

  return geminiModels;
}

async function testModel(modelId: string): Promise<any> {
  console.log(`\n=== Testing: ${modelId} ===`);
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://vidpulse.test",
        "X-Title": "VidPulse Debug",
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: "Say OK" }],
        max_tokens: 10,
      }),
    });
    const data = await res.json();

    if (data.error) {
      console.log(`  ERROR: ${data.error.message || JSON.stringify(data.error)}`);
    } else if (data.choices?.[0]?.message?.content) {
      console.log(`  SUCCESS: "${data.choices[0].message.content}"`);
    } else {
      console.log(`  Response: ${JSON.stringify(data, null, 2)}`);
    }

    return data;
  } catch (err) {
    console.error(`  CATCH ERROR:`, err);
    return null;
  }
}

async function main() {
  if (!API_KEY) {
    console.error("ERROR: Set OPENROUTER_API_KEY env var");
    process.exit(1);
  }

  console.log("OpenRouter API Key:", API_KEY.slice(0, 15) + "..." + API_KEY.slice(-4));
  console.log("");

  // 1. List available models
  const geminiModels = await listModels();

  // 2. Test specific model IDs we want to use
  console.log("\n========================================");
  console.log("Testing specific model IDs:");
  console.log("========================================");

  const testIds = [
    "google/gemini-3-flash-preview",
    "google/gemini-3-flash",
    "google/gemini-2.5-flash-preview",
    "google/gemini-2.5-flash",
    "google/gemini-2.0-flash",
  ];

  for (const id of testIds) {
    await testModel(id);
  }

  // 3. If we found any Gemini 2.5+ models, test them
  const newer = geminiModels.filter((m: Model) =>
    m.id.includes("2.5") || m.id.includes("3")
  );

  if (newer.length > 0) {
    console.log("\n========================================");
    console.log("Testing discovered newer Gemini models:");
    console.log("========================================");
    for (const m of newer.slice(0, 5)) {
      await testModel(m.id);
    }
  }

  console.log("\n========================================");
  console.log("DONE - Use a working model ID above");
  console.log("========================================");
}

main();
