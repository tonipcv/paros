import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { authenticateApiKey } from "@/lib/api-auth";
import { createKRXMcpServer } from "@/mcp/server";

export const runtime = "nodejs";
export const maxDuration = 60;

function errorResponse(message: string, status: number) {
  return Response.json(
    { jsonrpc: "2.0", error: { code: -32000, message }, id: null },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

async function handle(request: Request) {
  const auth = await authenticateApiKey(request, { applyRateLimit: false, updateLastUsed: false });
  if (!auth.ok) return errorResponse(auth.message, auth.status);

  const authorization = request.headers.get("authorization") || "";
  const apiKey = authorization.replace(/^Bearer\s+/i, "").trim();
  const configuredBaseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  const baseUrl = configuredBaseUrl || (process.env.NODE_ENV === "development" ? new URL(request.url).origin : "");
  if (!baseUrl) return errorResponse("MCP server base URL is not configured", 503);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const server = createKRXMcpServer({ apiKey, baseUrl });
  await server.connect(transport);
  return transport.handleRequest(request, {
    authInfo: { token: apiKey, clientId: auth.keyId, scopes: [] },
  });
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
