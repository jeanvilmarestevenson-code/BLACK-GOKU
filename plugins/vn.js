const handler = async (m, { conn }) => {
  let q = m.quoted? m.quoted : m
  if (!q.message) return m.reply('Réponds à une vue unique avec ₩vn')
  let mime = Object.keys(q.message)[0]
  let data = q.message[mime]
  if (!data.viewOnce) return m.reply('Ce n\'est pas une vue unique!')
  let buff = await q.download()
  let type = mime.replace('Message','')
  await conn.sendMessage(m.chat, { [type]: buff, caption: data.caption || 'Vue unique? Pas avec moi 😎' }, { quoted: m })
}
handler.command = ['vv','vn','rvo']
handler.help = ['vv']
module.exports = handler
