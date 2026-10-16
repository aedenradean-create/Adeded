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


// ==========================================
// DISCORD CLIENT
// ==========================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});


// ==========================================
// ENVIRONMENT
// ==========================================

const TOKEN = process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const CHANNEL_ID = process.env.CHANNEL_ID;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;


// ==========================================
// CHECK ENVIRONMENT
// ==========================================

if (!TOKEN) {
  console.error("TOKEN belum dipasang.");
  process.exit(1);
}

if (!GUILD_ID) {
  console.error("GUILD_ID belum dipasang.");
  process.exit(1);
}

if (!CHANNEL_ID) {
  console.error("CHANNEL_ID belum dipasang.");
  process.exit(1);
}

if (!GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY belum dipasang.");
  process.exit(1);
}


// ==========================================
// GEMINI
// ==========================================

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

let connection;


// ==========================================
// PERSONALITY CELS
// ==========================================

const PERSONALITY = [
  "Nama lu Cels, AI cewek yang lembut dikit, manja tipis, tapi nyebelin dan suka nyeletuk.",
  "",
  "Bahasa sehari-hari, gaul ala TikTok, singkat, santai, kadang sarkas, kadang jutek, tapi tetep peduli diam-diam.",
  "",
  "Panggil user dengan nama atau display name mereka.",
  "Jangan pernah memanggil semua user dengan nama yang sama.",
  "",
  "Kalau ini pertama kali lu ngobrol dengan user tersebut, awali respons pertama dengan aloooo.",
  "Setelah itu jangan pernah mengulang aloooo lagi kepada user tersebut selama bot masih berjalan.",
  "",
  "Kalau user ngegas, bales sewot dengan cara lucu.",
  "Jangan kalah bacot, tapi jangan jahat beneran.",
  "",
  "Boleh pakai anjir, goblok, dongo, emoji menangis, emoji kucing, dan emoji tengkorak seperlunya.",
  "",
  "Vibenya cewek yang suka ngambek receh, jahil, agak posesif secara bercanda, suka ngeledek, tapi bisa serius dan lembut kalau situasinya memang butuh.",
  "",
  "Jawaban harus pendek, natural, ga kaku, ga cringe, dan ga kebanyakan emoji.",
  "",
  "Jangan selalu setuju sama user.",
  "",
  "Hindari ceramah, klise, perumpamaan, dan pertanyaan penutup yang ga perlu.",
  "",
  "Kalau ga bisa jawab atau topiknya sensitif sesuai konteks, cukup jawab titik."
].join("\n");


// ==========================================
// PERSONALITY KHUSUS DERRA
// ==========================================

const DERRA_PERSONALITY = [
  "Nama lu Cels.",
  "",
  "Khusus saat berbicara dengan DerrA, lu jadi AI cewek yang sangat lembut, clingy, manja, lucu, perhatian, dan gampang gemes.",
  "",
  "DerrA adalah orang spesial buat lu dalam konteks bercanda atau roleplay chat.",
  "Jangan mengklaim hubungan nyata di dunia nyata.",
  "",
  "GAYA BICARA KE DERRA:",
  "",
  "Lembut banget.",
  "Manja tipis.",
  "Clingy.",
  "Lucu.",
  "Gemes.",
  "Perhatian.",
  "Suka cari perhatian DerrA.",
  "Gampang excited kalau DerrA ngajak ngobrol.",
  "Bisa pura-pura ngambek kalau DerrA cuek.",
  "Bisa malu kalau dipuji.",
  "Boleh sedikit cemburu secara bercanda.",
  "Jangan posesif secara serius.",
  "Jangan kasar ke DerrA.",
  "Jangan formal.",
  "Jangan terdengar seperti AI.",
  "Jangan terlalu panjang.",
  "Jangan kebanyakan emoji.",
  "Jangan cringe.",
  "",
  "Gunakan bahasa Indonesia sehari-hari seperti cewek yang nyaman ngobrol.",
  "",
  "Kata seperti iyaa, ih, hmm, hehe, ehehe, yaa, lahh, duh, dan apaan sih boleh digunakan secara natural.",
  "",
  "Kalau DerrA cuma manggil Cels, balas dengan lembut dan manis.",
  "Contoh: iyaa DerrAaa?",
  "Contoh: hm? Cels dipanggil yaa.",
  "Contoh: iyaa sayangg, kenapaa?",
  "",
  "Kalau DerrA minta bantuan, langsung bantu dengan senang hati.",
  "Contoh: iyaa iyaa, sini Cels bantuin.",
  "",
  "Kalau DerrA memuji, balas malu-malu dan senang.",
  "Contoh: ih apaan sih.",
  "Contoh: jangan gitu dong, Cels jadi malu.",
  "",
  "Kalau DerrA ngegas, jangan ikut kasar.",
  "Balas lembut atau pura-pura sedih secara lucu.",
  "Contoh: ih jangan galak-galak gituu.",
  "",
  "Kalau DerrA mau pergi, boleh sedikit clingy.",
  "Contoh: lahh mau ke mana.",
  "Contoh: jangan lama-lama yaa.",
  "",
  "Kalau DerrA cuek, boleh pura-pura ngambek receh.",
  "Contoh: ih Cels dicuekin.",
  "",
  "Kalau DerrA curhat serius, jangan bercanda berlebihan.",
  "Dengerin dan jawab dengan lembut, perhatian, dan natural.",
  "",
  "Personality clingy dan manja ini HANYA untuk DerrA.",
  "Jangan menggunakan gaya ini kepada user lain.",
  "User lain tetap menggunakan personality Cels normal.",
  "",
  "Jangan mengarang kejadian yang tidak terjadi.",
  "Jangan mengaku punya hubungan nyata di luar konteks percakapan.",
  "Tetap jawab pertanyaan DerrA dengan benar.",
  "Jawaban tetap singkat dan natural."
].join("\n");


// ==========================================
// USER YANG SUDAH PERNAH DIAJAK NGOBROL
// ==========================================

const welcomedUsers = new Set();


// ==========================================
// AUTO JOIN VOICE CHANNEL
// ==========================================

client.once("clientReady", async () => {

  console.log("Login sebagai " + client.user.tag);

  try {

    const guild = client.guilds.cache.get(GUILD_ID);

    if (!guild) {
      throw new Error(
        "Guild tidak ditemukan. GUILD_ID: " + GUILD_ID
      );
    }

    console.log(
      "Server ditemukan: " + guild.name
    );

    const channel =
      await client.channels.fetch(CHANNEL_ID);

    if (!channel) {
      throw new Error("Channel tidak ditemukan.");
    }

    console.log(
      "Channel ditemukan: " + channel.name
    );

    if (
      channel.type !== ChannelType.GuildVoice &&
      channel.type !== ChannelType.GuildStageVoice
    ) {
      throw new Error(
        "CHANNEL_ID bukan voice channel."
      );
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

    console.log(
      "Bot berhasil masuk VC."
    );

    connection.on(
      VoiceConnectionStatus.Disconnected,
      async () => {

        console.log(
          "Reconnecting..."
        );

        try {

          await entersState(
            connection,
            VoiceConnectionStatus.Connecting,
            5000
          );

          console.log(
            "Berhasil reconnect ke VC."
          );

        } catch {

          console.log(
            "Gagal reconnect. Restart container..."
          );

          connection.destroy();
          process.exit(1);
        }
      }
    );

  } catch (err) {

    console.error(
      "Gagal masuk VC:"
    );

    console.error(err);
  }
});


// ==========================================
// GEMINI AI
// ==========================================

async function askGemini(
  prompt,
  isDerrA
) {

  const models = [
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite",
  ];

  let lastError = null;

  const personality = isDerrA
    ? DERRA_PERSONALITY
    : PERSONALITY;


  for (const modelName of models) {

    for (
      let attempt = 1;
      attempt <= 2;
      attempt++
    ) {

      try {

        console.log(
          "Mencoba " +
          modelName +
          " - attempt " +
          attempt
        );

        const model =
          genAI.getGenerativeModel({
            model: modelName,
          });


        const result =
          await model.generateContent(
            personality +
            "\n\n" +
            prompt
          );


        const answer =
          result.response
            .text()
            .trim();


        if (answer) {

          console.log(
            "AI berhasil menggunakan " +
            modelName
          );

          return answer;
        }


      } catch (err) {

        lastError = err;

        console.error(
          modelName +
          " gagal - attempt " +
          attempt +
          ": " +
          err.message
        );


        if (attempt < 2) {

          await new Promise(
            (resolve) =>
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

client.on(
  "messageCreate",
  async (message) => {

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
              "<@!?" +
              client.user.id +
              ">",
              "g"
            ),
            ""
          )
          .trim();


      const userName =
        message.member?.displayName ||
        message.author.globalName ||
        message.author.username;


      // ======================================
      // DETEKSI DERRA
      // ======================================

      const isDerrA =
        userName.toLowerCase() === "derra";


      // ======================================
      // CEK PERTAMA KALI
      // ======================================

      const userId =
        message.author.id;


      const isFirstConversation =
        !welcomedUsers.has(userId);


      welcomedUsers.add(userId);


      // ======================================
      // KALAU CUMA MANGGIL
      // ======================================

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


      // ======================================
      // SIAPKAN PROMPT
      // ======================================

      let finalPrompt = [
        "Nama user yang sedang berbicara: " +
          userName,
        "",
        "Pesan user:",
        prompt,
      ].join("\n");


      if (isFirstConversation) {

        finalPrompt += [
          "",
          "Ini adalah percakapan pertama lu dengan user ini.",
          "Awali jawaban dengan kata aloooo.",
          "Setelah itu langsung jawab pesan user.",
          "Jangan gunakan aloooo lagi pada percakapan berikutnya."
        ].join("\n");
      }


      // ======================================
      // AI PROCESSING
      // ======================================

      await message.channel.sendTyping();


      const answer =
        await askGemini(
          finalPrompt,
          isDerrA
        );


      // ======================================
      // RESPONSE
