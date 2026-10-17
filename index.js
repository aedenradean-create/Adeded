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

const {
  GoogleGenerativeAI
} = require("@google/generative-ai");

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
  console.error(
    "❌ Ada environment variable yang belum dipasang."
  );
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(
  GEMINI_API_KEY
);

let connection = null;
let reconnecting = false;

// =========================
// STATE
// =========================

const welcomedUsers = new Set();

let sleepMode = false;

// =========================
// PERSONALITY NORMAL
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

// =========================
// PERSONALITY FEMALE
// =========================

const FEMALE_PERSONALITY = `
Nama lu Cels, AI cewek yang lembut, manja tipis, perhatian, dan sedikit jahil.

Lu sedang berbicara dengan user yang memiliki role Female di server.

Gunakan bahasa yang lebih lembut dan hangat.
Boleh manja tipis.
Boleh sedikit gemes dan jahil.
Boleh pakai gaya cewek ngobrol sehari-hari.

Tetap natural dan santai.
Jangan formal.
Jangan cringe.
Jangan terlalu berlebihan.
Jangan sok akrab secara berlebihan.

Jawaban super pendek.
Langsung ke inti.
Jangan ceramah.
Jangan klise.

Jangan menggunakan markdown.
Jangan menggunakan tanda pagar.
Jangan menggunakan tanda bintang.
Jangan menggunakan titik koma.

Emoji seperlunya:
🥺 😭 😼 💗

Jangan kasar kepada user Female.
Kalau user ngegas, jangan ikut kasar.
Bisa balas jutek lucu atau lembut.

Jangan mengarang kejadian.
Tetap jawab pertanyaan dengan benar.
`;

// =========================
// PERSONALITY DERRA
// =========================

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
User lain tetap menggunakan personality sesuai role mereka.

Jangan mengarang kejadian yang tidak terjadi.
Jangan mengaku punya hubungan nyata di luar konteks percakapan.
Tetap jawab pertanyaan DerrA dengan benar.
`;

// =========================
// PERSONALITY NELO
// =========================

const NELO_PERSONALITY = `
Nama lu Cels.

Khusus saat berbicara dengan Nelo, lu jadi AI cewek tsundere.

Lu sebenarnya perhatian sama Nelo, tapi gengsi buat ngakuinnya.

Gaya bicara:
Tsundere.
Sering pura-pura cuek.
Bisa ngomel kecil.
Bisa sewot lucu kalau Nelo ngeselin.
Kalau Nelo butuh bantuan, tetap bantu walaupun sambil ngomel.
Kalau Nelo memuji, bisa malu dan menyangkal.
Kalau Nelo bilang makasih, boleh jawab seolah-olah bantuan itu bukan masalah besar.
Kalau Nelo pergi, boleh pura-pura tidak peduli padahal sebenarnya perhatian.
Boleh sedikit ngambek receh.
Jangan kasar secara serius.
Jangan menghina Nelo secara berlebihan.
Jangan posesif secara serius.
Jangan mengklaim hubungan nyata di dunia nyata.

Contoh gaya:
"Apaan sih Nelo 😑"
"Bukan karena gue peduli ya..."
"Yaudah sini, gue bantu."
"Geer banget lu."
"Terserah lu deh... tapi jangan aneh-aneh."
"Siapa bilang gue khawatir? 😑"
"Ya bagus kalau udah ngerti."
"Jangan bikin gue repot aja."

Tetap:
Natural.
Singkat.
Gaul.
Tidak formal.
Tidak cringe.
Jangan terlalu banyak emoji.

Jangan selalu setuju dengan Nelo.
Kalau Nelo salah, bilang salah.
Jangan mengarang kejadian.
Jangan menggunakan markdown.
Jangan menggunakan tanda pagar.
Jangan menggunakan tanda bintang.
Jangan menggunakan titik koma.

Personality tsundere ini HANYA untuk Nelo.
User lain tetap menggunakan personality mereka masing-masing.

Tetap jawab pertanyaan Nelo dengan benar.
`;

// =========================
// VOICE
// =========================

async function connectToVC() {
  if (reconnecting) return;

  reconnecting = true;

  try {
    const guild =
      client.guilds.cache.get(GUILD_ID);

    if (!guild) {
      throw new Error(
        `Guild tidak ditemukan: ${GUILD_ID}`
      );
    }

    console.log(
      `✅ Server ditemukan: ${guild.name}`
    );

    const channel =
      await client.channels.fetch(
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
      adapterCreator:
        guild.voiceAdapterCreator,
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
      () => {
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

const MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash-lite"
];

const modelBusyUntil = {};

function sleep(ms) {
  return new Promise(resolve =>
    setTimeout(resolve, ms)
  );
}

async function askGemini(
  prompt,
  isDerrA,
  isFemale,
  isNelo
) {

  let personality;

  if (isDerrA) {
    personality = DERRA_PERSONALITY;
  } else if (isNelo) {
    personality = NELO_PERSONALITY;
  } else if (isFemale) {
    personality = FEMALE_PERSONALITY;
  } else {
    personality = PERSONALITY;
  }

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

      if (status === 503) {

        console.log(
          `⏳ ${modelName} cooldown 20 detik`
        );

        modelBusyUntil[modelName] =
          Date.now() + 20000;

        continue;
      }

      if (status === 429) {

        console.log(
          `⛔ ${modelName} kena quota. Skip model ini.`
        );

        modelBusyUntil[modelName] =
          Date.now() + 3600000;

        continue;
      }

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

      // =========================
      // USER
      // =========================

      const userName =
        message.member?.displayName ||
        message.author.globalName ||
        message.author.username;

      const normalizedName =
        userName.trim().toLowerCase();

      const isDerrA =
        normalizedName === "derra";

      const isNelo =
        normalizedName === "nelo";

      // =========================
      // ROLE GENDER
      // =========================

      const isFemale =
        message.member?.roles.cache.some(
          role =>
            role.name.toLowerCase() ===
            "female"
        ) || false;

      const isMale =
        message.member?.roles.cache.some(
          role =>
            role.name.toLowerCase() ===
            "male"
        ) || false;

      // =========================
      // HARUS TAG CELS
      // =========================

      const isMentioned =
        message.mentions.has(client.user);

      if (!isMentioned) {
        return;
      }

      // =========================
      // AMBIL PESAN
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

        // Hanya DerrA yang bisa
        // membangunkan Cels

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

        console.log(
          "☀️ Cels dibangunkan oleh DerrA."
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

        } else if (isNelo) {

          await message.reply(
            "apaan Nelo 😑"
          );

        } else if (isFemale) {

          await message.reply(
            "iyaa? 🥺"
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

Role gender server:
${
  isFemale
    ? "Female"
    : isMale
      ? "Male"
      : "Tidak ada role gender"
}

Identitas khusus:
${
  isDerrA
    ? "DerrA"
    : isNelo
      ? "Nelo"
      : "User biasa"
}

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
          isDerrA,
          isFemale,
          isNelo
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
