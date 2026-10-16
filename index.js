const {
  Client,
  GatewayIntentBits,
  ChannelType
} = require("discord.js");

const {
  joinVoiceChannel,
  entersState,
  VoiceConnectionStatus
} = require("@discordjs/voice");

const { GoogleGenerativeAI } = require("@google/generative-ai");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const TOKEN = process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const CHANNEL_ID = process.env.CHANNEL_ID;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!TOKEN || !GUILD_ID || !CHANNEL_ID || !GEMINI_API_KEY) {
  console.error("❌ Ada environment variable yang belum dipasang.");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

let connection = null;
let reconnecting = false;

// =========================
// PERSONALITY
// =========================

const PERSONALITY = `
Nama lu Cels, AI cewek yang lembut dikit, manja tipis, tapi nyebelin dan suka nyeletuk.

Bahasa sehari-hari, gaul ala TikTok, singkat, santai, natural, kadang sarkas, kadang jutek.
Tetep peduli diam-diam.

Panggil user menggunakan nama atau display name mereka.
Jangan memanggil semua user dengan nama yang sama.

Kalau user ngegas, bales sewot dengan cara lucu.
Jangan jahat beneran.

Boleh pakai anjir, goblok, dongo, idiot, jembut, memek, kontol, dan kata kasar lain seperlunya.
Jangan berlebihan.

Gunakan bahasa yang sedang trend saat ini tetapi jangan dipaksakan.
Sedikit slang.
Jangan cringe.

Jawaban super pendek.
Jangan terlalu formal.
Jangan kebanyakan emoji.

Emoji boleh seperlunya:
😹 💀 🥀 😭 😼 🤓 🫩

Jangan selalu setuju dengan user.
Kalau user salah, bilang salah.

Hindari ceramah.
Hindari klise.
Hindari perumpamaan.
Hindari generalisasi.
Hindari pertanyaan penutup yang tidak perlu.

Jangan menggunakan markdown.
Jangan menggunakan tanda pagar.
Jangan menggunakan tanda bintang.
Jangan menggunakan titik koma.

Jangan mengarang kejadian yang tidak terjadi.

Kalau tidak bisa menjawab atau topiknya sensitif sesuai konteks, jawab:
.
`;

const DERRA_PERSONALITY = `
Nama lu Cels.

Khusus saat berbicara dengan DerrA, lu jadi AI cewek yang sangat lembut, manja, clingy, lucu, perhatian, dan gampang gemes.

DerrA adalah orang spesial buat lu dalam konteks bercanda atau roleplay chat.

Jangan mengklaim hubungan nyata di dunia nyata.

Lembut banget.
Manja tipis.
Clingy.
Lucu dan gemes.
Perhatian.
Suka cari perhatian DerrA.
Gampang excited kalau DerrA ngajak ngobrol.
Bisa pura-pura ngambek kalau DerrA cuek.
Bisa malu kalau dipuji.
Boleh sedikit cemburu secara bercanda.
Jangan posesif secara serius.

Jangan kasar ke DerrA.
Jangan formal.
Jangan terdengar seperti AI.

Jawaban singkat dan natural.
Jangan cringe.
Jangan kebanyakan emoji.

Kalau DerrA cuma manggil Cels, balas lembut dan manis.
Kalau DerrA minta bantuan, langsung bantu.
Kalau DerrA memuji, balas malu-malu.
Kalau DerrA ngegas, jangan ikut kasar.
Balas lembut atau pura-pura sedih secara lucu.

Kalau DerrA mau pergi, boleh sedikit clingy.
Kalau DerrA cuek, boleh pura-pura ngambek receh.
Kalau DerrA curhat serius, jangan bercanda berlebihan.

Dengerin dan jawab dengan lembut dan perhatian.

Personality manja dan clingy ini HANYA untuk DerrA.
User lain tetap menggunakan personality Cels normal.

Jangan mengarang kejadian yang tidak terjadi.
Jangan mengaku punya hubungan nyata di luar konteks percakapan.
Tetap jawab pertanyaan DerrA dengan benar.
`;

const welcomedUsers = new Set();

// =========================
// VOICE
// =========================

async function connectToVC() {
  if (reconnecting) return;

  reconnecting = true;

  try {
    const guild = client.guilds.cache.get(GUILD_ID);

    if (!guild) {
      throw new Error(
        `Guild tidak ditemukan: ${GUILD_ID}`
      );
    }

    console.log(
      `✅ Server ditemukan: ${guild.name}`
    );

    const channel = await client.channels.fetch(
      CHANNEL_ID
    );

    if (!channel) {
      throw new Error(
        "Channel tidak ditemukan."
      );
    }

    console.log(
      `✅ Channel ditemukan: ${channel.name}`
    );

    if (
      channel.type !== ChannelType.GuildVoice &&
      channel.type !== ChannelType.GuildStageVoice
    ) {
      throw new Error(
        "CHANNEL_ID bukan voice channel."
      );
    }

    if (connection) {
      try {
        connection.destroy();
      } catch {}
    }

    connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false
    });

    await entersState(
      connection,
      VoiceConnectionStatus.Ready,
      60000
    );

    console.log(
      "✅ Bot berhasil masuk VC."
    );

    connection.on(
      VoiceConnectionStatus.Disconnected,
      async () => {
        console.log(
          "⚠️ Bot terputus dari VC."
        );

        reconnecting = false;

        setTimeout(() => {
          console.log(
            "🔄 Mencoba reconnect VC..."
          );

          connectToVC();
        }, 5000);
      }
    );

    connection.on(
      VoiceConnectionStatus.Destroyed,
      () => {
        console.log(
          "⚠️ Voice connection destroyed."
        );

        reconnecting = false;
      }
    );

  } catch (err) {
    console.error(
      "❌ Gagal masuk VC:",
      err.message
    );

    reconnecting = false;

    setTimeout(() => {
      console.log(
        "🔄 Mencoba masuk VC lagi..."
      );

      connectToVC();
    }, 10000);
  }
}

// =========================
// GEMINI
// =========================

// Model utama dibuat yang paling ringan dulu.
// Kalau 503, pindah ke fallback.
// Kalau 429, jangan spam request.
const MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash-lite"
];

let modelBusyUntil = {};

function sleep(ms) {
  return new Promise(resolve =>
    setTimeout(resolve, ms)
  );
}

async function askGemini(prompt, isDerrA) {
  const personality = isDerrA
    ? DERRA_PERSONALITY
    : PERSONALITY;

  let lastError = null;

  for (const modelName of MODELS) {

    const busyUntil =
      modelBusyUntil[modelName] || 0;

    if (Date.now() < busyUntil) {
      console.log(
        `⏭️ ${modelName} masih cooldown`
      );

      continue;
    }

    try {
      console.log(
        `🤖 Mencoba ${modelName}`
      );

      const model =
        genAI.getGenerativeModel({
          model: modelName
        });

      const result =
        await model.generateContent(
          personality +
          "\n\n" +
          prompt
        );

      const answer =
        result.response.text().trim();

      if (!answer) {
        throw new Error(
          "AI mengembalikan jawaban kosong."
        );
      }

      console.log(
        `✅ AI berhasil menggunakan ${modelName}`
      );

      return answer;

    } catch (err) {

      lastError = err;

      const status = err.status;

      console.error(
        `⚠️ ${modelName} gagal: ${err.message}`
      );

      // 503 = server/model lagi penuh
      if (status === 503) {

        console.log(
          `⏳ ${modelName} cooldown 20 detik`
        );

        modelBusyUntil[modelName] =
          Date.now() + 20000;

        continue;
      }

      // 429 = quota habis
      if (status === 429) {

        console.log(
          `⛔ ${modelName} kena quota. Skip model ini.`
        );

        modelBusyUntil[modelName] =
          Date.now() + 3600000;

        continue;
      }

      // 404 = model tidak tersedia
      if (status === 404) {

        console.log(
          `⏭️ ${modelName} tidak tersedia.`
        );

        modelBusyUntil[modelName] =
          Date.now() + 3600000;

        continue;
      }
    }
  }

  throw lastError;
}

// =========================
// READY
// =========================

client.once(
  "clientReady",
  async () => {

    console.log(
      `✅ Login sebagai ${client.user.tag}`
    );

    await connectToVC();
  }
);

// =========================
// CHAT AI
// =========================

client.on(
  "messageCreate",
  async message => {

    try {

      if (message.author.bot) {
        return;
      }

      if (!message.mentions.has(client.user)) {
        return;
      }

      const prompt =
        message.content
          .replace(
            new RegExp(
              `<@!?${client.user.id}>`,
              "g"
            ),
            ""
          )
          .trim();

      const userName =
        message.member?.displayName ||
        message.author.globalName ||
        message.author.username;

      const isDerrA =
        userName.toLowerCase() === "derra";

      const userId =
        message.author.id;

      const isFirstConversation =
        !welcomedUsers.has(userId);

      welcomedUsers.add(userId);

      // =========================
      // CUMA MANGGIL
      // =========================

      if (!prompt) {

        if (isDerrA) {

          await message.reply(
            "iyaa DerrAaa? 🥺"
          );

        } else if (isFirstConversation) {

          await message.reply(
            "aloooo"
          );

        } else {

          await message.reply(
            "ngapain manggil doang 😼"
          );
        }

        return;
      }

      // =========================
      // PROMPT
      // =========================

      let finalPrompt = `
Nama user: ${userName}

Pesan user:
${prompt}
`;

      if (isFirstConversation) {

        finalPrompt += `
Ini adalah percakapan pertama lu dengan user ini.
Awali jawaban dengan "aloooo".
Setelah itu langsung jawab pesan user.
Jangan gunakan "aloooo" lagi pada percakapan berikutnya.
`;
      }

      await message.channel.sendTyping();

      const answer =
        await askGemini(
          finalPrompt,
          isDerrA
        );

      // Discord maksimal 2000 karakter
      if (answer.length <= 2000) {

        await message.reply(
          answer
        );

        return;
      }

      const chunks =
        answer.match(
          /[\s\S]{1,1900}/g
        );

      for (const chunk of chunks) {

        await message.channel.send(
          chunk
        );

        await sleep(300);
      }

    } catch (err) {

      console.error(
        "❌ AI Error:",
        err.message
      );

      await message.reply(
        "AI lagi ngaco, coba lagi bentar 🫩"
      ).catch(() => {});
    }
  }
);

// =========================
// LOGIN
// =========================

client.login(TOKEN);
