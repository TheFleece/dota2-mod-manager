/**
 * Mail to the project, forwarded and announced.
 *
 * A person or a company that wants to reach this project has had nowhere to write: issues are
 * public, Discord is not somewhere a company writes, and a personal address is not something to
 * publish on a site. So `hello@` and `security@` exist, and this is what happens to a message
 * sent to them.
 *
 * Two things, in this order:
 *   1. it is forwarded to the maintainer's own mailbox, whole, so nothing is lost or rewritten;
 *   2. a short line about it goes to a private Discord channel, so it is seen the same day.
 *
 * The line carries the headers and nothing else: no MIME parsing, no attachments, no body. That
 * is deliberate. Parsing a stranger's message in a worker to show it somewhere is a job for a
 * library and a job where a mistake is a security bug, and the forwarded copy already has
 * everything. The channel is a doorbell, not an inbox.
 *
 * Authentication results ride along, so a message claiming to be from a company that fails SPF
 * or DKIM says so on the same line as its subject.
 *
 * Deploy:
 *   npx wrangler deploy                      # from this folder
 *   npx wrangler secret put DISCORD_WEBHOOK  # the private channel's webhook
 * Then in Cloudflare, Email Routing, Routes: send hello@ and security@ to this worker.
 */

/** Never let the doorbell hold up the letter: a failed webhook must not bounce the mail. */
async function ring(env, fields) {
  if (!env.DISCORD_WEBHOOK) return;
  const body = {
    username: 'Mailbox',
    embeds: [{
      title: fields.subject || '(no subject)',
      description: [
        `**From** ${fields.from}`,
        `**To** ${fields.to}`,
        fields.auth ? `**Checks** ${fields.auth}` : null,
        fields.size ? `**Size** ${fields.size}` : null,
        '',
        fields.forwarded === false
          ? `**Not forwarded**: ${fields.forwardError || 'no reason given'}. The message is only here.`
          : 'The message itself is in the mailbox it was forwarded to.',
      ].filter(Boolean).join('\n'),
      color: fields.suspect ? 0xe0533d : 0x8b6ff0,
      timestamp: new Date().toISOString(),
    }],
  };
  try {
    await fetch(env.DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch { /* the mail still goes through, which is the part that matters */ }
}

/** A header, trimmed to something a chat message can hold. */
const head = (message, name, max = 200) => String(message.headers.get(name) || '').slice(0, max);

export default {
  /**
   * @param {{from: string, to: string, headers: Headers, rawSize: number, forward: Function}} message
   * @param {{FORWARD_TO?: string, DISCORD_WEBHOOK?: string}} env
   */
  async email(message, env, ctx) {
    const auth = head(message, 'authentication-results', 300);
    const suspect = /spf=fail|dkim=fail|dmarc=fail/i.test(auth);

    /* Forward first, then ring, so the line can say whether the letter actually went. A forward
       that throws used to take the handler with it, which bounces the message back to whoever
       wrote and tells us nothing. Now it is reported and the message is still in one place: the
       channel.

       One failure this cannot see: a copy sent from the same mailbox it forwards to arrives with
       a Message-ID that mailbox already has, and Gmail drops it without a word. The forward
       succeeded; the inbox simply refuses to show it twice. Test from somewhere else. */
    let forwarded = true;
    let forwardError = '';
    if (env.FORWARD_TO) {
      try {
        await message.forward(env.FORWARD_TO);
      } catch (err) {
        forwarded = false;
        forwardError = String(err && err.message ? err.message : err).slice(0, 200);
      }
    }

    // announced after it, and in the background: Discord being slow is not a reason to delay mail
    ctx.waitUntil(ring(env, {
      from: message.from,
      to: message.to,
      subject: head(message, 'subject'),
      auth: auth ? auth.split(';')[0] : '',
      size: message.rawSize ? `${Math.round(message.rawSize / 1024)} KB` : '',
      suspect: suspect || !forwarded,
      forwarded,
      forwardError,
    }));
  },
};
