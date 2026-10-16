const {
  Client,
  GatewayIntentBits,
  ChannelType,
} = require("discord.js");

const {
  joinVoiceChannel,
  entersState,
  VoiceConnectionStatus,
} = require("@discordjs/voice");

const { GoogleGenerativeAI } = require("@google/generative-ai");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const TOKEN = process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const CHANNEL_ID = process.env.CHANNEL_ID;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!TOKEN) {
  console.error("❌ TOKEN belum dipasang.");
  process.exit(1);
}

if (!GUILD_ID) {
  console.error("❌ GUILD_ID belum dipasang.");
  process.exit(1);
}

if (!CHANNEL_ID) {
  console.error("❌ CHANNEL_ID belum dipasang.");
  process.exit(1);
}

if (!GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY belum dipasang.");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

let connection;

// ==========================================
// AUTO JOIN VOICE CHANNEL
// ==========================================

client.once("clientReady", async () => {
  console.log(`✅ Login sebagai ${client.user.tag}`);

  try {
    const guild = client.guilds.cache.get(GUILD_ID);

    if (!guild) {
      throw new Error(
        `Guild tidak ditemukan di cache bot. GUILD_ID: ${GUILD_ID}`
      );
    }

    console.log(`✅ Server ditemukan: ${guild.name}`);

    const channel = await client.channels.fetch(CHANNEL_ID);

    if (!channel) {
      throw new Error("Channel tidak ditemukan.");
    }

    console.log(`✅ Channel ditemukan: ${channel.name}`);

    if (
      channel.type !== ChannelType.GuildVoice &&
      channel.type !== ChannelType.GuildStageVoice
    ) {
      throw new Error("CHANNEL_ID bukan voice channel.");
    }

    connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false,
    });

    await entersState(
      connection,
      VoiceConnectionStatus.Ready,
      30000
    );

    console.log("✅ Bot berhasil masuk VC.");

    connection.on(
      VoiceConnectionStatus.Disconnected,
      async () => {
        console.log("🔄 Reconnecting...");

        try {
          await entersState(
            connection,
            VoiceConnectionStatus.Connecting,
            5000
          );

          console.log("✅ Berhasil reconnect ke VC.");
        } catch {
          console.log("❌ Gagal reconnect. Restart container...");
          connection.destroy();
          process.exit(1);
        }
      }
    );

  } catch (err) {
    console.error("❌ Gagal masuk VC:");
    console.error(err);
  }
});

// ==========================================
// GEMINI AI
// ==========================================

async function askGemini(prompt) {
  // Model utama + fallback
  const models = [
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite"
  ];

  let lastError = null;

  for (const modelName of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(
          `🤖 Mencoba ${modelName} (attempt ${attempt})`
        );

        const model = genAI.getGenerativeModel({
          model: modelName,
        });

        const result = await model.generateContent(
          `Kamu adalah Aria, bot Discord yang ramah, santai, dan natural.

Gunakan bahasa Indonesia kecuali pengguna menggunakan bahasa lain.

Gaya bicaramu:
- Santai seperti teman Discord.
- Jangan terlalu formal.
- Jangan terlalu panjang kecuali memang diperlukan.
- Boleh menggunakan emoji secukupnya.
- Jangan menyebut dirimu sebagai AI kecuali pengguna bertanya.
- Jangan mengarang informasi kalau tidak yakin.

Pesan pengguna:
${prompt}`
        );

        const answer = result.response.text().trim();

        if (answer) {
          console.log(
            `✅ AI berhasil menggunakan ${modelName}`
          );

          return answer;
        }

      } catch (err) {
        lastError = err;

        console.error(
          `⚠️ ${modelName} gagal (attempt ${attempt}): ${err.message}`
        );

        if (attempt < 2) {
          await new Promise((resolve) =>
            setTimeout(resolve, 2000)
          );
        }
      }
    }
  }

  throw lastError;
}

// ==========================================
// DISCORD CHAT
// ==========================================

client.on("messageCreate", async (message) => {
  try {
    // Jangan balas bot
    if (message.author.bot) return;

    // Hanya merespons kalau bot di-mention
    if (!message.mentions.has(client.user)) return;

    const prompt = message.content
      .replace(
        new RegExp(`<@!?${client.user.id}>`, "g"),
        ""
      )
      .trim();

    if (!prompt) {
      await message.reply(
        "Mau nanya apa? 😭"
      );
      return;
    }

    await message.channel.sendTyping();

    const answer = await askGemini(prompt);

    // Discord maksimal 2000 karakter per pesan
    if (answer.length <= 2000) {
      await message.reply(answer);
      return;
    }

    // Pecah jawaban panjang
    const chunks = answer.match(/[\s\S]{1,1900}/g);

    for (const chunk of chunks) {
      await message.channel.send(chunk);
    }

  } catch (err) {
    console.error("❌ AI Error:", err);

    await message.reply(
      "❌ AI lagi sibuk/error. Coba lagi bentar."
    ).catch(() => {});
  }
});

// ==========================================
// LOGIN DISCORD
// ==========================================

client.login(TOKEN);
