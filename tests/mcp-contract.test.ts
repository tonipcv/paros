import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { createKRXMcpServer } from "../src/mcp/server";

async function main() {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const auth = new Headers(init?.headers).get("authorization");
    assert.equal(auth, "Bearer nb-test");
    if (url.endsWith("/api/v1/models")) {
      return Response.json({ data: [{ id: "test/model", name: "Test", owned_by: "test", credits_per_request: 1, capabilities: { reasoning: true } }] });
    }
    if (url.endsWith("/api/v1/chat/completions")) {
      return Response.json({ choices: [{ message: { content: "contract reply" } }] });
    }
    if (url.endsWith("/api/v1/images/generations")) {
      return Response.json({ data: [{ url: "https://example.com/image.png" }] });
    }
    if (url.endsWith("/api/v1/audio/speech")) {
      return new Response(new Uint8Array([73, 68, 51]), { headers: { "Content-Type": "audio/mpeg" } });
    }
    return Response.json({ error: { message: "not found" } }, { status: 404 });
  };

  const server = createKRXMcpServer({ apiKey: "nb-test", baseUrl: "https://krx.test" });
  const client = new Client({ name: "contract-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const tools = await client.listTools();
    assert.deepEqual(tools.tools.map((tool) => tool.name).sort(), ["chat", "generate_image", "list_models", "synthesize"]);

    const models = CallToolResultSchema.parse(await client.callTool({ name: "list_models", arguments: {} }));
    assert.equal(models.isError, undefined);
    assert.match(String(models.content[0] && "text" in models.content[0] ? models.content[0].text : ""), /test\/model/);

    const chat = CallToolResultSchema.parse(await client.callTool({ name: "chat", arguments: { model: "test/model", prompt: "hello" } }));
    assert.equal(chat.isError, undefined);
    assert.match(String(chat.content[0] && "text" in chat.content[0] ? chat.content[0].text : ""), /contract reply/);

    const image = CallToolResultSchema.parse(await client.callTool({ name: "generate_image", arguments: { prompt: "test" } }));
    assert.match(String(image.content[0] && "text" in image.content[0] ? image.content[0].text : ""), /image\.png/);

    const audio = CallToolResultSchema.parse(await client.callTool({ name: "synthesize", arguments: { text: "hello" } }));
    const audioContent = audio.content[0];
    assert.ok(audioContent && audioContent.type === "audio");
    if (audioContent.type === "audio") assert.equal(audioContent.data, "SUQz");
    console.log("ok - MCP tools satisfy the client contract");
  } finally {
    globalThis.fetch = originalFetch;
    await client.close();
    await server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
