import assert from "node:assert/strict";
import { createServer, type IncomingHttpHeaders } from "node:http";
import { AddressInfo } from "node:net";

type Captured = { headers: IncomingHttpHeaders; body: Record<string, unknown> };

async function main() {
  let captured: Captured | null = null;
  const server = createServer((req, res) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      captured = { headers: req.headers, body: JSON.parse(data || "{}") };
      res.writeHead(202, { "content-type": "application/json" });
      res.end(JSON.stringify({ message_id: "mock-1" }));
    });
  });
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as AddressInfo).port;

  // Configure the MailChannels transport to hit the mock.
  process.env.MAILCHANNELS_ENDPOINT = `http://127.0.0.1:${port}/tx/v1/send`;
  process.env.MAILCHANNELS_API_KEY = "test-key";
  process.env.EMAIL_FROM = "NotOpen <notopen@heuv.dev>";
  process.env.EMAIL_REPLY_TO = "notopen@heuv.dev";
  process.env.MAILCHANNELS_DKIM_DOMAIN = "heuv.dev";
  process.env.MAILCHANNELS_DKIM_SELECTOR = "mailchannels";
  process.env.MAILCHANNELS_DKIM_PRIVATE_KEY = "BASE64PRIVATEKEY";

  const { sendEmail, hasEmail, emailLayout, button } = await import("../src/lib/email");

  function test(name: string, fn: () => void) {
    try {
      fn();
      console.log(`ok - ${name}`);
    } catch (error) {
      console.error(`not ok - ${name}`);
      throw error;
    }
  }

  test("provider auto-selects MailChannels when configured", () => {
    assert.equal(hasEmail(), true);
  });

  const html = emailLayout({ title: "Reset your password", bodyHtml: `<p>${button("https://x/y", "Reset")}</p>` });
  const result = await sendEmail({ to: "user@example.com", subject: "Test subject", html, text: "Test text" });
  server.close();

  test("sendEmail resolves ok (not skipped)", () => {
    assert.equal(result.ok, true);
    assert.notEqual(result.skipped, true);
  });

  test("request hit the endpoint with the MailChannels API key header", () => {
    assert.ok(captured, "no request captured");
    assert.equal(captured!.headers["x-api-key"], "test-key");
    assert.equal(captured!.headers["content-type"], "application/json");
  });

  test("payload has correct from / to / subject / content", () => {
    const b = captured!.body as {
      from: { email: string; name?: string };
      personalizations: { to: { email: string }[] }[];
      subject: string;
      content: { type: string; value: string }[];
      reply_to?: { email: string };
    };
    assert.equal(b.from.email, "notopen@heuv.dev");
    assert.equal(b.from.name, "NotOpen");
    assert.equal(b.personalizations[0].to[0].email, "user@example.com");
    assert.equal(b.subject, "Test subject");
    assert.ok(b.content.some((c) => c.type === "text/html"));
    assert.ok(b.content.some((c) => c.type === "text/plain"));
    assert.equal(b.reply_to?.email, "notopen@heuv.dev");
  });

  test("DKIM signing fields are attached from env", () => {
    const p = (captured!.body as { personalizations: Record<string, unknown>[] }).personalizations[0];
    assert.equal(p.dkim_domain, "heuv.dev");
    assert.equal(p.dkim_selector, "mailchannels");
    assert.equal(p.dkim_private_key, "BASE64PRIVATEKEY");
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
