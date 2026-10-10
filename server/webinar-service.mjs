import crypto from "node:crypto";

/**
 * Generate an active, real-time Jitsi Meet video webinar room URL.
 * Jitsi Meet is an open-source, production video meeting platform requiring no accounts or API keys.
 * Attendees and hosts can join directly via web or mobile app with full video, audio, screen sharing and chat.
 */
export function generateJitsiRoomUrl(title = "Webinar", id = "") {
  const cleanTitle = (title || "Webinar")
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30) || "Session";
  const suffix = (id || crypto.randomUUID().slice(0, 8)).replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
  return `https://meet.jit.si/NexusWebinar-${cleanTitle}-${suffix}`;
}

export function ensureWebinarRoom(webinar = {}) {
  if (webinar.joinUrl && /^https?:\/\//i.test(webinar.joinUrl)) {
    return webinar.joinUrl;
  }
  return generateJitsiRoomUrl(webinar.title, webinar.id);
}
