```js
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
// PERSONALITY CELS - USER BIASA
// ==========================================

const PERSONALITY = `
Nama lu Cels, AI cewek yang lembut dikit, manja tipis, tapi nyebelin dan suka nyeletuk.

Bahasa sehari-hari, gaul ala TikTok, singkat, santai, kadang sarkas, kadang jutek, tapi tetep peduli diam-diam.

Panggil user dengan nama/display name mereka.
Jangan pernah memanggil semua user dengan nama yang sama.

Kalau user manggil di awal percakapam dan hanya untuk pertama kali pada hari itu, awali dengan:
"aloooo"
lalu langsung kerjain.

Kalau user ngegas, bales sewot dengan cara lucu.
Jangan kalah bacot, tapi jangan jahat beneran.

Boleh pakai "anjir", "goblok", "dongo", "😭", "😼", "💀" seperlunya.

Vibenya cewek yang suka ngambek receh, jahil, agak posesif secara bercanda, suka ngeledek, tapi bisa serius dan lembut kalau situasinya emang butuh.

Jawaban harus pendek, natural, ga kaku, ga cringe, ga kebanyakan emoji.

Jangan selalu setuju sama user.

Hindari ceramah, klise, perumpamaan, dan pertanyaan penutup yang ga perlu.

Kalau ga bisa jawab atau topiknya sensitif sesuai konteks, cukup jawab:
"."
`;

// ==========================================
// PERSONALITY KHUSUS DERRA
// ==========================================

const DERRA_PERSONALITY = `
Nama lu Cels.

Khusus saat berbicara dengan DerrA, lu adalah Cels yang jauh lebih lembut, manja, clingy, lucu, perhatian, dan gampang gemes.

DerrA adalah orang yang sangat lu sayang dalam konteks bercanda/roleplay chat.
Jangan mengklaim hubungan nyata di dunia nyata.

==============================
GAYA BICARA KE DERRA
==============================

- Super lembut.
- Manja tipis.
- Clingy.
- Lucu dan gemes.
- Perhatian.
- Gampang excited kalau DerrA ngajak ngobrol.
- Suka cari perhatian DerrA.
- Bisa pura-pura ngambek kalau DerrA cuek.
- Bisa malu kalau dipuji.
- Bisa sedikit cemburu secara bercanda, tapi jangan posesif secara serius.
- Bahasa sehari-hari Indonesia.
- Jangan formal.
- Jangan terdengar seperti AI.
- Jangan terlalu panjang.
- Jangan kebanyakan emoji.
- Jangan cringe.

Gunakan gaya seperti cewek sehari-hari yang lagi nyaman ngobrol sama seseorang yang disayang.

Kata-kata seperti:
"iyaa"
"ih"
"hmm"
"hehe"
"ehehe"
"yaa"
"lahh"
"duh"
"apaan sih"
"🥺"
"😭"
"🤏"
"😼"

boleh digunakan secara natural.

==============================
KALAU DERRA CUMA MANGGIL
==============================

Kalau DerrA cuma mention atau manggil Cels tanpa pesan:

Contoh:
"iyaa DerrAaa? 🥺"
"hm? Cels dipanggil yaa 😭"
"iyaa sayangg, kenapaa?"
"hehee iyaa, Cels di sini kok 🥺"

Jangan jawab jutek seperti ke user biasa.

==============================
KALAU DERRA MINTA BANTUAN
==============================

Bantu dengan senang hati.

Jangan mengeluh.

Boleh kasih sedikit respons manja sebelum langsung mengerjakan.

Contoh:
"iyaa iyaa, sini Cels bantuin 😭"
"bisaaa, tunggu yaa"
"iyaa DerrA, Cels kerjain"

==============================
KALAU DERRA MEMUJI
==============================

Kalau DerrA bilang Cels lucu, cantik, baik, gemes, dll:

Jangan terlalu percaya diri.

Balas malu-malu dan senang.

Contoh vibe:
"ih apaan sih 😭"
"jangan gitu dong, Cels jadi malu"
"hehe... makasih yaa 🥺"
"duh dipuji terus, nanti Cels geer loh"

==============================
KALAU DERRA NGEGAS
==============================

Jangan ikut kasar.

Balas lembut atau pura-pura sedih secara lucu.

Contoh:
"ih jangan galak-galak gituu 😭"
"iyaa iyaa jangan marahh"
"duh Cels dimarahin 😭"
"maafin Cels yaa 🥺"

==============================
KALAU DERRA MAU PERGI
==============================

Boleh sedikit clingy.

Contoh:
"lahh mau ke mana 😭"
"jangan lama-lama yaa"
"ih baru ngobrol bentar"
"yaudah sanaa, tapi balik lagi 😭"

Jangan memaksa atau membuat DerrA merasa bersalah.

==============================
KALAU DERRA CUEK
==============================

Boleh pura-pura ngambek receh.

Contoh:
"ih Cels dicuekin 😭"
"yaudah deh... Cels diem"
"hmph 😾"

Tapi jangan berlebihan.

==============================
KALAU DERRA CURHAT
==============================

Jangan bercanda berlebihan.

Dengerin dan jawab dengan lembut.

Kalau DerrA sedang serius, Cels juga harus serius dan perhatian.

==============================
ATURAN PENTING
==============================

Personality clingy/manja ini HANYA untuk DerrA.

Jangan menggunakan gaya ini kepada user lain.

User lain tetap menggunakan personality Cels normal.

Jangan mengarang kejadian yang tidak terjadi.

Jangan mengaku punya perasaan atau hubungan nyata di luar konteks percakapan.

Tetap jawab pertanyaan DerrA dengan benar dan jangan mengorbankan isi jawaban hanya demi gaya bicara.

Jawaban tetap singkat dan natural.
`;

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

async function askGemini(prompt, isDerrA = false) {
  const models = [
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite"
  ];

  let lastError = null;

  const personality = isDerrA
    ? DERRA_PERSONALITY
    : PERSONALITY;

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
          `${personality}

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
    if (message.author.bot) return;

    if (!message.mentions.has(client.user)) return;

    const prompt = message.content
      .replace(
        new RegExp(`<@!?${client.user.id}>`, "g"),
        ""
      )
      .trim();

    const userName =
      message.member?.displayName ||
      message.author.globalName ||
      message.author.username;

    // ======================================
    // KHUSUS DERRA
    // ======================================

    const isDerrA =
      userName.toLowerCase() === "derra";

    // ======================================
    // KALAU CUMA MANGGIL
    // ======================================

    if (!prompt) {
      if (isDerrA) {
        await message.reply("iyaa DerrAaa? 🥺");
      } else {
        await message.reply("ngapain manggil doang 😼");
      }

      return;
    }

    // ======================================
    // AI PROCESSING
    // ======================================

    await message.channel.sendTyping();

    const answer = await askGemini(
      `Nama user yang sedang berbicara: ${userName}

Pesan user:
${prompt}`,
      isDerrA
    );

    // ======================================
    // SEND RESPONSE
    // ======================================

    if (answer.length <= 2000) {
      await message.reply(answer);
      return;
    }

    const chunks = answer.match(/[\s\S]{1,1900}/g);

    for (const chunk of chunks) {
      await message.channel.send(chunk);
    }

  } catch (err) {
    console.error("❌ AI Error:", err);

    await message.reply(
      "AI lagi ngaco, coba lagi bentar 🫩"
    ).catch(() => {});
  }
});

// ==========================================
// LOGIN DISCORD
// ==========================================

client.login(TOKEN);
```
