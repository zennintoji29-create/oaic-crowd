import fs from 'fs';
import path from 'path';
import { config } from './config.js';

const DEFAULT_CHANNEL_CONFIG = {
  telegramEnabled: false,
  telegramBotToken: '',
  telegramChatId: '',
  whatsappEnabled: false,
  whatsappPhoneNumberId: '',
  whatsappAccessToken: '',
  whatsappRecipientPhone: '',
  notifyOnAmber: false,
  cooldownSeconds: 60
};

class AlertNotifier {
  constructor() {
    this.globalConfig = { ...DEFAULT_CHANNEL_CONFIG };
    this.userConfigs = new Map();
    this.lastSentAt = new Map(); // key -> timestamp ms
    this.load();
  }

  getFilePath() {
    return path.join(config.dataDir, 'notifications.json');
  }

  load() {
    try {
      const file = this.getFilePath();
      if (fs.existsSync(file)) {
        const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
        if (raw?.global) {
          this.globalConfig = { ...DEFAULT_CHANNEL_CONFIG, ...raw.global };
        }
        if (raw?.users && typeof raw.users === 'object') {
          Object.entries(raw.users).forEach(([email, cfg]) => {
            if (cfg && typeof cfg === 'object') {
              this.userConfigs.set(email.toLowerCase(), { ...DEFAULT_CHANNEL_CONFIG, ...cfg });
            }
          });
        }
      }
    } catch (err) {
      console.warn('[NOTIFIER] Could not load notification config:', err.message);
    }
  }

  save() {
    try {
      if (!fs.existsSync(config.dataDir)) {
        fs.mkdirSync(config.dataDir, { recursive: true });
      }
      const users = {};
      for (const [email, cfg] of this.userConfigs.entries()) {
        users[email] = cfg;
      }
      fs.writeFileSync(
        this.getFilePath(),
        JSON.stringify({ global: this.globalConfig, users }, null, 2)
      );
    } catch (err) {
      console.warn('[NOTIFIER] Could not save notification config:', err.message);
    }
  }

  getConfig(email = null) {
    if (email) {
      const norm = String(email).trim().toLowerCase();
      if (this.userConfigs.has(norm)) {
        return { ...this.userConfigs.get(norm) };
      }
    }
    return { ...this.globalConfig };
  }

  updateConfig(email = null, updates = {}) {
    const current = this.getConfig(email);
    const next = {
      ...current,
      telegramEnabled: updates.telegramEnabled !== undefined ? Boolean(updates.telegramEnabled) : current.telegramEnabled,
      telegramBotToken: updates.telegramBotToken !== undefined ? String(updates.telegramBotToken).trim() : current.telegramBotToken,
      telegramChatId: updates.telegramChatId !== undefined ? String(updates.telegramChatId).trim() : current.telegramChatId,
      whatsappEnabled: updates.whatsappEnabled !== undefined ? Boolean(updates.whatsappEnabled) : current.whatsappEnabled,
      whatsappPhoneNumberId: updates.whatsappPhoneNumberId !== undefined ? String(updates.whatsappPhoneNumberId).trim() : current.whatsappPhoneNumberId,
      whatsappAccessToken: updates.whatsappAccessToken !== undefined ? String(updates.whatsappAccessToken).trim() : current.whatsappAccessToken,
      whatsappRecipientPhone: updates.whatsappRecipientPhone !== undefined ? String(updates.whatsappRecipientPhone).trim() : current.whatsappRecipientPhone,
      notifyOnAmber: updates.notifyOnAmber !== undefined ? Boolean(updates.notifyOnAmber) : current.notifyOnAmber,
      cooldownSeconds: updates.cooldownSeconds !== undefined ? Math.max(10, Number(updates.cooldownSeconds) || 60) : current.cooldownSeconds
    };

    if (email) {
      this.userConfigs.set(String(email).trim().toLowerCase(), next);
    } else {
      this.globalConfig = next;
    }
    this.save();
    return { ...next };
  }

  async detectTelegramChatId(botToken) {
    const token = String(botToken || '').trim();
    if (!token) throw new Error('Bot token is required');
    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=20`);
    const data = await res.json();
    if (!res.ok || !data?.ok) {
      throw new Error(data?.description || 'Telegram API rejected the bot token');
    }
    const updates = Array.isArray(data.result) ? data.result : [];
    for (let i = updates.length - 1; i >= 0; i--) {
      const msg = updates[i]?.message || updates[i]?.edited_message || updates[i]?.channel_post;
      if (msg?.chat?.id !== undefined) {
        return {
          chatId: String(msg.chat.id),
          label: msg.chat.username ? `@${msg.chat.username}` : (msg.chat.first_name || msg.chat.title || 'Chat')
        };
      }
    }
    throw new Error('No messages found yet. Open your bot in Telegram, press Start / send "hi", then click Detect again.');
  }

  async sendTelegram(botToken, chatId, text) {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML'
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      throw new Error(data?.description || `Telegram HTTP ${res.status}`);
    }
    return data;
  }

  async sendWhatsApp(phoneNumberId, accessToken, recipientPhone, text) {
    const cleanedPhone = String(recipientPhone || '').replace(/[^\d]/g, '');
    if (!cleanedPhone) throw new Error('Recipient phone number is required');

    const res = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: cleanedPhone,
        type: 'text',
        text: { body: text }
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error?.message || `WhatsApp Cloud HTTP ${res.status}`);
    }
    return data;
  }

  async dispatchToConfig(cfg, text) {
    const results = {};

    if (cfg.telegramEnabled && cfg.telegramBotToken && cfg.telegramChatId) {
      try {
        await this.sendTelegram(cfg.telegramBotToken, cfg.telegramChatId, text);
        results.telegram = { ok: true };
      } catch (err) {
        results.telegram = { ok: false, error: err.message };
      }
    }

    if (cfg.whatsappEnabled && cfg.whatsappPhoneNumberId && cfg.whatsappAccessToken && cfg.whatsappRecipientPhone) {
      try {
        await this.sendWhatsApp(
          cfg.whatsappPhoneNumberId,
          cfg.whatsappAccessToken,
          cfg.whatsappRecipientPhone,
          text.replace(/<[^>]+>/g, '')
        );
        results.whatsapp = { ok: true };
      } catch (err) {
        results.whatsapp = { ok: false, error: err.message };
      }
    }

    return results;
  }

  async sendTest(email = null) {
    const cfg = this.getConfig(email);
    const hasTelegram = cfg.telegramEnabled && cfg.telegramBotToken && cfg.telegramChatId;
    const hasWhatsApp = cfg.whatsappEnabled && cfg.whatsappPhoneNumberId && cfg.whatsappAccessToken && cfg.whatsappRecipientPhone;
    if (!hasTelegram && !hasWhatsApp) {
      throw new Error('Enable Telegram or WhatsApp and fill in its credentials first.');
    }

    const msg =
      `<b>CPR Crowd Pressure Radar — Test Alert</b>\n` +
      `Status: Connected\n` +
      `Time: ${new Date().toLocaleTimeString()}\n` +
      `You will receive automatic alerts here when a gate hits RED.`;
    return this.dispatchToConfig(cfg, msg);
  }

  notifyAlert(alert, email = null) {
    const cfg = this.getConfig(email);
    if (alert.toState !== 'RED' && !(alert.toState === 'AMBER' && cfg.notifyOnAmber)) {
      return;
    }

    const cooldownMs = (cfg.cooldownSeconds || 60) * 1000;
    const key = `${email || 'global'}:${alert.zoneId}:${alert.toState}`;
    const last = this.lastSentAt.get(key) || 0;
    if (Date.now() - last < cooldownMs) return;
    this.lastSentAt.set(key, Date.now());

    const msg =
      `<b>🚨 CPR ${alert.toState} ALERT — ${alert.zoneName}</b>\n` +
      `Zone: ${alert.zoneId}\n` +
      `Risk Score: ${alert.score}/100 | Density: ${Number(alert.density || 0).toFixed(2)} p/m²\n` +
      `${alert.message}`;

    this.dispatchToConfig(cfg, msg).catch((err) => {
      console.warn('[NOTIFIER] Alert dispatch failed:', err.message);
    });
  }
}

export const notifier = new AlertNotifier();
