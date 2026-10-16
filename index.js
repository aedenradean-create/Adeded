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

const OpenAI = require("openai");

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
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

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

// AI CHAT
client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;

    // Hanya merespons jika bot di-mention
    if (!message.mentions.has(client.user)) return;

    if (!OPENAI_API_KEY) {
      await message.reply(
        "❌ OPENAI_API_KEY belum dipasang di Railway."
      );
      return;
    }

    // Hilangkan mention bot dari pesan
    const prompt = message.content
      .replace(new RegExp(`<@!?${client.user.id}>`, "g"), "")
      .trim();

    if (!prompt) {
      await message.reply(
        "Mau nanya apa? 😭"
      );
      return;
    }

    await message.channel.sendTyping();

    const response = await openai.responses.create({
      model: "gpt-5-mini",
      instructions:
        "Kamu adalah Aria, bot Discord yang ramah, santai, dan bisa ngobrol dalam bahasa Indonesia. Jawab dengan singkat dan natural seperti teman Discord.",
      input: prompt,
    });

    const answer =
      response.output_text?.trim() ||
      "Gw lagi nggak bisa mikir 😭";

    await message.reply(answer);

  } catch (err) {
    console.error("❌ AI Error:", err);

    await message.reply(
      "❌ Ada error waktu gw proses pesan lu."
    ).catch(() => {});
  }
});

client.login(TOKEN);
