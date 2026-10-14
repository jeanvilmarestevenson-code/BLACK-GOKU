const handler = async (m, { conn }) => {
  if (!m.quoted) return m.reply('Réponds à une vue unique avec ₩vn')
  let q = m.quoted
  let msg = q.message
  if (!msg) return m.reply('Message introuvable')

  // Détecte vue unique
  let viewOnce = msg.viewOnceMessageV2 || msg.viewOnceMessage
  if (!viewOnce) return m.reply('Ce n\'est pas une vue unique!')

  let inner = viewOnce.message
  let type = Object.keys(inner)[0]
  let media = inner[type]
  let caption = media.caption || 'Vue unique? Pas avec moi 😎'

  let buff = await q.download()

  if (type === 'imageMessage') {
    await conn.sendMessage(m.chat, { image: buff, caption: caption }, { quoted: m })
  } else if (type === 'videoMessage') {
    await conn.sendMessage(m.chat, { video: buff, caption: caption }, { quoted: m })
  } else if (type === 'audioMessage') {
    await conn.sendMessage(m.chat, { audio: buff, ptt: media.ptt || false }, { quoted: m })
  } else {
    await conn.sendMessage(m.chat, { [type.replace('Message','')]: buff, caption: caption }, { quoted: m })
  }
}
handler.command = ['vv','vn','rvo','vu']
handler.help = ['vv']
module.exports = handler
