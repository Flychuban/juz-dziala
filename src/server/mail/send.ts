import "server-only";

import { env } from "~/env";
import { maskContact } from "~/server/cases/_pending-domain";
import { db } from "~/server/db";
import { deliveries } from "~/server/db/schema";

/**
 * Outbound delivery. E-mail is real when a transport is configured
 * (Resend → SMTP → none); SMS is simulated in the prototype. Every attempt —
 * sent, simulated, skipped or failed — writes a jd_delivery row with the
 * recipient masked, so staff see exactly what reached whom.
 */
export type DeliveryStatus = "sent" | "simulated" | "failed" | "skipped";
export type DeliveryResult = { status: DeliveryStatus; error?: string };

export function mailTransport(): "resend" | "smtp" | null {
  if (env.RESEND_API_KEY && env.MAIL_FROM) return "resend";
  if (env.SMTP_URL) return "smtp";
  return null;
}

const FROM_FALLBACK = "Już Działa <no-reply@juz-dziala.local>";

async function record(row: {
  channel: "email" | "sms" | "phone";
  to: string;
  subject?: string | null;
  body: string;
  status: DeliveryStatus;
  error?: string | null;
  caseId?: string | null;
}) {
  try {
    await db.insert(deliveries).values({
      channel: row.channel,
      toMasked: row.to ? maskContact(row.to) : "—",
      subject: row.subject ?? null,
      body: row.body,
      status: row.status,
      error: row.error?.slice(0, 500) ?? null,
      caseId: row.caseId ?? null,
    });
  } catch (e) {
    console.error("[mail] failed to record delivery", e);
  }
}

/** Sends one plain-text e-mail. Never throws: the result says what happened. */
export async function sendMail(opts: {
  to: string;
  subject: string;
  text: string;
  caseId?: string | null;
}): Promise<DeliveryResult> {
  const transport = mailTransport();
  let result: DeliveryResult;
  if (!transport) {
    result = {
      status: "skipped",
      error: "Brak skonfigurowanej poczty (RESEND_API_KEY + MAIL_FROM lub SMTP_URL).",
    };
  } else {
    try {
      if (transport === "resend") {
        const { Resend } = await import("resend");
        const resend = new Resend(env.RESEND_API_KEY);
        const res = await resend.emails.send({
          from: env.MAIL_FROM!,
          to: opts.to,
          subject: opts.subject,
          text: opts.text,
        });
        result = res.error
          ? { status: "failed", error: res.error.message }
          : { status: "sent" };
      } else {
        const nodemailer = await import("nodemailer");
        const t = nodemailer.createTransport(env.SMTP_URL);
        await t.sendMail({
          from: env.MAIL_FROM ?? FROM_FALLBACK,
          to: opts.to,
          subject: opts.subject,
          text: opts.text,
        });
        result = { status: "sent" };
      }
    } catch (e) {
      result = {
        status: "failed",
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }
  await record({
    channel: "email",
    to: opts.to,
    subject: opts.subject,
    body: opts.text,
    status: result.status,
    error: result.error,
    caseId: opts.caseId,
  });
  return result;
}

/** SMS is simulated in the prototype: logged, never sent. */
export async function simulateSms(opts: {
  to: string;
  text: string;
  caseId?: string | null;
}): Promise<DeliveryResult> {
  await record({
    channel: "sms",
    to: opts.to,
    body: opts.text,
    status: "simulated",
    caseId: opts.caseId,
  });
  return { status: "simulated" };
}

/** A phone call is a task for a person; the log shows it was requested. */
export async function recordCallbackTask(opts: {
  to: string;
  text: string;
  caseId?: string | null;
}): Promise<DeliveryResult> {
  await record({
    channel: "phone",
    to: opts.to,
    body: opts.text,
    status: "simulated",
    caseId: opts.caseId,
  });
  return { status: "simulated" };
}
