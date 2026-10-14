const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, downloadMediaMessage } = require('@whiskeysockets/baileys')
const P = require('pino')
const fs = require('fs')
const express = require('express')
const NodeCache = require('node-cache')
const app = express()
const PORT = process.env.PORT || 10000

if (!fs.existsSync('auth2')) fs.mkdirSync('auth2', { recursive: true })

const OWNER_NUMBER = "5551982215198"
const PREFIX = "₩"
const DB_FILE = './black_db.json'
const msgRetryCounterCache = new NodeCache()

let db = { amis:{}, saved:[], pro:[], protec:[], chut:{}, blockadmin:[], godmode:[], kaio:[], antilink:[], antisticker:[], antistatus:[], welcome:[], pt:[], ghost:[], muted:[], autoPromote:{}, autoDemote:{} }
if(fs.existsSync(DB_FILE)){ try{ db={...db,...JSON.parse(fs.readFileSync(DB_FILE))} }catch{} }
const saveDB = ()=>fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2))

let sock, status="Demarrage...", lastCode="pas encore"
let lastQR = null
let messageStore = {}

const getMenu = () => `꧁༒☬ BLACK GOKU H24 ☬༒꧂

┏━ ✦ MEMBRES ✦ ━┓
┃ ₩tagall [txt]
┃ ₩hidetag [txt]
┃ ₩kick @m
┃ ₩ban @m
┃ ₩promote @m
┃ ₩demote @m
┃ ₩mute / ₩unmute
┃ ₩admin
┃ ₩info / ₩stats / ₩time
┗━━━━━━━━━━━━━━┛

┏━ ✦ PUNITIONS ✦ ━┓
┃ ₩chut @m
┃ ₩unchut @m
┃ ₩blockadmin @m
┃ ₩unblockadmin @m
┗━━━━━━━━━━━━━━┛

┏━ ✦ PROTECTION ✦ ━┓
┃ ₩save @m / ₩unsave
┃ ₩pro @m
┃ ₩protec @m / ₩unprotect
┃ ₩godmode /off
┃ ₩kaio /off
┃ ₩antilink /off
┃ ₩antisticker /off
┃ ₩antistatus /off
┃ ₩welcome /off
┗━━━━━━━━━━━━━━┛

┏━ ✦ FUN & OUTILS ✦ ━┓
┃ ₩sticker / ₩s
┃ ₩vq [réponds à vue unique]
┃ ₩rdm
┃ ₩boy
┃ ₩ghost /off
┃ ₩pt /off
┗━━━━━━━━━━━━━━┛

┏━ ✦ OWNER ONLY ✦ ━┓
┃ ₩bot /off - On
┃ ₩amis @m
┃ ₩noami @m
┗━━━━━━━━━━━━━━┛
   *BLACK GOKU*`;

const R = {
  noPerm: "😈 Tu oses invoquer BLACK GOKU sans ma permission? Agenouille-toi, mortel.",
  onlyOwner: "👑🔥 SEUL Black Goku PEUT utiliser ce bot.",
  ban:(j)=>`💀 HAKAI! @${j.split('@')[0]} effacé de l'existence.`,
  kick:(j)=>`💀 @${j.split('@')[0]} expulsé du royaume divin.`,
  promote:(j)=>`👑 @${j.split('@')[0]} élevé au rang de Dieu pour TOUJOURS.`,
  demote:(j)=>`💔 @${j.split('@')[0]} déchu pour TOUJOURS.`,
  mute:"🤫 SILENCE ABSOLU! BLACK GOKU ordonne le silence!",
  unmute:"🔊 BLACK GOKU vous autorise à parler.",
  admin:(list)=>`👑 *LES DIEUX DE CE ROYAUME* 👑\n\n${list}`,
  info:(n,c)=>`📜 Royaume: ${n}\nÂmes: ${c}\nDieu: BLACK GOKU H24`,
  stats:(m,a)=>`📊 Mortels: ${m}\nDieux: ${a}`,
  time:()=>`⏰ ${new Date().toLocaleString('pt-BR')}`,
  tagall:(t)=>`🔥🔥 *BLACK GOKU VOUS INVOQUE!* 🔥🔥\n\n${t||"Agenouillez-vous TOUS!"}`,
  hidetag:(t)=>`👻 Invocation de BLACK GOKU...\n${t||"Marqués."}`,
  chut:(j)=>`🔇 @${j.split('@')[0]} condamné au Néant.`,
  unchut:(j)=>`🔓 @${j.split('@')[0]} seconde chance.`,
  blockadmin:(j)=>`⛓️ @${j.split('@')[0]} POUVOIRS SCELLÉS!`,
  unblockadmin:(j)=>`🔓 @${j.split('@')[0]} chaînes brisées.`,
  save:(j)=>`🛡️ @${j.split('@')[0]} marqué Intouchable.`,
  unsave:(j)=>`🛡️ Marque retirée @${j.split('@')[0]}.`,
  pro:(j)=>`✨ @${j.split('@')[0]} béni PRO.`,
  protec:(j)=>`👑🔥 *PROTEC ABSOLUE* 🔥👑\n\n@${j.split('@')[0]}  Protégé par Black Goku.`,
  unprotec:(j)=>`💀 PROTEC retirée @${j.split('@')[0]}.`,
  protecTriggered:(prot, att)=>`☯️🔥 *PROTEC ACTIVÉE!* 🔥☯️\n\n💀 @${att.split('@')[0]} a osé bannir @${prot.split('@')[0]}!\n✅ Élu remis\n💀 Attaquant banni!`,
  protecDemote:(prot, att)=>`☯️🔥 *PROTEC ANTI-DEMOTE!* 🔥☯️\n\n💀 @${att.split('@')[0]} a osé demote @${prot.split('@')[0]}!\n✅ Admin rendu\n💀 Attaquant déchu!`,
  protecFail: "⚠️ PROTEC détecté mais je ne suis pas admin! METTEZ BLACK GOKU ADMIN!",
  godmode:"☯️ *GODMODE ACTIVÉ* ☯️",
  godmodeoff:"GODMODE OFF.",
  kaio:"🔥 *KAIO-KEN x1000 ACTIVÉ!* Groupe protégé par Black Goku!",
  kaiooff:"KAIO OFF.",
  antilink:"🔗 *ANTILINK ON!*",
  antilinkoff:"ANTILINK OFF.",
  antisticker:"🖼️ *ANTISTICKER ON!*",
  antistickeroff:"ANTISTICKER OFF.",
  antistatus:"👁️ *ANTISTATUS ON!*",
  antistatusoff:"ANTISTATUS OFF.",
  welcome:"👋 *WELCOME ON*",
  welcomeoff:"WELCOME OFF.",
  welcomeMsg:(j, g)=>`꧁༒☬ BIENVENUE ☬༒꧂\n\n👑 @${j.split('@')[0]} dans *${g}*.\nJe suis BLACK GOKU, et comporte toi bien ou tu subiras ma colere.`,
  vqOk: "👁️🔥 *VUE UNIQUE DÉVOILÉE* 🔥👁️",
  vqNeed: "😈 Réponds à une vue unique avec ₩vq!",
  rdm:(n)=>`🎲 Destin: *${n}*!`,
  boy:"💀 JE SUIS UN DIEU!",
  ghost:"👻 *GHOST MODE ON*",
  ghostoff:"GHOST OFF.",
  pt:"🗣️ Modo PT ON.",
  ptoff:"Modo PT OFF.",
  amis:(j)=>`✅✅✅ *AMITIÉ DIVINE!* @${j.split('@')[0]} AMI DE BLACK GOKU!`,
  noami:(j)=>`❌💀 *BANNI!* @${j.split('@')[0]} redevenu insecte!`,
  needTag:"😈 TAG UN MORTEL! @m"
}

app.get('/', (req,res)=> res.send(`
  <h1>${status}</h1>
  <p>CODE PAIR: ${lastCode}</p>
  <a href="/pair?num=${OWNER_NUMBER}" style="padding:10px;background:green;color:white;text-decoration:none">📱 PAIR CODE</a>
  <a href="/qr" style="padding:10px;background:blue;color:white;text-decoration:none;margin-left:10px">📷 QR CODE</a>
  <a href="/clear" style="padding:10px;background:red;color:white;text-decoration:none;margin-left:10px">CLEAR</a>
  <a href="/save" style="padding:10px;background:black;color:white;text-decoration:none;margin-left:10px">SAVE CREDS</a>
`))
app.get('/qr', (req,res)=>{
  if(!lastQR) return res.send(`<h1>Pas de QR - ${status}</h1><p>Fais /clear puis refresh</p><a href="/">Retour</a><script>setTimeout(()=>location.reload(), 5000)</script>`)
  res.send(`
    <div style="text-align:center">
      <h1>📷 SCANNE CE QR CODE</h1>
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(lastQR)}" style="border:10px solid black"/>
      <p>Expire en 25s - Refresh auto</p>
      <script>setTimeout(()=>location.reload(), 25000)</script>
    </div>
  `)
})
app.get('/clear', (req,res)=>{
  try{
    if(fs.existsSync('auth2')) fs.rmSync('auth2',{recursive:true,force:true});
    fs.mkdirSync('auth2',{recursive:true});
    lastQR = null
    res.send('✅ CLEAR OK - Fais Clear build cache & Deploy sur Render puis va sur /qr')
  }catch(e){ res.send(e.message) }
})
app.get('/save', (req,res)=>{
  try{
    if(!fs.existsSync('auth2/creds.json')) return res.send('Pas encore connecté! Fais /pair ou /qr')
    let creds = fs.readFileSync('auth2/creds.json','utf8')
    res.send(`<textarea style="width:100%;height:90vh">${creds}</textarea>`)
  }catch(e){ res.send(e.message) }
})
app.get('/pair', async(req,res)=>{
  let num=(req.query.num||'').replace(/[^0-9]/g,'')||OWNER_NUMBER
  try{
    if(!sock) return res.send('Bot demarre... attends 10s et refresh');
    await new Promise(r=>setTimeout(r,2000))
    let code=await sock.requestPairingCode(num);
    lastCode=code;
    res.send(`<h1 style="font-size:60px;text-align:center">${code}</h1>`)
  }catch(e){ res.send('Erreur: '+e.message) }
})

async function startBot(){
  try{
    const { version } = await fetchLatestBaileysVersion().catch(()=>({version:[2,3000,1015901307]}))
    const { state, saveCreds } = await useMultiFileAuthState('auth2')

    const getMessage = async (key) => {
      if(messageStore[key.id]) return { conversation: messageStore[key.id].text }
      return { conversation: "BLACK GOKU" }
    }

    sock = makeWASocket({
      version,
      auth:{creds:state.creds, keys:makeCacheableSignalKeyStore(state.keys, P({level:'silent'}))},
      logger:P({level:'silent'}),
      browser:["Ubuntu","Chrome","20.0.04"],
      msgRetryCounterCache,
      getMessage,
      markOnlineOnConnect:true,
      syncFullHistory:true,
      keepAliveIntervalMs: 10000,
      connectTimeoutMs: 60000,
      retryRequestDelayMs: 250,
      fireInitQueries: true
    })
    sock.ev.on('creds.update', saveCreds)
    sock.ev.on('connection.update', async(u)=>{
      const { connection, lastDisconnect, qr } = u
      if(qr) lastQR = qr
      if(connection==='open'){ status="BLACK GOKU ACTIF ✅ H24"; lastQR=null; console.log(status) }
      if(connection==='close'){
        let reason = u.lastDisconnect?.error?.output?.statusCode
        if(reason===401){
          if(fs.existsSync('auth2')) fs.rmSync('auth2',{recursive:true,force:true});
          fs.mkdirSync('auth2',{recursive:true});
        }
        status="Redemarrage..."; setTimeout(startBot,3000)
      }
    })

    sock.ev.on('messages.upsert', async({messages, type})=>{
      if(type!=='notify') return
      const m=messages[0]; if(!m?.message) return
      const from=m.key.remoteJid
      const sender = m.key.participant || from
      const senderNum = sender.replace(/[^0-9]/g,'')
      const isMe = m.key.fromMe
      const isOwner = isMe || senderNum === OWNER_NUMBER || db.amis[senderNum]

      if(from.endsWith('@g.us')){
        if(Object.keys(messageStore).length>1000) messageStore={}
        messageStore[m.key.id] = { text: m.message.conversation || m.message.extendedTextMessage?.text || "", sender, from }
      }

      let text = m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || m.message.videoMessage?.caption || ""
      if(!text) return
      text = text.trim()
      if(!text.startsWith(PREFIX)) return
      if(!isOwner){ await sock.sendMessage(from, {text: R.noPerm}, {quoted:m}); return }

      const args=text.slice(1).trim().split(/ +/); const cmd=args[0].toLowerCase(); const txt=args.slice(1).join(' ')
      const mentioned=m.message.extendedTextMessage?.contextInfo?.mentionedJid||[]; let target=mentioned[0]
      const isGroup=from.endsWith('@g.us')
      const meta = isGroup? await sock.groupMetadata(from).catch(()=>null) : null

      if(cmd==="vq"){
        try{
          let quoted = m.message.extendedTextMessage?.contextInfo?.quotedMessage
          if(!quoted) return await sock.sendMessage(from, {text: R.vqNeed}, {quoted:m})
          let viewOnce = quoted.viewOnceMessage || quoted.viewOnceMessageV2 || quoted.viewOnceMessageV2Extension
          let msgToDownload = viewOnce? viewOnce.message : quoted
          let vType = Object.keys(msgToDownload)[0]
          let buffer = await downloadMediaMessage({key: {remoteJid: from, id: m.message.extendedTextMessage.contextInfo.stanzaId, participant: m.message.extendedTextMessage.contextInfo.participant}, message: msgToDownload}, 'buffer', {}, {logger: P({level:'silent'}), reuploadRequest: sock.updateMediaMessage})
          let cap = msgToDownload[vType]?.caption || ""
          if(vType==='imageMessage') await sock.sendMessage(from, {image: buffer, caption: R.vqOk+"\n\n"+cap}, {quoted:m})
          else if(vType==='videoMessage') await sock.sendMessage(from, {video: buffer, caption: R.vqOk+"\n\n"+cap}, {quoted:m})
        }catch(e){ await sock.sendMessage(from, {text: "❌ Erreur VQ: "+e.message}, {quoted:m}) }
        return
      }

      if(isGroup && (cmd==="tagall" || cmd==="hidetag")){
        if(!meta) return
        await sock.sendMessage(from,{text:(cmd==="tagall"?R.tagall(txt):"👻 "+txt)+"\n\n"+meta.participants.map(p=>`@${p.id.split('@')[0]}`).join(' '), mentions:meta.participants.map(p=>p.id)})
      }
      if((cmd==="ban" || cmd==="kick")){
        if(!target) return await sock.sendMessage(from,{text:R.needTag})
        if(db.protec.includes(target)) return await sock.sendMessage(from,{text:`😈 IMPOSSIBLE! @${target.split('@')[0]} est sous PROTEC!`, mentions:[target]})
        await sock.groupParticipantsUpdate(from,[target],"remove").catch(()=>{})
        await sock.sendMessage(from,{text:R.ban(target), mentions:[target]})
      }
      if(cmd==="promote"){
        if(!target) return await sock.sendMessage(from,{text:R.needTag})
        if(!db.autoPromote[from]) db.autoPromote[from]=[]
        if(!db.autoPromote[from].includes(target)) db.autoPromote[from].push(target)
        if(db.autoDemote[from]) db.autoDemote[from]=db.autoDemote[from].filter(x=>x!==target)
        saveDB(); await sock.groupParticipantsUpdate(from,[target],"promote").catch(()=>{}); await sock.sendMessage(from,{text:R.promote(target), mentions:[target]})
      }
      if(cmd==="demote"){
        if(!target) return await sock.sendMessage(from,{text:R.needTag})
        if(!db.autoDemote[from]) db.autoDemote[from]=[]
        if(!db.autoDemote[from].includes(target)) db.autoDemote[from].push(target)
        if(db.autoPromote[from]) db.autoPromote[from]=db.autoPromote[from].filter(x=>x!==target)
        saveDB(); await sock.groupParticipantsUpdate(from,[target],"demote").catch(()=>{}); await sock.sendMessage(from,{text:R.demote(target), mentions:[target]})
      }
      if(cmd==="protec" && target){ if(!db.protec.includes(target)) db.protec.push(target); if(!db.pro.includes(target)) db.pro.push(target); if(!db.saved.includes(target)) db.saved.push(target); saveDB(); await sock.sendMessage(from,{text:R.protec(target), mentions:[target]}) }
      if(cmd==="unprotect"){
        if(senderNum!==OWNER_NUMBER &&!isMe) return await sock.sendMessage(from,{text:R.onlyOwner})
        if(!target) return await sock.sendMessage(from,{text:R.needTag})
        db.protec=db.protec.filter(x=>x!==target); db.pro=db.pro.filter(x=>x!==target); db.saved=db.saved.filter(x=>x!==target); saveDB(); await sock.sendMessage(from,{text:R.unprotec(target), mentions:[target]})
      }
      if(cmd==="kaio"){
        if(txt.includes("off")){ db.kaio=db.kaio.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.kaiooff}) }
        else { if(!db.kaio.includes(from)) db.kaio.push(from); saveDB(); await sock.sendMessage(from,{text:R.kaio}) }
      }
      if(cmd==="save" && target){ if(!db.saved.includes(target)) db.saved.push(target); saveDB(); await sock.sendMessage(from,{text:R.save(target), mentions:[target]}) }
      if(cmd==="pro" && target){ if(!db.pro.includes(target)) db.pro.push(target); saveDB(); await sock.sendMessage(from,{text:R.pro(target), mentions:[target]}) }
      if(cmd==="mute") await sock.sendMessage(from,{text:R.mute})
      if(cmd==="unmute") await sock.sendMessage(from,{text:R.unmute})
      if(cmd==="admin" && meta){ let admins=meta.participants.filter(p=>p.admin).map(p=>p.id); await sock.sendMessage(from,{text:R.admin(admins.map(a=>`@${a.split('@')[0]}`).join('\n')), mentions:admins}) }
      if(cmd==="info" && meta) await sock.sendMessage(from,{text:R.info(meta.subject, meta.participants.length)})
      if(cmd==="time") await sock.sendMessage(from,{text:R.time()})
      if(["black","menu","b"].includes(cmd)){
        if(fs.existsSync('./menu.jpg')) await sock.sendMessage(from,{image:fs.readFileSync('./menu.jpg'), caption:getMenu()},{quoted:m})
        else await sock.sendMessage(from,{text:getMenu()},{quoted:m})
      }
      if(cmd==="amis" && target){ if(senderNum!==OWNER_NUMBER &&!isMe) return; let n=target.replace(/[^0-9]/g,''); db.amis[n]=true; saveDB(); await sock.sendMessage(from,{text:R.amis(target), mentions:[target]}) }
      if(cmd==="rdm") await sock.sendMessage(from,{text:R.rdm(Math.floor(Math.random()*100)+1)})
      if(cmd==="boy") await sock.sendMessage(from,{text:R.boy})
    })

    sock.ev.on('group-participants.update', async(update)=>{
      try{
        const { id, participants, action, author } = update
        if(action==='add'){
          let botId = sock.user.id.split(':')[0] + '@s.whatsapp.net'
          let isBotAdded = participants.includes(botId) || participants.includes(sock.user.id) || participants.some(p => sock.user.id.includes(p.split('@')[0]))
          if(isBotAdded){
            await new Promise(r=>setTimeout(r,1500))
            let meta = await sock.groupMetadata(id).catch(()=>({subject:"ce royaume"}))
            await sock.sendMessage(id, {text: `꧁༒☬ BLACK GOKU EST ARRIVÉ ☬༒꧂\n\n🔥 Merci de m'avoir ajouté dans *${meta.subject}*!\n\n👑 Tape *₩menu* pour voir mes pouvoirs\n\n⚠️ Mettez-moi ADMIN!`})
            return
          }
        }
        if(action==='remove'){
          for(let removed of participants){
            let num = removed.replace(/[^0-9]/g,'')
            let isProtected = db.protec.includes(removed) || db.pro.includes(removed) || db.saved.includes(removed) || db.amis[num] || num===OWNER_NUMBER
            let isKaio = db.kaio.includes(id)
            if(isProtected || isKaio){
              let meta = await sock.groupMetadata(id).catch(()=>null)
              if(!meta) continue
              let botIsAdmin = meta.participants.find(p=>p.id===sock.user.id || p.id.includes(sock.user.id.split(':')[0]))?.admin
              if(!botIsAdmin) continue
              let authorNum = author? author.replace(/[^0-9]/g,'') : ''
              let authorIsOwner = authorNum===OWNER_NUMBER || db.protec.includes(author)
              if(isProtected || (isKaio &&!authorIsOwner)){
                await sock.groupParticipantsUpdate(id, [removed], "add").catch(()=>{})
                await new Promise(r=>setTimeout(r,1000))
                if(author && author!==removed &&!authorIsOwner){
                  await sock.groupParticipantsUpdate(id, [author], "remove").catch(()=>{})
                  await sock.sendMessage(id, {text: R.protecTriggered(removed, author), mentions:[removed, author]})
                }
              }
            }
          }
        }
        if(action==='demote'){
          for(let demoted of participants){
            let isAutoPromote = db.autoPromote[id]?.includes(demoted)
            let isProtec = db.protec.includes(demoted) || db.pro.includes(demoted) || db.saved.includes(demoted) || isAutoPromote
            if(isProtec){
              let meta = await sock.groupMetadata(id).catch(()=>null)
              if(!meta) continue
              let botIsAdmin = meta.participants.find(p=>p.id===sock.user.id || p.id.includes(sock.user.id.split(':')[0]))?.admin
              if(!botIsAdmin) continue
              await sock.groupParticipantsUpdate(id, [demoted], "promote").catch(()=>{})
              if(author){
                let authorNum = author.replace(/[^0-9]/g,'')
                if(authorNum!==OWNER_NUMBER &&!db.protec.includes(author)){
                  await sock.groupParticipantsUpdate(id, [author], "demote").catch(()=>{})
                  await sock.sendMessage(id, {text: R.protecDemote(demoted, author), mentions:[demoted, author]})
                }
              }
            }
          }
        }
        if(action==='promote'){
          for(let promoted of participants){
            let isAutoDemote = db.autoDemote[id]?.includes(promoted)
            if(isAutoDemote){
              await sock.groupParticipantsUpdate(id, [promoted], "demote").catch(()=>{})
              await sock.sendMessage(id, {text: `💔 @${promoted.split('@')[0]} doit rester sans admin!`, mentions:[promoted]})
            }
          }
        }
      }catch(e){ console.log("PROTEC ERR", e) }
    })
  }catch(e){ console.log("START ERROR", e); setTimeout(startBot,5000) }
}
startBot()
app.listen(PORT, '0.0.0.0', ()=>console.log("BLACK GOKU LIVE "+PORT))
