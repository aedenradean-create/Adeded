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

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

let connection;

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
        } catch {
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

// ================================
// AI CHAT GEMINI
// ================================

client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;

    // Bot hanya menjawab jika di-mention
    if (!message.mentions.has(client.user)) return;

    if (!GEMINI_API_KEY) {
      await message.reply(
        "❌ GEMINI_API_KEY belum dipasang di Railway."
      );
      return;
    }

    const prompt = message.content
      .replace(new RegExp(`<@!?${client.user.id}>`, "g"), "")
      .trim();

    if (!prompt) {
      await message.reply("Mau nanya apa? 😭");
      return;
    }

    await message.channel.sendTyping();

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    const result = await model.generateContent(
      `Kamu adalah Aria, bot Discord yang ramah dan santai.
Jawab dalam bahasa Indonesia kecuali pengguna menggunakan bahasa lain.
Gaya bicaramu natural seperti teman Discord, jangan terlalu formal.

Pesan pengguna:
${prompt}`
    );

    const answer = result.response.text().trim();

    if (!answer) {
      await message.reply("Gw lagi nggak bisa mikir 😭");
      return;
    }

    // Discord maksimal 2000 karakter per pesan
    if (answer.length <= 2000) {
      await message.reply(answer);
    } else {
      const chunks = answer.match(/[\s\S]{1,1900}/g);

      for (const chunk of chunks) {
        await message.channel.send(chunk);
      }
    }
  } catch (err) {
    console.error("❌ AI Error:", err);

    await message.reply(
      "❌ AI-nya lagi error. Cek log Railway."
    ).catch(() => {});
  }
});

client.login(TOKEN);
