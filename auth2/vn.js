const { downloadMediaMessage } = require('@whiskeysockets/baileys');

module.exports = {
  name: "vn",
  alias: ["Vn","VN","vv","rvo","antivv"],
  category: "tools",
  desc: "Convertit Vue Unique en Vue Normale",

  async execute(m, { conn }) {
    if(!m.quoted) {
      return m.reply(`📸 *₩vn - VUE NORMALE*\n\nRéponds à une photo/vidéo en Vue Unique avec ₩vn`);
    }

    try {
      let q = m.quoted;
      let media = await downloadMediaMessage(q, 'buffer', {}, { 
        logger: { level: 'silent' },
        reuploadRequest: conn.updateMediaMessage 
      });
      
      if(!media) return m.reply("❌ Impossible de récupérer");

      // TES MESSAGES + LES MIENS
      const captions = [
        `🔓 *VUE UNIQUE? PAS AVEC MOI.*\n\n👑 BLACK-GOKU a parlé.\nRien ne s'efface ici.`,

        `👀 *Vue unique pas avec moi*\n\nLes gens croient que ça s'efface, moi je garde tout. ₩vn`,

        `💀 *Tu pensais que j'allais pas voir?*\n\nBLACK-GOKU récupère tout. Même ce que tu caches.`,

        `⚡️ *ANTI-VUE UNIQUE ACTIVÉ*\n\nChez moi y'a pas de secret. ₩vn = Vue Normale.`
      ];

      // Choisi un message au hasard parmi les 4
      let captionChoisi = captions[Math.floor(Math.random() * captions.length)];

      let isVideo = q.mtype?.includes('video') || q.message?.videoMessage || q.message?.viewOnceMessageV2?.message?.videoMessage;

      if(isVideo){
        await conn.sendMessage(m.chat, { video: media, caption: captionChoisi, mentions: [m.sender] }, { quoted: m });
      } else {
        try {
          await conn.sendMessage(m.chat, { image: media, caption: captionChoisi, mentions: [m.sender] }, { quoted: m });
        } catch {
          await conn.sendMessage(m.chat, { video: media, caption: captionChoisi, mentions: [m.sender] }, { quoted: m });
        }
      }

    } catch(e){
      console.log(e);
      m.reply("❌ Erreur: Réponds bien à une vue unique avec ₩vn");
    }
  }
}
