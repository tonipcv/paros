import { requireAdmin } from "@/lib/auth";
import { error, json } from "@/lib/http";
import { hasEmail, sendEmail, emailLayout, paragraph, button, appUrl } from "@/lib/email";
import { logAdminAction } from "@/lib/admin-audit";

export const runtime = "nodejs";

export async function POST() {
  try {
    const admin = await requireAdmin("SUPER_ADMIN");
    if (!admin) return error("Authentication required", 401);
    if (!hasEmail()) return error("No email provider configured", 503);

    const link = `${appUrl()}/reset?token=admin-test`;
    const html = emailLayout({
      title: "Admin test email",
      bodyHtml: paragraph("This is a test email sent from the admin panel to verify that the email delivery system is operational.") + `<p style="margin:0 0 8px;">${button(`${appUrl()}/admin`, "Admin panel")}</p>`,
      footer: "This is an automated test message. No action is required.",
    });
    await sendEmail({ to: admin.email, subject: "Admin test email", html, text: "Admin test email from the admin panel." });
    await logAdminAction({ id: admin.id, email: admin.email }, "test_email", undefined, `Sent to ${admin.email}`).catch(() => {});
    return json({ ok: true, sentTo: admin.email });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed";
    console.error("admin test email error:", e);
    return error(message, 500);
  }
}
