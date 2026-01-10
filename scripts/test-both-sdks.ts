// Test both OpenRouter SDKs to find which one strips the prefix

import { OpenRouter } from "@openrouter/sdk";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText as aiGenerateText } from "ai";

const API_KEY = process.env.OPENROUTER_API_KEY!;
const MODEL = "google/gemini-3-flash-preview";

async function testNativeSDK() {
  console.log("\n=== Testing Native @openrouter/sdk ===");
  console.log(`Model: ${MODEL}`);

  try {
    const client = new OpenRouter({ apiKey: API_KEY });
    const response = await client.chat.send({
      model: MODEL,
      messages: [{ role: "user", content: "Say OK" }],
    });
    console.log("SUCCESS:", response.choices?.[0]?.message?.content);
  } catch (err: any) {
    console.log("ERROR:", err.message || err);
  }
}

async function testAiSdkProvider() {
  console.log("\n=== Testing @openrouter/ai-sdk-provider + ai ===");
  console.log(`Model: ${MODEL}`);

  try {
    const openrouter = createOpenRouter({ apiKey: API_KEY });
    console.log("openrouter instance:", typeof openrouter);

    // Log what the model function returns
    const modelInstance = openrouter(MODEL);
    console.log("modelInstance.modelId:", (modelInstance as any).modelId);
    console.log("modelInstance:", JSON.stringify(modelInstance, null, 2).slice(0, 500));

    const result = await aiGenerateText({
      model: modelInstance,
      prompt: "Say OK",
    });
    console.log("SUCCESS:", result.text);
  } catch (err: any) {
    console.log("ERROR:", err.message || err);
    if (err.cause) {
      console.log("CAUSE:", err.cause);
    }
  }
}

async function testAiSdkProviderChat() {
  console.log("\n=== Testing @openrouter/ai-sdk-provider.chat() ===");
  console.log(`Model: ${MODEL}`);

  try {
    const openrouter = createOpenRouter({ apiKey: API_KEY });

    // Try .chat() method if it exists
    const modelInstance = openrouter.chat(MODEL);
    console.log("modelInstance.modelId:", (modelInstance as any).modelId);

    const result = await aiGenerateText({
      model: modelInstance,
      prompt: "Say OK",
    });
    console.log("SUCCESS:", result.text);
  } catch (err: any) {
    console.log("ERROR:", err.message || err);
  }
}

async function testRawFetch() {
  console.log("\n=== Testing Raw Fetch (bypassing SDKs) ===");
  console.log(`Model: ${MODEL}`);

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: "Say OK" }],
      }),
    });
    const data = await res.json();
    if (data.error) {
      console.log("ERROR:", data.error.message);
    } else {
      console.log("SUCCESS:", data.choices?.[0]?.message?.content);
    }
  } catch (err: any) {
    console.log("ERROR:", err.message || err);
  }
}

async function main() {
  console.log("========================================");
  console.log("Testing OpenRouter Model ID Handling");
  console.log("========================================");

  await testRawFetch();
  await testNativeSDK();
  await testAiSdkProvider();
  await testAiSdkProviderChat();

  console.log("\n========================================");
  console.log("DONE");
  console.log("========================================");
}

main();
