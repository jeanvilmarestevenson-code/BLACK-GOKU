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

let db = { amis:{}, saved:[], pro:[], protec:[], bro:[], chut:{}, blockadmin:[], godmode:[], kaio:[], antilink:[], antisticker:[], antistatus:[], welcome:[], pt:[], ghost:[], muted:[], autoPromote:{}, autoDemote:{}, vengeance:{}, shadow:[] }
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
┃ ₩info / ₩stats
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
┃ ₩bro @m / ₩nobro @m
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
┃ ₩amis @m
┃ ₩noami @m
┗━━━━━━━━━━━━━━┛
   *BLACK GOKU*`;

const R = {
  noPerm: "😈 Tu oses invoquer BLACK GOKU sans ma permission?",
  onlyOwner: "👑🔥 SEUL Black Goku PEUT utiliser ce bot.",
  ban:(j)=>`💀 HAKAI! @${j.split('@')[0]} effacé.`,
  kick:(j)=>`💀 @${j.split('@')[0]} expulsé.`,
  promote:(j)=>`👑 @${j.split('@')[0]} élevé admin.`,
  demote:(j)=>`@${j.split('@')[0]} n'est plus admin.`,
  mute:"🤫 SILENCE ABSOLU!",
  unmute:"🔊 Vous pouvez parler.",
  admin:(list)=>`👑 *LES DIEUX* 👑\n\n${list}`,
  info:(n,c)=>`📜 Groupe: ${n}\nÂmes: ${c}`,
  tagall:(t)=>`🔥 *BLACK GOKU VOUS INVOQUE!* 🔥\n\n${t||"Tous!"}`,
  hidetag:(t)=>`👻 Invocation...\n${t||"Marqués."}`,
  chut:(j)=>`🔇 @${j.split('@')[0]} au Néant.`,
  unchut:(j)=>`🔓 @${j.split('@')[0]} peut parler.`,
  blockadmin:(j)=>`⛓️ @${j.split('@')[0]} POUVOIRS SCELLÉS!`,
  unblockadmin:(j)=>`🔓 @${j.split('@')[0]} chaînes brisées.`,
  save:(j)=>`🛡️ @${j.split('@')[0]} Intouchable.`,
  unsave:(j)=>`🛡️ Marque retirée @${j.split('@')[0]}.`,
  pro:(j)=>`✨ @${j.split('@')[0]} béni PRO.`,
  protec:(j)=>`👑🔥 *PROTEC* 🔥👑\n\n@${j.split('@')[0]} Protégé.`,
  unprotec:(j)=>`💀 PROTEC retirée @${j.split('@')[0]}.`,
  bro:(j)=>`👑🔥 *BRO PROTECTION* 🔥👑\n\n@${j.split('@')[0]} est mon BRO! Si on lui retire admin, je le remets + je demote l'attaquant!`,
  nobro:(j)=>`💀 BRO retiré @${j.split('@')[0]}.`,
  protecTriggered:(prot, att)=>`☯️🔥 *PROTEC ACTIVÉE!* 🔥☯️\n\n💀 @${att.split('@')[0]} a osé bannir @${prot.split('@')[0]}!`,
  protecDemote:(prot, att)=>`☯️🔥 *PROTEC ANTI-DEMOTE!* 🔥☯️\n\n💀 @${att.split('@')[0]} a osé demote @${prot.split('@')[0]}!`,
  godmode:"☯️ *GODMODE ON* ☯️",
  godmodeoff:"GODMODE OFF.",
  kaio:"🔥 *KAIO-KEN ON!*",
  kaiooff:"KAIO OFF.",
  antilink:"🔗 *ANTILINK ON!*",
  antilinkoff:"ANTILINK OFF.",
  antisticker:"🖼️ *ANTISTICKER ON!*",
  antistickeroff:"ANTISTICKER OFF.",
  antistatus:"👁️ *ANTISTATUS ON!*",
  antistatusoff:"ANTISTATUS OFF.",
  welcome:"👋 *WELCOME ON*",
  welcomeoff:"WELCOME OFF.",
  welcomeMsg:(j, g)=>`꧁༒ BIENVENUE ☬༒꧂\n\n👑 @${j.split('@')[0]} dans *${g}*.\n`,
  vqOk: "👁️🔥 *VUE UNIQUE DÉVOILÉE* 🔥👁️",
  vqNeed: "😈 Réponds à une vue unique avec ₩vq!",
  rdm:(n)=>`🎲 Destin: *${n}*!`,
  boy:"💀 JE SUIS BLACK GOKU",
  ghost:"👻 *GHOST MODE ON*",
  ghostoff:"GHOST OFF.",
  pt:"🗣️ PT ON.",
  ptoff:"PT OFF.",
  amis:(j)=>`✅ *AMITIÉ DIVINE!* @${j.split('@')[0]} AMI!`,
  noami:(j)=>`❌💀 *BANNI!* @${j.split('@')[0]} plus de bot!`,
  needTag:"😈 TAG UN MORTEL! @m",
  antiOwner:"👑🔥 IMPOSSIBLE! Protégé!"
}

app.get('/', (req,res)=> res.send(`<h1>${status}</h1><p>CODE: ${lastCode}</p><a href="/pair?num=${OWNER_NUMBER}">PAIR</a> | <a href="/qr">QR</a> | <a href="/clear">CLEAR</a> | <a href="/save">SAVE</a>`))
app.get('/qr', (req,res)=>{ if(!lastQR) return res.send(`<h1>Pas de QR - ${status}</h1>`); res.send(`<div style="text-align:center"><h1>SCAN QR</h1><img src="https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(lastQR)}"/><script>setTimeout(()=>location.reload(),25000)</script></div>`) })
app.get('/clear', (req,res)=>{ try{ if(fs.existsSync('auth2')) fs.rmSync('auth2',{recursive:true,force:true}); fs.mkdirSync('auth2',{recursive:true}); lastQR=null; res.send('CLEAR OK') }catch(e){ res.send(e.message) } })
app.get('/save', (req,res)=>{ try{ let creds = fs.readFileSync('auth2/creds.json','utf8'); res.send(`<textarea style="width:100%;height:90vh">${creds}</textarea>`) }catch(e){ res.send(e.message) } })
app.get('/pair', async(req,res)=>{ let num=(req.query.num||'').replace(/[^0-9]/g,'')||OWNER_NUMBER; try{ if(!sock) return res.send('Bot demarre...'); await new Promise(r=>setTimeout(r,2000)); let code=await sock.requestPairingCode(num); lastCode=code; res.send(`<h1 style="font-size:60px;text-align:center">${code}</h1>`) }catch(e){ res.send('Erreur: '+e.message) } })

async function startBot(){
  try{
    const { version } = await fetchLatestBaileysVersion().catch(()=>({version:[2,3000,1015901307]}))
    const { state, saveCreds } = await useMultiFileAuthState('auth2')
    const getMessage = async (key) => { if(messageStore[key.id]) return { conversation: messageStore[key.id].text }; return { conversation: "BLACK GOKU" } }
    sock = makeWASocket({ version, auth:{creds:state.creds, keys:makeCacheableSignalKeyStore(state.keys, P({level:'silent'}))}, logger:P({level:'silent'}), browser:["Ubuntu","Chrome","20.0.04"], msgRetryCounterCache, getMessage, markOnlineOnConnect:true, syncFullHistory:true, keepAliveIntervalMs:10000, connectTimeoutMs:60000 })
    sock.ev.on('creds.update', saveCreds)
    sock.ev.on('connection.update', async(u)=>{ const { connection, qr } = u; if(qr) lastQR = qr; if(connection==='open'){ status="BLACK GOKU ACTIF ✅ H24"; lastQR=null; console.log(status) } if(connection==='close'){ let reason = u.lastDisconnect?.error?.output?.statusCode; if(reason===401){ if(fs.existsSync('auth2')) fs.rmSync('auth2',{recursive:true,force:true}); fs.mkdirSync('auth2',{recursive:true}); } status="Redemarrage..."; setTimeout(startBot,3000) } })

    sock.ev.on('messages.upsert', async({messages, type})=>{
      if(type!=='notify') return
      const m=messages[0]; if(!m?.message) return
      const from=m.key.remoteJid; const sender = m.key.participant || from; const senderNum = sender.replace(/[^0-9]/g,''); const isMe = m.key.fromMe; const isOwner = isMe || senderNum === OWNER_NUMBER || db.amis[senderNum]
      if(from.endsWith('@g.us')){ if(Object.keys(messageStore).length>1000) messageStore={}; messageStore[m.key.id] = { text: m.message.conversation || m.message.extendedTextMessage?.text || "", sender, from } }
      let text = m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || m.message.videoMessage?.caption || ""; if(!text) return; text=text.trim(); if(!text.startsWith(PREFIX)) return
      if(!isOwner){ await sock.sendMessage(from, {text: R.noPerm}, {quoted:m}); return }
      const args=text.slice(1).trim().split(/ +/); const cmd=args[0].toLowerCase(); const txt=args.slice(1).join(' '); const mentioned=m.message.extendedTextMessage?.contextInfo?.mentionedJid||[]; let target=mentioned[0]; const isGroup=from.endsWith('@g.us'); const meta = isGroup? await sock.groupMetadata(from).catch(()=>null) : null

      if(cmd==="time"){
        let sent = await sock.sendMessage(from, {text: "⏰ *BLACK GOKU TIME* ⏰\n\n10"}, {quoted:m})
        for(let i=9;i>=0;i--){ await new Promise(r=>setTimeout(r,1000)); await sock.sendMessage(from, {text: `⏰ ${i} ${i===0?"💥 BOOM!":""}`}) }
        await sock.sendMessage(from, {text: "🔥 TEMPS ÉCOULÉ!"})
        return
      }
      if(cmd==="vq"){
        try{
          let quoted = m.message.extendedTextMessage?.contextInfo?.quotedMessage; if(!quoted) return await sock.sendMessage(from, {text: R.vqNeed}, {quoted:m})
          let viewOnce = quoted.viewOnceMessage || quoted.viewOnceMessageV2 || quoted.viewOnceMessageV2Extension; let msgToDownload = viewOnce? viewOnce.message : quoted; let vType = Object.keys(msgToDownload)[0]
          let buffer = await downloadMediaMessage({key: {remoteJid: from, id: m.message.extendedTextMessage.contextInfo.stanzaId, participant: m.message.extendedTextMessage.contextInfo.participant}, message: msgToDownload}, 'buffer', {}, {logger: P({level:'silent'}), reuploadRequest: sock.updateMediaMessage})
          let cap = msgToDownload[vType]?.caption || ""; if(vType==='imageMessage') await sock.sendMessage(from, {image: buffer, caption: R.vqOk+"\n\n"+cap}, {quoted:m}); else if(vType==='videoMessage') await sock.sendMessage(from, {video: buffer, caption: R.vqOk+"\n\n"+cap}, {quoted:m})
        }catch(e){ await sock.sendMessage(from, {text: "❌ Erreur VQ: "+e.message}, {quoted:m}) } return
      }

      if(isGroup && (cmd==="tagall" || cmd==="hidetag")){ if(!meta) return; await sock.sendMessage(from,{text:(cmd==="tagall"?R.tagall(txt):R.hidetag(txt))+"\n\n"+meta.participants.map(p=>`@${p.id.split('@')[0]}`).join(' '), mentions:meta.participants.map(p=>p.id)}) }

      // BAN / KICK
      if((cmd==="ban" || cmd==="kick")){
        if(!target) return await sock.sendMessage(from,{text:R.needTag})
        let tNum = target.replace(/[^0-9]/g,'')
        if(tNum===OWNER_NUMBER || db.amis[tNum]) return await sock.sendMessage(from,{text:R.antiOwner, mentions:[target]})
        if(db.protec.includes(target) || db.bro.includes(target)) return await sock.sendMessage(from,{text:`😈 IMPOSSIBLE! @${target.split('@')[0]} sous PROTEC/BRO!`, mentions:[target]})
        await sock.groupParticipantsUpdate(from,[target],"remove").catch(()=>{}); await sock.sendMessage(from,{text:R.ban(target), mentions:[target]})
      }
      if(cmd==="promote"){ if(!target) return await sock.sendMessage(from,{text:R.needTag}); if(!db.autoPromote[from]) db.autoPromote[from]=[]; if(!db.autoPromote[from].includes(target)) db.autoPromote[from].push(target); if(db.autoDemote[from]) db.autoDemote[from]=db.autoDemote[from].filter(x=>x!==target); saveDB(); await sock.groupParticipantsUpdate(from,[target],"promote").catch(()=>{}); await sock.sendMessage(from,{text:R.promote(target), mentions:[target]}) }

      // DEMOTE avec protection BRO
      if(cmd==="demote"){
        if(!target) return await sock.sendMessage(from,{text:R.needTag})
        let tNum = target.replace(/[^0-9]/g,'')
        if(tNum===OWNER_NUMBER) return await sock.sendMessage(from,{text:R.antiOwner, mentions:[target]})
        if(db.bro.includes(target)) return await sock.sendMessage(from,{text:`👑 IMPOSSIBLE! @${target.split('@')[0]} est BRO! Fais ₩nobro d'abord!`, mentions:[target]})
        if(!db.autoDemote[from]) db.autoDemote[from]=[]; if(!db.autoDemote[from].includes(target)) db.autoDemote[from].push(target); if(db.autoPromote[from]) db.autoPromote[from]=db.autoPromote[from].filter(x=>x!==target); saveDB(); await sock.groupParticipantsUpdate(from,[target],"demote").catch(()=>{}); await sock.sendMessage(from,{text:R.demote(target), mentions:[target]})
      }

      // BRO / NOBRO - OWNER ONLY
      if(cmd==="bro" && target){
        if(senderNum!==OWNER_NUMBER &&!isMe) return await sock.sendMessage(from,{text:R.onlyOwner})
        if(!db.bro.includes(target)) db.bro.push(target)
        if(!db.protec.includes(target)) db.protec.push(target)
        if(!db.autoPromote[from]) db.autoPromote[from]=[]
        if(!db.autoPromote[from].includes(target)) db.autoPromote[from].push(target)
        saveDB(); await sock.groupParticipantsUpdate(from,[target],"promote").catch(()=>{}); await sock.sendMessage(from,{text:R.bro(target), mentions:[target]})
      }
      if(cmd==="nobro" && target){
        if(senderNum!==OWNER_NUMBER &&!isMe) return await sock.sendMessage(from,{text:R.onlyOwner})
        db.bro=db.bro.filter(x=>x!==target); saveDB(); await sock.sendMessage(from,{text:R.nobro(target), mentions:[target]})
      }

      if(cmd==="protec" && target){ if(!db.protec.includes(target)) db.protec.push(target); if(!db.pro.includes(target)) db.pro.push(target); if(!db.saved.includes(target)) db.saved.push(target); saveDB(); await sock.sendMessage(from,{text:R.protec(target), mentions:[target]}) }
      if(cmd==="unprotect"){ if(senderNum!==OWNER_NUMBER &&!isMe) return await sock.sendMessage(from,{text:R.onlyOwner}); if(!target) return await sock.sendMessage(from,{text:R.needTag}); db.protec=db.protec.filter(x=>x!==target); db.pro=db.pro.filter(x=>x!==target); db.saved=db.saved.filter(x=>x!==target); saveDB(); await sock.sendMessage(from,{text:R.unprotec(target), mentions:[target]}) }
      if(cmd==="kaio"){ if(txt.includes("off")){ db.kaio=db.kaio.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.kaiooff}) } else { if(!db.kaio.includes(from)) db.kaio.push(from); saveDB(); await sock.sendMessage(from,{text:R.kaio}) } }
      if(cmd==="save" && target){ if(!db.saved.includes(target)) db.saved.push(target); saveDB(); await sock.sendMessage(from,{text:R.save(target), mentions:[target]}) }
      if(cmd==="unsave" && target){ db.saved=db.saved.filter(x=>x!==target); saveDB(); await sock.sendMessage(from,{text:R.unsave(target), mentions:[target]}) }
      if(cmd==="pro" && target){ if(!db.pro.includes(target)) db.pro.push(target); saveDB(); await sock.sendMessage(from,{text:R.pro(target), mentions:[target]}) }
      if(cmd==="chut" && target){ if(!db.chut[from]) db.chut[from]=[]; if(!db.chut[from].includes(target)) db.chut[from].push(target); saveDB(); await sock.sendMessage(from,{text:R.chut(target), mentions:[target]}) }
      if(cmd==="unchut" && target){ if(db.chut[from]) db.chut[from]=db.chut[from].filter(x=>x!==target); saveDB(); await sock.sendMessage(from,{text:R.unchut(target), mentions:[target]}) }
      if(cmd==="blockadmin" && target){ if(!db.blockadmin.includes(target)) db.blockadmin.push(target); saveDB(); await sock.sendMessage(from,{text:R.blockadmin(target), mentions:[target]}) }
      if(cmd==="unblockadmin" && target){ db.blockadmin=db.blockadmin.filter(x=>x!==target); saveDB(); await sock.sendMessage(from,{text:R.unblockadmin(target), mentions:[target]}) }
      if(cmd==="godmode"){ if(txt.includes("off")){ db.godmode=db.godmode.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.godmodeoff}) } else { if(!db.godmode.includes(from)) db.godmode.push(from); saveDB(); await sock.sendMessage(from,{text:R.godmode}) } }
      if(cmd==="antilink"){ if(txt.includes("off")){ db.antilink=db.antilink.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.antilinkoff}) } else { if(!db.antilink.includes(from)) db.antilink.push(from); saveDB(); await sock.sendMessage(from,{text:R.antilink}) } }
      if(cmd==="antisticker"){ if(txt.includes("off")){ db.antisticker=db.antisticker.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.antistickeroff}) } else { if(!db.antisticker.includes(from)) db.antisticker.push(from); saveDB(); await sock.sendMessage(from,{text:R.antisticker}) } }
      if(cmd==="antistatus"){ if(txt.includes("off")){ db.antistatus=db.antistatus.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.antistatusoff}) } else { if(!db.antistatus.includes(from)) db.antistatus.push(from); saveDB(); await sock.sendMessage(from,{text:R.antistatus}) } }
      if(cmd==="welcome"){ if(txt.includes("off")){ db.welcome=db.welcome.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.welcomeoff}) } else { if(!db.welcome.includes(from)) db.welcome.push(from); saveDB(); await sock.sendMessage(from,{text:R.welcome}) } }
      if(cmd==="ghost"){ if(txt.includes("off")){ db.ghost=db.ghost.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.ghostoff}) } else { if(!db.ghost.includes(from)) db.ghost.push(from); saveDB(); await sock.sendMessage(from,{text:R.ghost}) } }
      if(cmd==="pt"){ if(txt.includes("off")){ db.pt=db.pt.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.ptoff}) } else { if(!db.pt.includes(from)) db.pt.push(from); saveDB(); await sock.sendMessage(from,{text:R.pt}) } }
      if(cmd==="mute") await sock.sendMessage(from,{text:R.mute})
      if(cmd==="unmute") await sock.sendMessage(from,{text:R.unmute})
      if(cmd==="admin" && meta){ let admins=meta.participants.filter(p=>p.admin).map(p=>p.id); await sock.sendMessage(from,{text:R.admin(admins.map(a=>`@${a.split('@')[0]}`).join('\n')), mentions:admins}) }
      if(cmd==="info" && meta) await sock.sendMessage(from,{text:R.info(meta.subject, meta.participants.length)})
      if(["black","menu","b"].includes(cmd)){ if(fs.existsSync('./menu.jpg')) await sock.sendMessage(from,{image:fs.readFileSync('./menu.jpg'), caption:getMenu()},{quoted:m}); else await sock.sendMessage(from,{text:getMenu()},{quoted:m}) }
      if(cmd==="amis" && target){ if(senderNum!==OWNER_NUMBER &&!isMe) return; let n=target.replace(/[^0-9]/g,''); db.amis[n]=true; saveDB(); await sock.sendMessage(from,{text:R.amis(target), mentions:[target]}) }
      if(cmd==="noami" && target){ if(senderNum!==OWNER_NUMBER &&!isMe) return await sock.sendMessage(from,{text:R.onlyOwner}); let n=target.replace(/[^0-9]/g,''); delete db.amis[n]; saveDB(); await sock.sendMessage(from,{text:R.noami(target), mentions:[target]}) }
      if(cmd==="rdm") await sock.sendMessage(from,{text:R.rdm(Math.floor(Math.random()*100)+1)})
      if(cmd==="boy") await sock.sendMessage(from,{text:R.boy})
    })

    sock.ev.on('group-participants.update', async(update)=>{
      try{
        const { id, participants, action, author } = update
        const botNum = sock.user.id.split(':')[0].replace(/[^0-9]/g,'')
        const isBot = (jid) => jid.includes(botNum) || jid===sock.user.id
        if(action==='demote'){
          for(let demoted of participants){
            if(isBot(demoted)){
              await sock.groupParticipantsUpdate(id, [sock.user.id], "promote").catch(()=>{})
              if(author &&!isBot(author)){
                let aNum = author.replace(/[^0-9]/g,'')
                if(aNum!==OWNER_NUMBER &&!db.protec.includes(author) &&!db.bro.includes(author) &&!db.amis[aNum]){
                  await new Promise(r=>setTimeout(r,1200))
                  await sock.groupParticipantsUpdate(id, [author], "demote").catch(()=>{})
                  await sock.sendMessage(id, {text: `☠️ ANTI-DEMOTE! @${author.split('@')[0]} a osé retirer BLACK GOKU!`, mentions:[author]})
                }
              }
              continue
            }
            if(db.protec.includes(demoted) || db.bro.includes(demoted) || db.autoPromote[id]?.includes(demoted)){
              await sock.groupParticipantsUpdate(id, [demoted], "promote").catch(()=>{})
              if(author && author!==demoted){
                let aNum = author.replace(/[^0-9]/g,'')
                if(aNum!==OWNER_NUMBER &&!db.protec.includes(author) &&!db.bro.includes(author)){
                  await new Promise(r=>setTimeout(r,800))
                  await sock.groupParticipantsUpdate(id, [author], "demote").catch(()=>{})
                  await sock.sendMessage(id, {text: R.protecDemote(demoted, author), mentions:[demoted, author]})
                }
              }
            }
          }
        }
        if(action==='remove'){
          for(let removed of participants){
            if(isBot(removed)){
              if(!db.vengeance) db.vengeance={}; if(!db.vengeance[id]) db.vengeance[id]=[]
              if(author &&!db.vengeance[id].includes(author)){ db.vengeance[id].push(author); saveDB() }
              continue
            }
            let num = removed.replace(/[^0-9]/g,'')
            let isProtected = db.protec.includes(removed) || db.bro.includes(removed) || db.pro.includes(removed) || db.saved.includes(removed) || db.amis[num] || num===OWNER_NUMBER
            let isKaio = db.kaio.includes(id)
            if(isProtected || isKaio){
              let meta = await sock.groupMetadata(id).catch(()=>null)
              if(!meta) continue
              let botIsAdmin = meta.participants.find(p=>isBot(p.id))?.admin
              if(!botIsAdmin) continue
              let authorNum = author? author.replace(/[^0-9]/g,'') : ''
              let authorIsOwner = authorNum===OWNER_NUMBER || db.protec.includes(author) || db.bro.includes(author) || (author && db.amis[authorNum])
              if(!authorIsOwner){
                await sock.groupParticipantsUpdate(id, [removed], "add").catch(()=>{})
                await new Promise(r=>setTimeout(r,1000))
                if(author && author!==removed){
                  await sock.groupParticipantsUpdate(id, [author], "remove").catch(()=>{})
                  await sock.sendMessage(id, {text: R.protecTriggered(removed, author), mentions:[removed, author]})
                }
              }
            }
          }
        }
        if(action==='add'){
          let botAdded = participants.some(isBot)
          if(botAdded && db.vengeance?.[id]?.length){
            await new Promise(r=>setTimeout(r,2500))
            for(let attacker of db.vengeance[id]){
              await sock.groupParticipantsUpdate(id, [attacker], "remove").catch(()=>{})
              await sock.sendMessage(id, {text: `🔥 VENGEANCE! @${attacker.split('@')[0]} m'avait banni!`, mentions:[attacker]}).catch(()=>{})
            }
            db.vengeance[id]=[]; saveDB()
          }
        }
      }catch(e){ console.log("PROTEC ERR", e) }
    })
  }catch(e){ console.log("START ERROR", e); setTimeout(startBot,5000) }
}
startBot()
app.listen(PORT, '0.0.0.0', ()=>console.log("BLACK GOKU LIVE "+PORT))
