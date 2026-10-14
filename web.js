const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, downloadMediaMessage } = require('@whiskeysockets/baileys')
const P = require('pino')
const fs = require('fs')
const express = require('express')
const NodeCache = require('node-cache')
const QRCode = require('qrcode')
const app = express()
const PORT = process.env.PORT || 10000

if (!fs.existsSync('auth2')) fs.mkdirSync('auth2', { recursive: true })

const OWNER_NUMBER = "5551982215198"
const PREFIX = "₩"
const DB_FILE = './black_db.json'
const msgRetryCounterCache = new NodeCache()

let db = { amis:{}, saved:[], pro:[], protec:[], chut:{}, blockadmin:[], godmode:[], kaio:[], antilink:[], antisticker:[], antistatus:[], welcome:[], pt:[], ghost:[], muted:[] }
if(fs.existsSync(DB_FILE)){ try{ db={...db,...JSON.parse(fs.readFileSync(DB_FILE))} }catch{} }
const saveDB = ()=>fs.writeFileSync(DB_FILE, JSON.stringify(db))

let sock, status="Demarrage...", lastCode="pas encore", latestQR=null
let messageStore = {}

const getMenu = () => `꧁༒☬ BLACK GOKU H24 ☬༒꧂

┏━ ✦ MEMBRES ✦ ━┓
┃ ₩tagall [txt]
┃ ₩hidetag [txt]
┃ ₩kick @m
┃ ₩ban @m
┃ ₩promote @m [min]
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
  onlyOwner: "👑🔥 SEUL LE DIEU SUPRÊME 5551982215198 PEUT FAIRE ÇA.",
  ban:(j)=>`💀 HAKAI! @${j.split('@')[0]} effacé de l'existence.`,
  kick:(j)=>`💀 @${j.split('@')[0]} expulsé du royaume divin.`,
  promote:(j)=>`👑 @${j.split('@')[0]} élevé au rang de Dieu de la Destruction.`,
  promoteMin:(j)=>`⏳ @${j.split('@')[0]} reçoit un fragment de mon pouvoir.`,
  demote:(j)=>`💔 @${j.split('@')[0]} déchu.`,
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
  protec:(j)=>`👑🔥 *PROTEC ABSOLUE* 🔥👑\n\n@${j.split('@')[0]} est l'ÉLU!`,
  unprotec:(j)=>`💀 PROTEC retirée @${j.split('@')[0]}.`,
  protecTriggered:(prot, att)=>`☯️🔥 *PROTEC ACTIVÉE!* 🔥☯️\n\n💀 @${att.split('@')[0]} a osé bannir @${prot.split('@')[0]}!\n✅ Élu remis\n💀 Attaquant banni!`,
  protecDemote:(prot, att)=>`☯️🔥 *PROTEC ANTI-DEMOTE!* 🔥☯️\n\n💀 @${att.split('@')[0]} a osé demote @${prot.split('@')[0]}!\n✅ Admin rendu\n💀 Attaquant déchu!`,
  protecFail: "⚠️ PROTEC détecté mais je ne suis pas admin! METTEZ BLACK GOKU ADMIN!",
  godmode:"☯️ *GODMODE ACTIVÉ* ☯️",
  godmodeoff:"GODMODE OFF.",
  kaio:"🔥 *KAIO-KEN x1000 ACTIVÉ!*",
  kaiooff:"KAIO OFF.",
  antilink:"🔗 *ANTILINK ON!*",
  antilinkoff:"ANTILINK OFF.",
  antisticker:"🖼️ *ANTISTICKER ON!*",
  antistickeroff:"ANTISTICKER OFF.",
  antistatus:"👁️ *ANTISTATUS ON!*",
  antistatusoff:"ANTISTATUS OFF.",
  welcome:"👋 *WELCOME ON*",
  welcomeoff:"WELCOME OFF.",
  welcomeMsg:(j, g)=>`꧁༒☬ BIENVENUE ☬༒꧂\n\n👑 @${j.split('@')[0]} dans *${g}*.\nJe suis BLACK GOKU, ton maître.`,
  byeMsg:(j)=>`💀 @${j.split('@')[0]} a fui.`,
  vqOk: "👁️🔥 *VUE UNIQUE DÉVOILÉE* 🔥👁️",
  vqNeed: "😈 Réponds à une vue unique avec ₩vq!",
  sticker:"✨ Sticker forgé.",
  rdm:(n)=>`🎲 Destin: *${n}*!`,
  boy:"💀 JE SUIS UN DIEU!",
  ghost:"👻 *GHOST MODE ON*",
  ghostoff:"GHOST OFF.",
  pt:"🗣️ Modo PT ON.",
  ptoff:"Modo PT OFF.",
  boton:"🤖🔥 *BLACK GOKU SE RÉVEILLE!*",
  botoff:"💤 BLACK GOKU S'ENDORT...",
  amis:(j)=>`✅✅✅ *AMITIÉ DIVINE!* @${j.split('@')[0]} AMI DE BLACK GOKU!`,
  noami:(j)=>`❌💀 *BANNI!* @${j.split('@')[0]} redevenu insecte!`,
  needTag:"😈 TAG UN MORTEL! @m"
}

app.get('/', (req,res)=> res.send(`<h1>${status}</h1><p>CODE: ${lastCode}</p><p><a href="/qr">VOIR QR CODE</a> | <a href="/pair?num=${OWNER_NUMBER}">PAIR</a> | <a href="/clear">CLEAR</a> | <a href="/save">SAVE CREDS</a></p>`))

app.get('/qr', async(req,res)=>{
  if(!latestQR) return res.send('<h1>QR pas prêt... refresh dans 3s</h1><script>setTimeout(()=>location.reload(),3000)</script>')
  try{
    let qrImage = await QRCode.toDataURL(latestQR)
    res.send(`<h1 style="text-align:center">SCANNE CE QR!</h1><div style="text-align:center"><img src="${qrImage}" style="width:320px;border:10px solid black"><p>WhatsApp > Appareils liés > Lier un appareil</p><p>QR change toutes les 30s - Refresh auto</p></div><script>setTimeout(()=>location.reload(),20000)</script>`)
  }catch(e){ res.send(e.message) }
})

app.get('/clear', (req,res)=>{
  try{
    if(fs.existsSync('auth2')) fs.rmSync('auth2',{recursive:true,force:true});
    fs.mkdirSync('auth2',{recursive:true});
    latestQR=null
    res.send('✅ CLEAR OK - Fais Manual Deploy > Clear build cache & Deploy sur Render')
  }catch(e){ res.send(e.message) }
})
app.get('/save', (req,res)=>{
  try{
    if(!fs.existsSync('auth2/creds.json')) return res.send('Pas encore connecté! Fais /qr ou /pair d\'abord')
    let creds = fs.readFileSync('auth2/creds.json','utf8')
    res.send(`<h2>Copie ce fichier dans GitHub: auth2/creds.json</h2><textarea style="width:100%;height:80vh">${creds}</textarea>`)
  }catch(e){ res.send(e.message) }
})
app.get('/pair', async(req,res)=>{
  let num=(req.query.num||'').replace(/[^0-9]/g,'')||OWNER_NUMBER
  try{
    if(!sock){ return res.send('Bot demarre... attends 10s et refresh'); }
    await new Promise(r=>setTimeout(r,2000))
    let code=await sock.requestPairingCode(num);
    lastCode=code;
    console.log("CODE:", code, "pour", num)
    res.send(`<h1 style="font-size:60px;text-align:center">${code}</h1><p style="text-align:center">Tape en 15 sec! WhatsApp > Appareils liés > Lier avec numéro</p>`)
  }catch(e){ res.send('Erreur: '+e.message) }
})

async function startBot(){
  try{
    const { version } = await fetchLatestBaileysVersion().catch(()=>({version:[2,3000,1015901307]}))
    const { state, saveCreds } = await useMultiFileAuthState('auth2')
    sock = makeWASocket({
      version,
      auth:{creds:state.creds, keys:makeCacheableSignalKeyStore(state.keys, P({level:'silent'}))},
      logger:P({level:'silent'}),
      browser:["Chrome","Ubuntu","22.04"],
      msgRetryCounterCache,
      markOnlineOnConnect:false,
      syncFullHistory:false,
      keepAliveIntervalMs: 10000,
      connectTimeoutMs: 60000
    })
    sock.ev.on('creds.update', saveCreds)
    sock.ev.on('connection.update', async(u)=>{
      if(u.qr){ latestQR=u.qr; status="QR DISPONIBLE - Va sur /qr"; console.log("NEW QR!") }
      if(u.connection==='open'){ status="BLACK GOKU ACTIF ✅ H24"; console.log(status); latestQR=null }
      if(u.connection==='close'){
        let reason = u.lastDisconnect?.error?.output?.statusCode
        console.log("Close reason:", reason)
        if(reason===401){
          if(fs.existsSync('auth2')) fs.rmSync('auth2',{recursive:true,force:true});
          fs.mkdirSync('auth2',{recursive:true});
        }
        status="Redemarrage...";
        setTimeout(startBot,3000)
      }
    })

    sock.ev.on('messages.upsert', async({messages, type})=>{
      if(type!=='notify') return
      const m=messages[0]; if(!m?.message) return
      const from=m.key.remoteJid
      const sender = m.key.participant || from
      const senderNum = sender.replace(/[^0-9]/g,'')
      const isMe = m.key.fromMe
      const isOwner = isMe || senderNum.includes(OWNER_NUMBER) || db.amis[senderNum] || db.amis[sender]

      if(from.endsWith('@g.us') && db.kaio.includes(from)){
        if(Object.keys(messageStore).length>1000){ messageStore={} }
        messageStore[m.key.id] = { text: m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || "[media]", sender, from }
      }

      let text = m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || m.message.videoMessage?.caption || ""
      if(!text.startsWith(PREFIX)) return
      if(!isOwner){ await sock.sendMessage(from, {text: R.noPerm}, {quoted:m}); return }

      const args=text.slice(1).trim().split(/ +/); const cmd=args[0].toLowerCase(); const txt=args.slice(1).join(' ')
      const mentioned=m.message.extendedTextMessage?.contextInfo?.mentionedJid||[]; let target=mentioned[0]
      const isGroup=from.endsWith('@g.us')
      const meta = isGroup? await sock.groupMetadata(from).catch(()=>null) : null

      if(cmd==="vq"){
        try{
          let quoted = m.message.extendedTextMessage?.contextInfo?.quotedMessage
          if(!quoted){ await sock.sendMessage(from, {text: R.vqNeed}, {quoted:m}); return }
          let viewOnce = quoted.viewOnceMessage || quoted.viewOnceMessageV2 || quoted.viewOnceMessageV2Extension
          let msgToDownload = viewOnce? viewOnce.message : quoted
          let vType = Object.keys(msgToDownload)[0]
          let buffer = await downloadMediaMessage({key: {remoteJid: from, id: m.message.extendedTextMessage.contextInfo.stanzaId, participant: m.message.extendedTextMessage.contextInfo.participant}, message: msgToDownload}, 'buffer', {}, {logger: P({level:'silent'}), reuploadRequest: sock.updateMediaMessage})
          let cap = msgToDownload[vType]?.caption || ""
          if(vType==='imageMessage') await sock.sendMessage(from, {image: buffer, caption: R.vqOk+"\n\n"+cap}, {quoted:m})
          else if(vType==='videoMessage') await sock.sendMessage(from, {video: buffer, caption: R.vqOk+"\n\n"+cap}, {quoted:m})
          else await sock.sendMessage(from, {text: "❌ Pas une vue unique"}, {quoted:m})
        }catch(e){ await sock.sendMessage(from, {text: "❌ Erreur VQ: "+e.message}, {quoted:m}) }
        return
      }

      if(isGroup && (cmd==="tagall" || cmd==="hidetag")){
        if(!meta) return
        let mentions=meta.participants.map(p=>p.id)
        let tagText = (cmd==="tagall"?R.tagall(txt):"👻 Invocation...\n\n"+txt) + "\n\n" + meta.participants.map(p=>`@${p.id.split('@')[0]}`).join(' ')
        await sock.sendMessage(from,{text:tagText, mentions})
      }

      if((cmd==="ban" || cmd==="kick")){
        if(!target) return await sock.sendMessage(from,{text:R.needTag})
        let isProtected = db.protec.includes(target) || db.pro.includes(target) || db.saved.includes(target)
        if(isProtected){ await sock.sendMessage(from,{text:`😈 IMPOSSIBLE! @${target.split('@')[0]} est sous PROTEC!`, mentions:[target]}); return }
        await sock.groupParticipantsUpdate(from,[target],"remove").catch(()=>{})
        await sock.sendMessage(from,{text:R.ban(target), mentions:[target]})
      }
      if(cmd==="promote"){ if(!target) return; let isMin=txt.includes("min"); await sock.groupParticipantsUpdate(from,[target],"promote").catch(()=>{}); await sock.sendMessage(from,{text:isMin?R.promoteMin(target):R.promote(target), mentions:[target]}) }
      if(cmd==="demote"){ if(!target) return; await sock.groupParticipantsUpdate(from,[target],"demote").catch(()=>{}); await sock.sendMessage(from,{text:R.demote(target), mentions:[target]}) }
      if(cmd==="mute") await sock.sendMessage(from,{text:R.mute})
      if(cmd==="unmute") await sock.sendMessage(from,{text:R.unmute})
      if(cmd==="admin" && meta){ let admins=meta.participants.filter(p=>p.admin).map(p=>p.id); await sock.sendMessage(from,{text:R.admin(admins.map(a=>`@${a.split('@')[0]}`).join('\n')), mentions:admins}) }
      if(cmd==="info" && meta) await sock.sendMessage(from,{text:R.info(meta.subject, meta.participants.length)})
      if(cmd==="stats" && meta) await sock.sendMessage(from,{text:R.stats(meta.participants.length, meta.participants.filter(p=>p.admin).length)})
      if(cmd==="time") await sock.sendMessage(from,{text:R.time()})
      if(cmd==="chut" && target){ db.chut[target]=true; saveDB(); await sock.sendMessage(from,{text:R.chut(target), mentions:[target]}) }
      if(cmd==="unchut" && target){ delete db.chut[target]; saveDB(); await sock.sendMessage(from,{text:R.unchut(target), mentions:[target]}) }
      if(cmd==="blockadmin" && target){ if(!db.blockadmin.includes(target)) db.blockadmin.push(target); saveDB(); await sock.sendMessage(from,{text:R.blockadmin(target), mentions:[target]}) }
      if(cmd==="unblockadmin" && target){ db.blockadmin=db.blockadmin.filter(x=>x!==target); saveDB(); await sock.sendMessage(from,{text:R.unblockadmin(target), mentions:[target]}) }
      if(cmd==="save" && target){ if(!db.saved.includes(target)) db.saved.push(target); saveDB(); await sock.sendMessage(from,{text:R.save(target), mentions:[target]}) }
      if(cmd==="unsave" && target){ db.saved=db.saved.filter(x=>x!==target); saveDB(); await sock.sendMessage(from,{text:R.unsave(target), mentions:[target]}) }
      if(cmd==="pro" && target){ if(!db.pro.includes(target)) db.pro.push(target); if(!db.saved.includes(target)) db.saved.push(target); saveDB(); await sock.sendMessage(from,{text:R.pro(target), mentions:[target]}) }
      if(cmd==="protec" && target){ if(!db.protec.includes(target)) db.protec.push(target); if(!db.pro.includes(target)) db.pro.push(target); if(!db.saved.includes(target)) db.saved.push(target); saveDB(); await sock.sendMessage(from,{text:R.protec(target), mentions:[target]}) }
      if(cmd==="unprotect" && target){ db.protec=db.protec.filter(x=>x!==target); db.pro=db.pro.filter(x=>x!==target); db.saved=db.saved.filter(x=>x!==target); saveDB(); await sock.sendMessage(from,{text:R.unprotec(target), mentions:[target]}) }
      if(cmd==="godmode"){ if(txt.includes("off")){ db.godmode=db.godmode.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.godmodeoff}) } else { if(!db.godmode.includes(from)) db.godmode.push(from); saveDB(); await sock.sendMessage(from,{text:R.godmode}) } }
      if(cmd==="kaio"){ if(txt.includes("off")){ db.kaio=db.kaio.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.kaiooff}) } else { if(!db.kaio.includes(from)) db.kaio.push(from); saveDB(); await sock.sendMessage(from,{text:R.kaio}) } }
      if(cmd==="antilink") await sock.sendMessage(from,{text:txt.includes("off")?R.antilinkoff:R.antilink})
      if(cmd==="antisticker") await sock.sendMessage(from,{text:txt.includes("off")?R.antistickeroff:R.antisticker})
      if(cmd==="antistatus") await sock.sendMessage(from,{text:txt.includes("off")?R.antistatusoff:R.antistatus})
      if(cmd==="welcome"){ if(txt.includes("off")){ db.welcome=db.welcome.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.welcomeoff}) } else { if(!db.welcome.includes(from)) db.welcome.push(from); saveDB(); await sock.sendMessage(from,{text:R.welcome}) } }
      if(cmd==="ghost") await sock.sendMessage(from,{text:txt.includes("off")?R.ghostoff:R.ghost})
      if(cmd==="pt") await sock.sendMessage(from,{text:txt.includes("off")?R.ptoff:R.pt})
      if(cmd==="boy") await sock.sendMessage(from,{text:R.boy})
      if(cmd==="rdm") await sock.sendMessage(from,{text:R.rdm(Math.floor(Math.random()*100)+1)})
      if(["black","menu","b"].includes(cmd)){
        const menuText=getMenu()
        if(fs.existsSync('./menu.jpg')) await sock.sendMessage(from,{image:fs.readFileSync('./menu.jpg'), caption:menuText},{quoted:m})
        else await sock.sendMessage(from,{text:menuText},{quoted:m})
      }
      if(cmd==="amis" && target){ if(!senderNum.includes(OWNER_NUMBER) &&!isMe){ return await sock.sendMessage(from,{text:R.onlyOwner}) } let n=target.replace(/[^0-9]/g,''); db.amis[n]=true; db.amis[target]=true; saveDB(); await sock.sendMessage(from,{text:R.amis(target), mentions:[target]}) }
      if(cmd==="noami" && target){ if(!senderNum.includes(OWNER_NUMBER) &&!isMe){ return await sock.sendMessage(from,{text:R.onlyOwner}) } let n=target.replace(/[^0-9]/g,''); delete db.amis[n]; delete db.amis[target]; saveDB(); await sock.sendMessage(from,{text:R.noami(target), mentions:[target]}) }
    })

    sock.ev.on('messages.update', async(updates)=>{
      for(let update of updates){
        if(update.update.message === null && messageStore[update.key.id]){
          let stored = messageStore[update.key.id]
          if(db.kaio.includes(stored.from)){
            let sender = stored.sender
            await sock.sendMessage(stored.from, {text: `🔥 *KAIO-KEN! MESSAGE SUPPRIMÉ!* 🔥\n\n@${sender.split('@')[0]} a supprimé: \n\n"${stored.text}"`, mentions:[sender]})
          }
          delete messageStore[update.key.id]
        }
      }
    })

    sock.ev.on('group-participants.update', async(update)=>{
      try{
        const { id, participants, action, author } = update
        if(action==='add'){
          for(let p of participants){
            let meta = await sock.groupMetadata(id).catch(()=>({subject:"mon royaume"}))
            if(db.welcome.includes(id)) await sock.sendMessage(id, {text: R.welcomeMsg(p, meta.subject), mentions:[p]})
          }
        }
        if(action==='remove'){
          for(let removed of participants){
            let num = removed.replace(/[^0-9]/g,'')
            let isProtected = db.protec.includes(removed) || db.pro.includes(removed) || db.saved.includes(removed) || db.amis[num] || num.includes(OWNER_NUMBER)
            if(isProtected){
              let meta = await sock.groupMetadata(id).catch(()=>null)
              if(!meta) continue
              let botIsAdmin = meta.participants.find(p=>p.id.includes(sock.user.id.split(':')[0]))?.admin
              if(!botIsAdmin){ await sock.sendMessage(id, {text: R.protecFail}); continue }
              await sock.groupParticipantsUpdate(id, [removed], "add").catch(()=>{})
              await new Promise(r=>setTimeout(r,1200))
              if(author && author!==removed){
                let authorNum = author.replace(/[^0-9]/g,'')
                if(!db.protec.includes(author) &&!authorNum.includes(OWNER_NUMBER)){
                  await sock.groupParticipantsUpdate(id, [author], "remove").catch(()=>{})
                  await sock.sendMessage(id, {text: R.protecTriggered(removed, author), mentions:[removed, author]})
                }
              }
            }
          }
        }
        if(action==='demote'){
          for(let demoted of participants){
            let num = demoted.replace(/[^0-9]/g,'')
            let isProtected = db.protec.includes(demoted) || db.pro.includes(demoted) || db.saved.includes(demoted) || num.includes(OWNER_NUMBER)
            if(isProtected){
              let meta = await sock.groupMetadata(id).catch(()=>null)
              if(!meta) continue
              let botIsAdmin = meta.participants.find(p=>p.id.includes(sock.user.id.split(':')[0]))?.admin
              if(!botIsAdmin){ await sock.sendMessage(id, {text: R.protecFail}); continue }
              await sock.groupParticipantsUpdate(id, [demoted], "promote").catch(()=>{})
              await new Promise(r=>setTimeout(r,800))
              if(author && author!==demoted){
                let authorNum = author.replace(/[^0-9]/g,'')
                if(!db.protec.includes(author) &&!authorNum.includes(OWNER_NUMBER)){
                  await sock.groupParticipantsUpdate(id, [author], "demote").catch(()=>{})
                  await sock.sendMessage(id, {text: R.protecDemote(demoted, author), mentions:[demoted, author]})
                }
              }
            }
          }
        }
      }catch(e){ console.log("PROTEC ERR", e) }
    })
  }catch(e){
    console.log("START ERROR", e)
    setTimeout(startBot,5000)
  }
}
startBot()
app.listen(PORT, '0.0.0.0', ()=>console.log("BLACK GOKU LIVE "+PORT))
setInterval(()=>{ console.log("H24 ping keep alive") }, 10*60*1000)
