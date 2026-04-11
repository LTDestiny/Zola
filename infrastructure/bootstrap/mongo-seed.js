const chatDb = db.getSiblingDB("zola_chat_db");
const aiDb = db.getSiblingDB("zola_ai_db");

if (chatDb.conversations.countDocuments() === 0) {
  chatDb.conversations.insertOne({
    type: "DIRECT",
    participants: [
      "11111111-1111-1111-1111-111111111111",
      "11111111-1111-1111-1111-222222222222",
    ],
    last_message: {
      content: "Hello from seed data",
      sender_id: "seed-user-1",
      type: "TEXT",
      sent_at: new Date(),
    },
    updated_at: new Date(),
    created_at: new Date(),
  });
}

if (chatDb.messages.countDocuments() === 0) {
  const conv = chatDb.conversations.findOne({}, { projection: { _id: 1 } });
  if (conv) {
    chatDb.messages.insertOne({
      conversation_id: conv._id,
      sender_id: "11111111-1111-1111-1111-111111111111",
      type: "TEXT",
      content: "Hello from seed user 1",
      is_deleted: false,
      is_recalled: false,
      created_at: new Date(),
      updated_at: new Date(),
    });

    chatDb.messages.insertOne({
      conversation_id: conv._id,
      sender_id: "11111111-1111-1111-1111-222222222222",
      type: "TEXT",
      content: "Hi, this is seed user 2",
      is_deleted: false,
      is_recalled: false,
      created_at: new Date(),
      updated_at: new Date(),
    });
  }
}

if (aiDb.ai_conversations.countDocuments() === 0) {
  aiDb.ai_conversations.insertOne({
    user_id: "seed-user-1",
    messages: [
      { role: "user", content: "Xin chao", timestamp: new Date() },
      {
        role: "assistant",
        content: "Chao ban, minh la Zola AI.",
        timestamp: new Date(),
      },
    ],
    token_count: 12,
    updated_at: new Date(),
    created_at: new Date(),
  });
}

print("Mongo bootstrap completed.");
