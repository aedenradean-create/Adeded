```js
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
let reconnectTimer = null;

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

// =========================
// STATE
// =========================

const welcomedUsers = new Set();

let sleepMode = false;

// =========================
// VOICE
// =========================

function scheduleReconnect(delay = 5000) {
  if (reconnectTimer) {
    return;
  }

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;

    console.log("🔄 Mencoba reconnect VC...");

    connectToVC();
  }, delay);
}

async function connectToVC() {
  if (reconnecting) {
    return;
  }

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

    // Kalau masih punya koneksi aktif, jangan bikin koneksi baru.
    if (connection) {
      const currentState = connection.state.status;

      if (
        currentState === VoiceConnectionStatus.Ready ||
        currentState === VoiceConnectionStatus.Connecting
      ) {
        console.log(
          "ℹ️ Koneksi VC masih aktif."
        );

        reconnecting = false;
        return;
      }

      try {
        connection.destroy();
      } catch {}
      
      connection = null;
    }

    connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false
    });

    connection.on(
      VoiceConnectionStatus.Disconnected,
      async () => {
        console.log(
          "⚠️ Bot terputus dari VC."
        );

        reconnecting = false;

        // Beri waktu sebentar supaya Discord/network stabil.
        scheduleReconnect(5000);
      }
    );

    connection.on(
      VoiceConnectionStatus.Destroyed,
      () => {
        console.log(
          "⚠️ Voice connection destroyed."
        );

        reconnecting = false;

        connection = null;

        // Destroyed bisa terjadi karena koneksi memang sudah mati.
        // Jangan langsung spam reconnect.
        scheduleReconnect(5000);
      }
    );

    await entersState(
      connection,
      VoiceConnectionStatus.Ready,
      60000
    );

    console.log(
      "✅ Bot berhasil masuk VC."
    );

    reconnecting = false;

  } catch (err) {
    console.error(
      "❌ Gagal masuk VC:",
      err.message
    );

    reconnecting = false;

    connection = null;

    scheduleReconnect(10000);
  }
}

// =========================
// GEMINI
// =========================

const MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash-lite"
];

// Cooldown setiap model.
const modelBusyUntil = {};

// Jumlah kegagalan berturut-turut.
// Dipakai supaya cooldown bisa meningkat kalau server Gemini
// sedang benar-benar overload.
const modelFailures = {};

// Batas cooldown maksimum 5 menit.
const MAX_MODEL_COOLDOWN = 5 * 60 * 1000;

function sleep(ms) {
  return new Promise(resolve =>
    setTimeout(resolve, ms)
  );
}

function getCooldown(modelName) {
  const failures =
    modelFailures[modelName] || 1;

  // 20s → 40s → 80s → 160s → 300s
  const cooldown =
    Math.min(
      20000 * Math.pow(2, failures - 1),
      MAX_MODEL_COOLDOWN
    );

  return cooldown;
}

function setModelCooldown(modelName) {
  const cooldown = getCooldown(modelName);

  modelBusyUntil[modelName] =
    Date.now() + cooldown;

  modelFailures[modelName] =
    (modelFailures[modelName] || 0) + 1;

  console.log(
    `⏳ ${modelName} cooldown ${Math.ceil(cooldown / 1000)} detik`
  );
}

function resetModel(modelName) {
  modelBusyUntil[modelName] = 0;
  modelFailures[modelName] = 0;
}

function getStatus(err) {
  return (
    err?.status ||
    err?.response?.status ||
    err?.cause?.status ||
    null
  );
}

async function askGemini(prompt, isDerrA) {
  const personality = isDerrA
    ? DERRA_PERSONALITY
    : PERSONALITY;

  let lastError = null;
  let attemptedModel = false;

  for (const modelName of MODELS) {

    const busyUntil =
      modelBusyUntil[modelName] || 0;

    if (Date.now() < busyUntil) {
      console.log(
        `⏭️ ${modelName} masih cooldown`
      );

      continue;
    }

    attemptedModel = true;

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

      // Berhasil = reset failure counter model.
      resetModel(modelName);

      console.log(
        `✅ AI berhasil menggunakan ${modelName}`
      );

      return answer;

    } catch (err) {

      lastError = err;

      const status = getStatus(err);

      console.error(
        `⚠️ ${modelName} gagal: ${err.message}`
      );

      // =========================
      // 503 SERVER OVERLOAD
      // =========================

      if (status === 503) {

        setModelCooldown(modelName);

        continue;
      }

      // =========================
      // 429 QUOTA / RATE LIMIT
      // =========================

      if (status === 429) {

        console.log(
          `⛔ ${modelName} kena quota/rate limit.`
        );

        // Jangan dicoba terus selama 1 jam.
        modelBusyUntil[modelName] =
          Date.now() + 3600000;

        modelFailures[modelName] = 0;

        continue;
      }

      // =========================
      // 404 MODEL TIDAK ADA
      // =========================

      if (status === 404) {

        console.log(
          `⏭️ ${modelName} tidak tersedia.`
        );

        modelBusyUntil[modelName] =
          Date.now() + 3600000;

        modelFailures[modelName] = 0;

        continue;
      }

      // =========================
      // ERROR LAIN
      // =========================

      // Untuk error selain 503/429/404,
      // jangan retry berkali-kali.
      break;
    }
  }

  // Semua model sedang cooldown.
  if (!attemptedModel) {
    const now = Date.now();

    const availableAt =
      Math.min(
        ...MODELS.map(
          model =>
            modelBusyUntil[model] || now
        )
      );

    const waitSeconds =
      Math.max(
        1,
        Math.ceil(
          (availableAt - now) / 1000
        )
      );

    const error =
      new Error(
        `Semua model AI sedang cooldown. Coba lagi dalam ${waitSeconds} detik.`
      );

    error.code = "ALL_MODELS_COOLDOWN";

    throw error;
  }

  throw lastError || new Error(
    "Semua model AI gagal."
  );
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

      // =========================
      // CEK USER
      // =========================

      const userName =
        message.member?.displayName ||
        message.author.globalName ||
        message.author.username;

      const isDerrA =
        userName.toLowerCase() === "derra";

      const isMentioned =
        message.mentions.has(client.user);

      // =========================
      // HARUS TAG CELS
      // =========================

      if (!isMentioned) {
        return;
      }

      // =========================
      // AMBIL PROMPT
      // =========================

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

      // =========================
      // MODE TIDUR
      // =========================

      if (sleepMode) {

        if (!isDerrA) {
          console.log(
            `💤 Mengabaikan tag dari ${userName}`
          );

          return;
        }

        sleepMode = false;

        await message.reply(
          "udah bangun 😭"
        );

        return;
      }

      // =========================
      // USER BARU
      // =========================

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
      // PERINTAH TIDUR
      // =========================

      if (
        isDerrA &&
        /\btidur\b/i.test(prompt)
      ) {

        sleepMode = true;

        await message.reply(
          "iyaa... Cels tidur dulu 🥀"
        );

        console.log(
          "💤 Cels masuk mode tidur. Hanya DerrA yang bisa membangunkan."
        );

        return;
      }

      // =========================
      // PROMPT AI
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

      // =========================
      // KIRIM JAWABAN
      // =========================

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

      // Kalau semua model sedang cooldown,
      // jangan tampilkan error teknis ke user.
      if (err.code === "ALL_MODELS_COOLDOWN") {

        await message.reply(
          "AI lagi rame banget 😭 coba lagi bentar."
        ).catch(() => {});

        return;
      }

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
```
