const path = require('path')
const mongoose = require('mongoose')
const dotenv = require('dotenv')

dotenv.config({ path: path.resolve(__dirname, '..', '.env') })

const ChatConversation = require('../api/v1/models/chatConversation.model')
const ChatMessage = require('../api/v1/models/chatMessage.model')

const DEFAULT_COUNT = 100
const DEFAULT_MESSAGES_PER_CONVERSATION = 3
const SESSION_PREFIX = 'seed_chat'

function getArgValue(name, fallback = null) {
  const prefix = `--${name}=`
  const arg = process.argv.find(item => item.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : fallback
}

function getPositiveIntegerArg(name, fallback) {
  const value = Number.parseInt(getArgValue(name), 10)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`)
}

function pad(value, length = 3) {
  return String(value).padStart(length, '0')
}

function getStatus(index) {
  const statuses = ['unassigned', 'open', 'resolved']
  return statuses[index % statuses.length]
}

function getCustomerName(index) {
  const names = [
    'Seed Nguyen',
    'Test Tran',
    'Demo Le',
    'Mock Pham',
    'Sample Hoang',
    'Trial Vu'
  ]

  return `${names[index % names.length]} ${pad(index + 1)}`
}

function getLastMessage(index) {
  const samples = [
    'Toi muon hoi ve san pham',
    'Ben minh con hang khong?',
    'Tu van giup minh don hang nay',
    'Cho minh xem san pham dang giam gia',
    'San pham nay bao hanh bao lau?',
    'Minh can ho tro thanh toan'
  ]

  return `${samples[index % samples.length]} #${pad(index + 1)}`
}

function buildAssignedAgent(status, index, now) {
  if (status === 'unassigned') {
    return {
      agentId: null,
      agentName: null,
      agentAvatar: null,
      assignedAt: null
    }
  }

  return {
    agentId: `seed_agent_${(index % 4) + 1}`,
    agentName: `Seed Agent ${(index % 4) + 1}`,
    agentAvatar: null,
    assignedAt: new Date(now.getTime() - (index + 1) * 60 * 1000)
  }
}

function buildMessages({ conversationId, sessionId, index, count, now, status }) {
  const messages = []
  const baseTime = new Date(now.getTime() - index * 10 * 60 * 1000)
  const customerName = getCustomerName(index)
  const lastMessage = getLastMessage(index)

  messages.push({
    conversationId,
    sessionId,
    sender: 'customer',
    senderName: customerName,
    type: 'text',
    message: lastMessage,
    isRead: status !== 'unassigned',
    createdAt: baseTime,
    updatedAt: baseTime
  })

  if (count >= 2) {
    const botTime = new Date(baseTime.getTime() + 60 * 1000)
    messages.push({
      conversationId,
      sessionId,
      sender: 'bot',
      senderName: 'SmartMall Bot',
      type: 'text',
      message: 'Ban muon hoi san pham nao? Gui ten san pham de minh kiem tra nhanh.',
      isRead: true,
      createdAt: botTime,
      updatedAt: botTime
    })
  }

  for (let messageIndex = 2; messageIndex < count; messageIndex += 1) {
    const messageTime = new Date(baseTime.getTime() + messageIndex * 60 * 1000)
    const isCustomer = messageIndex % 2 === 0
    messages.push({
      conversationId,
      sessionId,
      sender: isCustomer ? 'customer' : 'agent',
      senderId: isCustomer ? null : `seed_agent_${(index % 4) + 1}`,
      senderName: isCustomer ? customerName : `Seed Agent ${(index % 4) + 1}`,
      type: 'text',
      message: isCustomer
        ? `Khach phan hoi them #${pad(index + 1)}.${messageIndex}`
        : `Agent dang ho tro hoi thoai seed #${pad(index + 1)}.${messageIndex}`,
      isRead: status !== 'unassigned',
      createdAt: messageTime,
      updatedAt: messageTime
    })
  }

  return messages
}

async function cleanSeedData() {
  const seedSessionQuery = { sessionId: { $regex: `^${SESSION_PREFIX}_` } }
  const [messagesResult, conversationsResult] = await Promise.all([
    ChatMessage.deleteMany(seedSessionQuery),
    ChatConversation.deleteMany(seedSessionQuery)
  ])

  return {
    conversations: conversationsResult.deletedCount || 0,
    messages: messagesResult.deletedCount || 0
  }
}

async function seed() {
  if (!process.env.MONGO_URL) {
    throw new Error('Missing MONGO_URL in sales-api/.env')
  }

  const count = getPositiveIntegerArg('count', DEFAULT_COUNT)
  const messageCount = getPositiveIntegerArg('messages', DEFAULT_MESSAGES_PER_CONVERSATION)
  const shouldClean = hasFlag('clean')
  const now = new Date()
  const runId = Date.now()
  const conversations = []
  const messages = []

  await mongoose.connect(process.env.MONGO_URL)

  if (shouldClean) {
    const deleted = await cleanSeedData()
    console.log(`Deleted seeded conversations=${deleted.conversations}, messages=${deleted.messages}`)
  }

  for (let index = 0; index < count; index += 1) {
    const status = getStatus(index)
    const conversationId = new mongoose.Types.ObjectId()
    const sessionId = `${SESSION_PREFIX}_${runId}_${pad(index + 1)}`
    const createdAt = new Date(now.getTime() - index * 10 * 60 * 1000)
    const conversationMessages = buildMessages({
      conversationId,
      sessionId,
      index,
      count: messageCount,
      now,
      status
    })
    const lastMessage = conversationMessages[conversationMessages.length - 1]

    conversations.push({
      _id: conversationId,
      sessionId,
      status,
      customer: {
        userId: `seed_user_${pad(index + 1)}`,
        name: getCustomerName(index),
        email: `seed-user-${pad(index + 1)}@example.test`,
        avatar: null,
        userAgent: 'Seed Script',
        currentPage: index % 2 === 0 ? '/cart' : `/products/seed-${pad(index + 1)}`
      },
      assignedAgent: buildAssignedAgent(status, index, now),
      lastMessage: lastMessage.message,
      lastMessageAt: lastMessage.createdAt,
      lastMessageSender: lastMessage.sender,
      unreadByAgent: status === 'unassigned' ? (index % 5) + 1 : 0,
      unreadByCustomer: 0,
      messageCount: conversationMessages.length,
      firstReplyAt: status === 'unassigned' ? null : conversationMessages[1]?.createdAt || null,
      resolvedAt: status === 'resolved' ? new Date(lastMessage.createdAt.getTime() + 60 * 1000) : null,
      botStats: {
        messagesHandled: status === 'unassigned' ? 1 : 2,
        escalated: status !== 'unassigned',
        escalatedAt: status === 'unassigned' ? null : conversationMessages[1]?.createdAt || null,
        escalationReason: status === 'unassigned' ? null : 'Seed test escalation'
      },
      createdAt,
      updatedAt: lastMessage.createdAt
    })

    messages.push(...conversationMessages)
  }

  await ChatConversation.insertMany(conversations)
  await ChatMessage.insertMany(messages)

  console.log(`Seeded conversations=${conversations.length}, messages=${messages.length}`)
  console.log(`Session prefix=${SESSION_PREFIX}_${runId}`)
}

seed()
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await mongoose.disconnect()
  })
