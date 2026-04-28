/**
 * Socket.IO event name & room name constants
 * Tập trung quản lý event names → tránh typo, dễ grep
 */

// ─── Room Names ──────────────────────────────────────────────────────────────
const ROOMS = {
  AGENTS: 'agents',
  chat: (sessionId) => `chat_${sessionId}`,
  user: (userId) => `user_${userId}`
}

// ─── Event Names ─────────────────────────────────────────────────────────────
const EVENTS = {
  // Lifecycle
  JOIN: 'join',
  DISCONNECT: 'disconnect',

  // Customer → Server
  CHAT_JOIN: 'chat:join',
  CHAT_SEND: 'chat:send',
  CHAT_REQUEST_AGENT: 'chat:request_agent',
  CHAT_SWITCH_TO_BOT: 'chat:switch_to_bot',
  CHAT_REACTION: 'chat:reaction',

  // Agent → Server
  CHAT_AGENT_REPLY: 'chat:agent_reply',
  CHAT_ASSIGN: 'chat:assign',
  CHAT_RESOLVE: 'chat:resolve',

  // Bi-directional
  CHAT_TYPING: 'chat:typing',

  // Server → Client
  CHAT_MESSAGE: 'chat:message',
  CHAT_REACTION_UPDATED: 'chat:reaction_updated',
  CHAT_RESOLVED: 'chat:resolved',
  CHAT_NEW_CONVERSATION: 'chat:new_conversation',
  CHAT_NEW_MESSAGE: 'chat:new_message',
  CHAT_CONVERSATION_UPDATED: 'chat:conversation_updated',
  CHAT_CUSTOMER_TYPING: 'chat:customer_typing',
  CHAT_ESCALATION: 'chat:escalation',
  CHAT_BOT_TYPING: 'chat:bot_typing',
  CHAT_BOT_ACTIVITY: 'chat:bot_activity'
}

module.exports = { ROOMS, EVENTS }
