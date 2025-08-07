/**
 * telegram.ts
 * Thin wrapper around Telegram Bot API to send alerts.
 * Keep simple and robust with retry on transient errors.
 */

import TelegramBot from 'node-telegram-bot-api';
import { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } from './config.js';

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });

/**
 * Sends a message to the configured chat.
 * Adds minimal error handling and logs failures to console.
 */
export async function sendTelegramMessage(text: string): Promise<void> {
  try {
    await bot.sendMessage(TELEGRAM_CHAT_ID, text, {
      parse_mode: 'HTML', // simple formatting for emphasis/links
      disable_web_page_preview: true
    });
  } catch (err) {
    // Log and continue. We do not throw because we don't want to crash the process.
    console.error('[Telegram] Failed to send message:', err);
  }
}