// Test error message format from OpenRouter

import { OpenRouter } from "@openrouter/sdk";

const API_KEY = process.env.OPENROUTER_API_KEY!;

async function testInvalidModel(model: string) {
  console.log(`\n=== Testing invalid model: ${model} ===`);

  try {
    const client = new OpenRouter({ apiKey: API_KEY });
    const response = await client.chat.send({
      model,
      messages: [{ role: "user", content: "Say OK" }],
    });
    console.log("SUCCESS (unexpected):", response);
  } catch (err: any) {
    console.log("Error name:", err.name);
    console.log("Error message:", err.message);
    console.log("Full error:", JSON.stringify(err, Object.getOwnPropertyNames(err), 2).slice(0, 1000));
  }
}

async function main() {
  // Test with models that DON'T exist to see error format
  await testInvalidModel("gemini-3-flash-preview");  // No prefix
  await testInvalidModel("google/nonexistent-model");  // With prefix but invalid
  await testInvalidModel("invalid/model");  // Completely invalid
}

main();
