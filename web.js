process.on('uncaughtException', (e) => { if (e.message && e.message.includes('Bad MAC')) return; })
process.on('unhandledRejection', (e) => { if (e?.message && e.message.includes('Bad MAC')) return; })

const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, Browsers, downloadMediaMessage, DisconnectReason } = require('@whiskeysockets/baileys')
const P = require('pino')
const fs = require('fs')
const express = require('express')
const NodeCache = require('node-cache')
const app = express()
const PORT = process.env.PORT || 10000
if (!fs.existsSync('auth2')) fs.mkdirSync('auth2', { recursive: true })

function restoreSession(){
  const sid = (process.env.SESSION_ID || "").trim()
  if (!sid) return
  if (fs.existsSync('auth2/creds.json')) { try{ if(fs.readFileSync('auth2/creds.json','utf8').length > 20) return }catch{} }
  try { let data = sid.length > 100 && !sid.trim().startsWith('{') ? Buffer.from(sid, 'base64').toString() : sid; if(data.includes('{')) fs.writeFileSync('auth2/creds.json', data) } catch(e){}
}
restoreSession()

const OWNER_NUMBER = process.env.OWNER_NUMBER || "5551982215198"
const PREFIX = "₩"
const DB_FILE = './black_db.json'
const msgRetryCounterCache = new NodeCache({ stdTTL: 0, checkperiod: 0 })
const groupCache = new NodeCache({ stdTTL: 5 * 60, useClones: false })
let db = { amis:{}, saved:[], pro:[], protec:[], bro:[], angel:[], chut:{}, blockadmin:[], godmode:[], kaio:[], antilink:[], antisticker:[], antistatus:[], welcome:[], pt:[], ghost:[], boy:[], muted:[], autoPromote:{}, autoDemote:{}, vengeance:{}, ownerLids:[], ghostCache:{} }
if (fs.existsSync(DB_FILE)) { try { db = { ...db, ...JSON.parse(fs.readFileSync(DB_FILE)) } } catch{} }
const saveDB = () => { try { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)) } catch{} }

let sock, status = "Demarrage...", lastCode = "pas encore", lastQR = null, groupStats = {}, presenceInterval = null

const menuFR = `꧁༒☬ BLACK GOKU H24 ☬༒꧂
┏━ ✦ MEMBRES ✦ ━┓
┃ ₩tagall 
┃ ₩hidetag 
┃ ₩kick / ₩ban @m
┃ ₩promote / ₩demote @m
┃ ₩mute / ₩unmute
┃ ₩admin
┃ ₩info / ₩stats
┗━━━━━━━━━━━━━━┛
┏━ ✦ PUNITIONS ✦ ━┓
┃ ₩chut @m / ₩unchut @m
┃ ₩blockadmin @m / ₩unblockadmin @m
┃ ₩goat - HAKAI 
┗━━━━━━━━━━━━━━┛
┏━ ✦ PROTECTION ✦ ━┓
┃ ₩save / ₩unsave @m
┃ ₩pro @m
┃ ₩protec / ₩unprotect @m
┃ ₩bro / ₩nobro @m
┃ ₩boy on/off / @m
┃ ₩godmode /off
┃ ₩kaio /off
┃ ₩antilink /off
┃ ₩antisticker /off
┃ ₩antistatus /off
┃ ₩welcome /off
┗━━━━━━━━━━━━━━┛
┏━ ✦ FUN & OUTILS ✦ ━┓
┃ ₩sticker / ₩s
┃ ₩vq - view once
┃ ₩rdm - random
┃ ₩ghost /off
┃ ₩pt /off
┗━━━━━━━━━━━━━━┛
┏━ ✦ OWNER ✦ ━┓
┃ ₩amis @m / ₩noami @m
┗━━━━━━━━━━━━━━┛
*BLACK GOKU H24*`
const menuPT = menuFR

const R_FR = {
  noPerm:"Seul BLACK GOKU peut utiliser ce bot 👑", onlyGoat:"👑💀 SEUL BLACK GOKU PEUT UTILISER ₩goat - HAKAI INTERDIT AUX MORTELS!", needTag:"😈 TAG UN MORTEL! @m",
  ban:(j)=>`💀 HAKAI! @${j.split('@')[0]} effacé.`, kick:(j)=>`💀 @${j.split('@')[0]} expulsé.`,
  promote:(j)=>`👑 @${j.split('@')[0]} élevé admin.`, demote:(j)=>`@${j.split('@')[0]} n'est plus admin.`,
  mute:"🤫 *GROUPE FERMÉ!* 🔒", unmute:"🔊 *GROUPE OUVERT!* 🔓",
  tagall:(t)=>`🔥 *BLACK GOKU VOUS INVOQUE!* 🔥\n\n${t||"Tous!"}`, hidetag:(t)=>`👻 Invocation...\n${t||"Marqués."}`,
  chut:(j)=>`🔇 @${j.split('@')[0]} au Néant.`, unchut:(j)=>`🔓 @${j.split('@')[0]} peut parler.`,
  blockadmin:(j)=>`⛓️ @${j.split('@')[0]} POUVOIRS SCELLÉS!`, unblockadmin:(j)=>`🔓 @${j.split('@')[0]} chaînes brisées.`,
  save:(j)=>`🛡️ @${j.split('@')[0]} Intouchable.`, unsave:(j)=>`🛡️ Marque retirée @${j.split('@')[0]}.`,
  pro:(j)=>`✨ @${j.split('@')[0]} béni PRO.`, protec:(j)=>`👑🔥 *PROTEC* 🔥👑\n\n@${j.split('@')[0]} Protégé.`, unprotec:(j)=>`💀 PROTEC retirée @${j.split('@')[0]}.`,
  bro:(j)=>`👑🔥 *BRO* 🔥👑\n\n@${j.split('@')[0]} est mon BRO!`, nobro:(j)=>`💀 BRO retiré @${j.split('@')[0]}.`,
  godmode:"☯️🔥 *MODE ULTIME BLACK GOKU ACTIVÉ!*", godmodeoff:"💀 MODE ULTIME OFF.",
  kaio:"🔥 *KAIO-KEN ON!*", kaiooff:"KAIO OFF.",
  antilink:"🔗 *ANTILINK TOTAL ON!* Bloque tout + chaines", antilinkoff:"ANTILINK OFF.",
  antisticker:"🖼️ *ANTISTICKER ON!*", antistickeroff:"ANTISTICKER OFF.",
  antistatus:"👁️ *ANTISTATUS ON!*", antistatusoff:"ANTISTATUS OFF.",
  welcome:"👋 *WELCOME ON - avec photo + anti-spam*", welcomeoff:"WELCOME OFF.",
  welcomeMsg:(j,g)=>`Bienvenue @${j.split('@')[0]} 👋\n\nBienvenue dans *${g}* !\nJe suis Black Goku, comporte toi bien 😁✨`,
  byeMsg:(j,g)=>`À plus @${j.split('@')[0]} 👋\n\nIl a quitté *${g}* 🙏\nOn espère te revoir bientôt !`,
  vqOk:"👁️🔥 *VUE UNIQUE DÉVOILÉE* 🔥👁️", vqNeed:"😈 Réponds à une vue unique avec ₩vq!",
  ghost:"👻💀 *GHOST DIABLE ON*", ghostoff:"👻 GHOST OFF.",
  boyOn:"👼✨ *ANGE PROTECTEUR ACTIVÉ!* ✨👼", boyOff:"👼 ANGE MODE OFF.", boyProtect:(j)=>`👼✨ @${j.split('@')[0]} est maintenant ANGE! INTOUCHABLE! ✨`,
  pt:"🇧🇷 PT ON!", ptoff:"🇫🇷 PT OFF!",
  amis:(j)=>`✅ @${j.split('@')[0]} AMI!`, noami:(j)=>`❌💀 @${j.split('@')[0]} BANNI!`,
  goatStart:(n)=>`꧁༒☬ *BLACK GOKU - GOAT* ☬༒꧂\n\n🔥 *${n} ÂMES. HAKAI!* 🔥`,
  goatEnd:`꧁༒ *C'EST FINI* ༒꧂\n\n👑 *BLACK GOKU A PARLÉ.* ☠️`
}
const R_PT = {
  noPerm:"Só o BLACK GOKU pode usar este bot 👑", onlyGoat:"👑💀 SÓ BLACK GOKU PODE USAR ₩goat!", needTag:"😈 MARCA UM MORTAL! @m",
  ban:(j)=>`💀 HAKAI! @${j.split('@')[0]} apagado.`, kick:(j)=>`💀 @${j.split('@')[0]} expulso.`,
  promote:(j)=>`👑 @${j.split('@')[0]} virou admin.`, demote:(j)=>`@${j.split('@')[0]} não é mais admin.`,
  mute:"🤫 *GRUPO FECHADO!* 🔒", unmute:"🔊 *GRUPO ABERTO!* 🔓",
  tagall:(t)=>`🔥 *BLACK GOKU CONVOCA VOCÊS!* 🔥\n\n${t||"Todos!"}`, hidetag:(t)=>`👻 Invocação...\n${t||"Marcados."}`,
  chut:(j)=>`🔇 @${j.split('@')[0]} no Vazio.`, unchut:(j)=>`🔓 @${j.split('@')[0]} pode falar.`,
  blockadmin:(j)=>`⛓️ @${j.split('@')[0]} PODERES SELADOS!`, unblockadmin:(j)=>`🔓 @${j.split('@')[0]} correntes quebradas.`,
  save:(j)=>`🛡️ @${j.split('@')[0]} Intocável.`, unsave:(j)=>`🛡️ Marca removida @${j.split('@')[0]}.`,
  pro:(j)=>`✨ @${j.split('@')[0]} abençoado PRO.`, protec:(j)=>`👑🔥 *PROTEC* 🔥👑\n\n@${j.split('@')[0]} Protegido.`, unprotec:(j)=>`💀 PROTEC removida @${j.split('@')[0]}.`,
  bro:(j)=>`👑🔥 *BRO* 🔥👑\n\n@${j.split('@')[0]} é meu BRO!`, nobro:(j)=>`💀 BRO removido @${j.split('@')[0]}.`,
  godmode:"☯️🔥 *MODO ULTIMATE ATIVADO!*", godmodeoff:"💀 MODO ULTIMATE OFF.",
  kaio:"🔥 *KAIO-KEN ON!*", kaiooff:"KAIO OFF.",
  antilink:"🔗 *ANTILINK ON!*", antilinkoff:"ANTILINK OFF.",
  antisticker:"🖼️ *ANTISTICKER ON!*", antistickeroff:"ANTISTICKER OFF.",
  antistatus:"👁️ *ANTISTATUS ON!*", antistatusoff:"ANTISTATUS OFF.",
  welcome:"👋 *WELCOME ON*", welcomeoff:"WELCOME OFF.",
  welcomeMsg:(j,g)=>`Bem-vindo @${j.split('@')[0]} 👋\n\nBem-vindo em *${g}* !\nEu sou Black Goku, se comporte bem 😁✨`,
  byeMsg:(j,g)=>`Até logo @${j.split('@')[0]} 👋\n\nSaiu de *${g}* 🙏 Esperamos te ver de novo !`,
  vqOk:"👁️🔥 *VIEW ONCE REVELADA* 🔥👁️", vqNeed:"😈 Responda um view once com ₩vq!",
  ghost:"👻💀 *GHOST DIABO ON*", ghostoff:"👻 GHOST OFF.",
  boyOn:"👼✨ *ANJO PROTETOR ATIVADO!*", boyOff:"👼 ANJO OFF.", boyProtect:(j)=>`👼✨ @${j.split('@')[0]} é ANJO!`,
  pt:"🇧🇷 PT ON!", ptoff:"🇫🇷 PT OFF!",
  amis:(j)=>`✅ @${j.split('@')[0]} AMIGO!`, noami:(j)=>`❌ @${j.split('@')[0]} banido!`,
  goatStart:(n)=>`꧁༒☬ *BLACK GOKU - GOAT* ☬༒꧂\n\n🔥 *${n} ALMAS. HAKAI!* 🔥`,
  goatEnd:`꧁༒ *ACABOU* ༒꧂\n\n💀 *BLACK GOKU FALOU.* ☠️`
}
const getR = (from) => db.pt.includes(from) ? R_PT : R_FR
const getMenu = (from) => db.pt.includes(from) ? menuPT : menuFR

function isProtected(jid){
  if(!jid) return false
  const num = jid.replace(/[^0-9]/g,'')
  if(num === OWNER_NUMBER) return true
  if(num.includes("1982215198")) return true
  if(db.ownerLids.includes(jid)) return true
  if(db.bro.includes(jid)) return true
  if(db.protec.includes(jid)) return true
  if(db.angel.includes(jid)) return true
  if(db.saved.includes(jid)) return true
  return false
}

app.get('/', (req,res)=> res.send(`<h1>${status}</h1><p>CODE: ${lastCode}</p><h2>BLACK GOKU V15 ONLINE</h2><a href="/pair?num=${OWNER_NUMBER}">PAIR</a> | <a href="/qr">QR</a> | <a href="/clear">CLEAR</a>`))
app.get('/ping', (req,res)=> res.status(200).send('pong - '+Date.now()))
app.get('/qr', (req,res)=>{ if(!lastQR) return res.send(`<h1>Pas de QR - ${status}</h1>`); res.send(`<div style="text-align:center"><h1>SCAN QR</h1><img src="https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(lastQR)}"/></div>`) })
app.get('/clear', (req,res)=>{ try{ if(fs.existsSync('auth2')) fs.rmSync('auth2',{recursive:true,force:true}); fs.mkdirSync('auth2',{recursive:true}); lastQR=null; if(presenceInterval) clearInterval(presenceInterval); res.send('CLEAR OK') }catch(e){ res.send(e.message) } })
app.get('/pair', async(req,res)=>{ let num=(req.query.num||'').replace(/[^0-9]/g,'')||OWNER_NUMBER; try{ if(!sock) return res.send('Bot demarre...'); await new Promise(r=>setTimeout(r,2000)); let code=await sock.requestPairingCode(num); lastCode=code; res.send(`<h1 style="font-size:60px;text-align:center">${code}</h1>`) }catch(e){ res.send('Erreur: '+e.message) } })

async function startBot(){
  try{
    const { version } = await fetchLatestBaileysVersion().catch(()=>({version:[2,3000,1015901307]}))
    const { state, saveCreds } = await useMultiFileAuthState('auth2')
    sock = makeWASocket({ version, auth:{creds:state.creds, keys:makeCacheableSignalKeyStore(state.keys, P({level:'silent'}))}, logger:P({level:'silent'}), browser: Browsers.ubuntu("Chrome"), msgRetryCounterCache, getMessage: async()=>undefined, markOnlineOnConnect:true, syncFullHistory:false, shouldSyncHistoryMessage:()=>false, keepAliveIntervalMs:15000 })
    sock.ev.on('creds.update', saveCreds)
    sock.ev.on('connection.update', async(u)=>{ const { connection, lastDisconnect, qr } = u; if(qr) lastQR=qr; if(connection==='open'){ status="ACTIF ✅"; lastQR=null; if(presenceInterval) clearInterval(presenceInterval); presenceInterval=setInterval(()=>{ try{ sock.sendPresenceUpdate('available') }catch{} },15000) } if(connection==='close'){ if(presenceInterval) clearInterval(presenceInterval); const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut; if(shouldReconnect) setTimeout(startBot,10000) } })

    sock.ev.on('messages.upsert', async({messages, type})=>{
      if(type!=='notify') return
      for (let m of messages) {
        if(!m?.message || !m.key?.id) continue
        const from=m.key.remoteJid; const sender = m.key.participant || m.key.remoteJid || from; 
        let text = m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || m.message.videoMessage?.caption || "";
        const isGroup = from.endsWith('@g.us'); const isMe = m.key.fromMe;
        const R = getR(from);
        if(!groupStats[from]) groupStats[from] = { total: 0 }; groupStats[from].total++;
        if(isGroup && db.ghost.includes(from) && !isMe && text){ if(!db.ghostCache[from]) db.ghostCache[from]=[]; db.ghostCache[from].push({sender, text, time:Date.now()}); if(db.ghostCache[from].length>200) db.ghostCache[from].shift(); saveDB(); }
        if(isGroup && !isMe){
          try{
            if(db.antilink.includes(from)){ 
              let linkRegex = /(https?:\/\/|www\.|chat\.whatsapp\.com|wa\.me\/|t\.me\/|instagram\.com|youtube\.com|youtu\.be|whatsapp\.com\/channel|whatsapp\.com\/newsletter|\.com\/channel)/i; 
              if(linkRegex.test(text)){ await sock.sendMessage(from, { delete: { remoteJid: from, fromMe: false, id: m.key.id, participant: sender } }).catch(()=>{}); continue; } 
            }
            if(db.antisticker.includes(from) && m.message.stickerMessage){ await sock.sendMessage(from, { delete: { remoteJid: from, fromMe: false, id: m.key.id, participant: sender } }).catch(()=>{}); continue; }
            if(db.chut[from]?.includes(sender)){ await sock.sendMessage(from, { delete: { remoteJid: from, fromMe: false, id: m.key.id, participant: sender } }).catch(()=>{}); continue; }
          }catch{}
        }
        if(!text) continue; text=text.trim(); if(!text.startsWith(PREFIX)) continue
        const args=text.slice(1).trim().split(/ +/); const cmd=args[0].toLowerCase(); const txt=args.slice(1).join(' '); const mentioned=m.message.extendedTextMessage?.contextInfo?.mentionedJid||[]; const multi = mentioned.length ? mentioned : []; 
        let meta = null; if(isGroup){ meta = groupCache.get(from); if(!meta){ meta = await sock.groupMetadata(from).catch(()=>null); if(meta) groupCache.set(from, meta) } }
        const senderNum = sender.replace(/[^0-9]/g,'');
        const isRealOwner = (() => { if(isMe) return true; if(senderNum === OWNER_NUMBER) return true; if(senderNum.includes("1982215198")) return true; if(sender.includes('@lid') && (db.ownerLids.includes(sender) || db.ownerLids.length===0)) return true; return false; })();
        const isOwnerLid = (() => { if(isRealOwner) return true; if(db.amis[senderNum]) return true; if(db.amis[sender]) return true; if(db.ownerLids && db.ownerLids.includes(sender)) return true; return false; })();
        if(isRealOwner && sender.includes('@lid') && !db.ownerLids.includes(sender)){ db.ownerLids.push(sender); saveDB(); }

        if(["black","menu","b"].includes(cmd)){ if(!isOwnerLid){ await sock.sendMessage(from, {text: R.noPerm}, {quoted:m}); continue } 
          try{ if(fs.existsSync('./menu.jpg')){ let menuImg = fs.readFileSync('./menu.jpg'); await sock.sendMessage(from,{image: menuImg, caption: getMenu(from)},{quoted:m}); } else { await sock.sendMessage(from,{text:getMenu(from)},{quoted:m}); } }catch{ await sock.sendMessage(from,{text:getMenu(from)},{quoted:m}); } continue }

        if(cmd==="amis" || cmd==="noami"){
          if(!isRealOwner){ await sock.sendMessage(from, {text: R_FR.onlyGoat.replace('goat','amis/noami')}, {quoted:m}); continue; }
          if(cmd==="amis"){ if(!multi.length) { await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } for(let t of multi){ let num=t.replace(/[^0-9]/g,''); db.amis[num]=true; db.amis[t]=true; } saveDB(); await sock.sendMessage(from,{text:R.amis(multi[0]), mentions:multi},{quoted:m}); continue }
          if(cmd==="noami"){ if(!multi.length) { await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } for(let t of multi){ let num=t.replace(/[^0-9]/g,''); delete db.amis[num]; delete db.amis[t]; db.ownerLids=db.ownerLids.filter(x=> x!==t && x.replace(/[^0-9]/g,'')!==num); db.bro=db.bro.filter(x=> x!==t); db.protec=db.protec.filter(x=> x!==t); db.angel=db.angel.filter(x=> x!==t); db.saved=db.saved.filter(x=> x!==t); } saveDB(); await sock.sendMessage(from,{text:R.noami(multi[0]), mentions:multi},{quoted:m}); continue }
        }

        if(cmd==="goat"){ if(!isRealOwner){ await sock.sendMessage(from,{text:R.onlyGoat}, {quoted:m}); continue; } if(!meta) continue; const botNum = sock.user.id.replace(/[^0-9]/g,''); let toKick = meta.participants.filter(p=>{ if(isProtected(p.id)) return false; let num=p.id.replace(/[^0-9]/g,''); if(p.id===sock.user.id) return false; if(num===botNum) return false; if(p.id===sender) return false; return true; }).map(p=>p.id); if(toKick.length===0) { await sock.sendMessage(from,{text:"💀 Personne."}, {quoted:m}); continue; } try{ if(fs.existsSync('./goat.jpg')){ let goatImg = fs.readFileSync('./goat.jpg'); await sock.sendMessage(from,{image: goatImg, caption: R.goatStart(toKick.length.toString())}, {quoted:m}); } else { await sock.sendMessage(from,{text:R.goatStart(toKick.length.toString())}, {quoted:m}); } }catch{ await sock.sendMessage(from,{text:R.goatStart(toKick.length.toString())}, {quoted:m}); } for(let i=0;i<toKick.length;i+=3){ let batch=toKick.slice(i,i+3); await Promise.all(batch.map(id=>sock.groupParticipantsUpdate(from,[id],"remove").catch(()=>{}))); await new Promise(r=>setTimeout(r,800)) } try{ if(fs.existsSync('./goat.jpg')){ let goatImg2 = fs.readFileSync('./goat.jpg'); await sock.sendMessage(from,{image: goatImg2, caption: R.goatEnd}, {quoted:m}); } else { await sock.sendMessage(from,{text:R.goatEnd}, {quoted:m}); } }catch{ await sock.sendMessage(from,{text:R.goatEnd}, {quoted:m}); } continue }

        if(!isOwnerLid){ await sock.sendMessage(from, {text: R.noPerm}, {quoted:m}); continue }

        if(["ban","kick","demote","chut","blockadmin"].includes(cmd)){
          let blocked = multi.filter(j => isProtected(j))
          if(blocked.length > 0){ await sock.sendMessage(from,{text:`⛔ @${blocked[0].split('@')[0]} est protégé par BLACK GOKU!`, mentions:blocked},{quoted:m}); continue }
        }

        if(cmd==="sticker" || cmd==="s"){ try{ let q = m.message.extendedTextMessage?.contextInfo?.quotedMessage; let buffer; if(q?.imageMessage || q?.videoMessage){ buffer = await downloadMediaMessage({key: {remoteJid: from, id: m.message.extendedTextMessage.contextInfo.stanzaId, participant: m.message.extendedTextMessage.contextInfo.participant}, message: q}, 'buffer', {}, {logger: P({level:'silent'}), reuploadRequest: sock.updateMediaMessage}); } else { let type = Object.keys(m.message)[0]; if(type==='imageMessage' || type==='videoMessage'){ buffer = await downloadMediaMessage({key: m.key, message: {[type]: m.message[type]}}, 'buffer', {}, {logger: P({level:'silent'}), reuploadRequest: sock.updateMediaMessage}); } } if(buffer) await sock.sendMessage(from, {sticker: buffer}, {quoted:m}); }catch{} continue }
        if(cmd==="vq"){ try{ let quoted = m.message.extendedTextMessage?.contextInfo?.quotedMessage; if(!quoted) { await sock.sendMessage(from, {text: R.vqNeed}, {quoted:m}); continue; } let viewOnce = quoted.viewOnceMessage || quoted.viewOnceMessageV2; let msgToDownload = viewOnce? viewOnce.message : quoted; let vType = Object.keys(msgToDownload)[0]; let buffer = await downloadMediaMessage({key: {remoteJid: from, id: m.message.extendedTextMessage.contextInfo.stanzaId, participant: m.message.extendedTextMessage.contextInfo.participant}, message: msgToDownload}, 'buffer', {}, {logger: P({level:'silent'}), reuploadRequest: sock.updateMediaMessage}); let cap = msgToDownload[vType]?.caption || ""; if(vType==='imageMessage') await sock.sendMessage(from, {image: buffer, caption: R.vqOk+"\n\n"+cap}, {quoted:m}); else if(vType==='videoMessage') await sock.sendMessage(from, {video: buffer, caption: R.vqOk+"\n\n"+cap}, {quoted:m}); }catch{} continue }

        if(isGroup && (cmd==="tagall" || cmd==="hidetag")){ if(!meta) continue; await sock.sendMessage(from,{text:(cmd==="tagall"?R.tagall(txt):R.hidetag(txt))+"\n\n"+meta.participants.map(p=>`@${p.id.split('@')[0]}`).join(' '), mentions:meta.participants.map(p=>p.id)}); continue }
        if(cmd==="ban" || cmd==="kick"){ if(!multi.length) { await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } for(let t of multi){ if(isProtected(t)) continue; await sock.groupParticipantsUpdate(from,[t],"remove").catch(()=>{}); } await sock.sendMessage(from,{text:R.ban(multi[0]), mentions:multi},{quoted:m}); continue }
        if(cmd==="promote"){ if(!multi.length) { await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } for(let t of multi) await sock.groupParticipantsUpdate(from,[t],"promote").catch(()=>{}); saveDB(); await sock.sendMessage(from,{text:R.promote(multi[0]), mentions:multi},{quoted:m}); continue }
        if(cmd==="demote"){ if(!multi.length) { await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } for(let t of multi){ if(isProtected(t)) continue; await sock.groupParticipantsUpdate(from,[t],"demote").catch(()=>{}); } await sock.sendMessage(from,{text:R.demote(multi[0]), mentions:multi},{quoted:m}); continue }
        if(cmd==="bro"){ if(!multi.length) { await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } for(let t of multi){ if(!db.bro.includes(t)) db.bro.push(t); if(!db.protec.includes(t)) db.protec.push(t); } saveDB(); await sock.sendMessage(from,{text:R.bro(multi[0]), mentions:multi},{quoted:m}); continue }
        if(cmd==="nobro"){ if(!multi.length) { await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } for(let t of multi) db.bro=db.bro.filter(x=>x!==t); saveDB(); await sock.sendMessage(from,{text:R.nobro(multi[0]), mentions:multi},{quoted:m}); continue }
        if(cmd==="protec"){ if(!multi.length) { await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } for(let t of multi) if(!db.protec.includes(t)) db.protec.push(t); saveDB(); await sock.sendMessage(from,{text:R.protec(multi[0]), mentions:multi},{quoted:m}); continue }
        if(cmd==="unprotect"){ if(!multi.length) { await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } for(let t of multi) db.protec=db.protec.filter(x=>x!==t); saveDB(); await sock.sendMessage(from,{text:R.unprotec(multi[0]), mentions:multi},{quoted:m}); continue }
        if(cmd==="save"){ if(!multi.length) { await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } for(let t of multi) if(!db.saved.includes(t)) db.saved.push(t); saveDB(); await sock.sendMessage(from,{text:R.save(multi[0]), mentions:multi},{quoted:m}); continue }
        if(cmd==="unsave"){ if(!multi.length) { await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } for(let t of multi) db.saved=db.saved.filter(x=>x!==t); saveDB(); await sock.sendMessage(from,{text:R.unsave(multi[0]), mentions:multi},{quoted:m}); continue }
        if(cmd==="pro"){ if(!multi.length) { await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } for(let t of multi) if(!db.pro.includes(t)) db.pro.push(t); saveDB(); await sock.sendMessage(from,{text:R.pro(multi[0]), mentions:multi},{quoted:m}); continue }
        if(cmd==="chut"){ if(!multi.length) { await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } if(!db.chut[from]) db.chut[from]=[]; for(let t of multi) if(!db.chut[from].includes(t)) db.chut[from].push(t); saveDB(); await sock.sendMessage(from,{text:R.chut(multi[0]), mentions:multi},{quoted:m}); continue }
        if(cmd==="unchut"){ if(!multi.length) { await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } if(db.chut[from]) for(let t of multi) db.chut[from]=db.chut[from].filter(x=>x!==t); saveDB(); await sock.sendMessage(from,{text:R.unchut(multi[0]), mentions:multi},{quoted:m}); continue }
        if(cmd==="blockadmin"){ if(!multi.length) { await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } for(let t of multi) if(!db.blockadmin.includes(t)) db.blockadmin.push(t); saveDB(); await sock.sendMessage(from,{text:R.blockadmin(multi[0]), mentions:multi},{quoted:m}); continue }
        if(cmd==="unblockadmin"){ if(!multi.length) { await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } for(let t of multi) db.blockadmin=db.blockadmin.filter(x=>x!==t); saveDB(); await sock.sendMessage(from,{text:R.unblockadmin(multi[0]), mentions:multi},{quoted:m}); continue }
        if(cmd==="godmode"){ if(txt.includes("off")){ db.godmode=db.godmode.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.godmodeoff},{quoted:m}) } else { if(!db.godmode.includes(from)) db.godmode.push(from); saveDB(); await sock.sendMessage(from,{text:R.godmode},{quoted:m}) } continue }
        if(cmd==="kaio"){ if(txt.includes("off")){ db.kaio=db.kaio.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.kaiooff},{quoted:m}) } else { if(!db.kaio.includes(from)) db.kaio.push(from); saveDB(); await sock.sendMessage(from,{text:R.kaio},{quoted:m}) } continue }
        if(cmd==="antilink"){ if(txt.includes("off")){ db.antilink=db.antilink.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.antilinkoff},{quoted:m}) } else { if(!db.antilink.includes(from)) db.antilink.push(from); saveDB(); await sock.sendMessage(from,{text:R.antilink},{quoted:m}) } continue }
        if(cmd==="antisticker"){ if(txt.includes("off")){ db.antisticker=db.antisticker.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.antistickeroff},{quoted:m}) } else { if(!db.antisticker.includes(from)) db.antisticker.push(from); saveDB(); await sock.sendMessage(from,{text:R.antisticker},{quoted:m}) } continue }
        if(cmd==="antistatus"){ if(txt.includes("off")){ db.antistatus=db.antistatus.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.antistatusoff},{quoted:m}) } else { if(!db.antistatus.includes(from)) db.antistatus.push(from); saveDB(); await sock.sendMessage(from,{text:R.antistatus},{quoted:m}) } continue }
        if(cmd==="welcome"){ if(txt.includes("off")){ db.welcome=db.welcome.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.welcomeoff},{quoted:m}) } else { if(!db.welcome.includes(from)) db.welcome.push(from); saveDB(); await sock.sendMessage(from,{text:R.welcome},{quoted:m}) } continue }
        if(cmd==="ghost"){ if(txt.includes("off")){ db.ghost=db.ghost.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.ghostoff},{quoted:m}) } else { if(!db.ghost.includes(from)) db.ghost.push(from); saveDB(); await sock.sendMessage(from,{text:R.ghost},{quoted:m}) } continue }
        if(cmd==="pt"){ if(txt.includes("off")){ db.pt=db.pt.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R_FR.ptoff},{quoted:m}) } else { if(!db.pt.includes(from)) db.pt.push(from); saveDB(); await sock.sendMessage(from,{text:R_PT.pt},{quoted:m}) } continue }
        if(cmd==="boy"){ if(txt.includes("off")){ db.boy=db.boy.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.boyOff},{quoted:m}); continue } if(txt.includes("on") || !multi.length){ if(!db.boy.includes(from)) db.boy.push(from); saveDB(); await sock.sendMessage(from,{text:R.boyOn},{quoted:m}); continue } for(let t of multi){ if(!db.angel.includes(t)) db.angel.push(t); if(!db.protec.includes(t)) db.protec.push(t); if(!db.bro.includes(t)) db.bro.push(t); if(!db.saved.includes(t)) db.saved.push(t); } saveDB(); await sock.sendMessage(from,{text:R.boyProtect(multi[0]), mentions:multi},{quoted:m}); continue }
        if(cmd==="mute"){ try{ await sock.groupSettingUpdate(from, 'announcement'); await sock.sendMessage(from,{text:R.mute},{quoted:m}) }catch{ await sock.sendMessage(from,{text:"❌ Admin?"},{quoted:m}) } continue }
        if(cmd==="unmute"){ try{ await sock.groupSettingUpdate(from, 'not_announcement'); await sock.sendMessage(from,{text:R.unmute},{quoted:m}) }catch{ await sock.sendMessage(from,{text:"❌ Admin?"},{quoted:m}) } continue }
        if(cmd==="admin" && meta){ let admins=meta.participants.filter(p=>p.admin).map(p=>p.id); let list = admins.map((a,i)=>`${i+1}. @${a.split('@')[0]}`).join('\n'); await sock.sendMessage(from,{text:`👑 ADMINS (${admins.length})\n\n${list}`, mentions:admins},{quoted:m}); continue }
        if(cmd==="info" && meta){ await sock.sendMessage(from,{text:`📛 ${meta.subject}\n👥 ${meta.participants.length} membres`},{quoted:m}); continue }
        if(cmd==="stats"){ let h=Math.floor(process.uptime()/3600); await sock.sendMessage(from,{text:`⏱️ Allumé depuis ${h}h\nBLACK GOKU H24`},{quoted:m}); continue }
        if(cmd==="rdm" && meta){ let pick=meta.participants[Math.floor(Math.random()*meta.participants.length)]; await sock.sendMessage(from,{text:`🎲 @${pick.id.split('@')[0]} choisi!`, mentions:[pick.id]},{quoted:m}); continue }
      }
    })

    sock.ev.on('group-participants.update', async(update)=>{
      try{
        const { id, participants, action, author } = update
        groupCache.del(id); const R = getR(id);
        const botNum = sock.user.id.split(':')[0].replace(/[^0-9]/g,''); 
        const isBot = (jid) => jid.includes(botNum)
        let filtered = participants.filter(p=> !isBot(p))
        if(filtered.length===0) return

        if(action==='add' && db.welcome.includes(id)){ 
          try{
            let gName="ce groupe"; try{ gName=(await sock.groupMetadata(id)).subject }catch{}
            if(filtered.length===1){
              let p = filtered[0]
              let ppUrl = await sock.profilePictureUrl(p, 'image').catch(()=> null)
              let caption = R.welcomeMsg(p, gName)
              if(ppUrl){
                await sock.sendMessage(id, { image: { url: ppUrl }, caption, mentions:[p] }).catch(()=>{})
              } else {
                await sock.sendMessage(id, { text: caption, mentions:[p] }).catch(()=>{})
              }
            } else {
              let mentions = filtered
              let list = mentions.map(j=>`@${j.split('@')[0]}`).join(', ')
              let caption = `Bienvenue à tous 👋\n\n${list}\n\nBienvenue à vous ${mentions.length} dans *${gName}* !\nJe suis Black Goku, comportez vous bien 😁✨`
              await sock.sendMessage(id, { text: caption, mentions }).catch(()=>{})
            }
          }catch{}
        }

        if(action==='remove' && db.welcome.includes(id)){ 
          try{
            await new Promise(r=>setTimeout(r,800))
            let gName="ce groupe"; try{ gName=(await sock.groupMetadata(id)).subject }catch{}
            if(filtered.length===1){
              let p = filtered[0]
              let ppUrl = await sock.profilePictureUrl(p, 'image').catch(()=> null)
              let caption = R.byeMsg(p, gName)
              if(ppUrl){
                await sock.sendMessage(id, { image: { url: ppUrl }, caption, mentions:[p] }).catch(()=>{})
              } else {
                await sock.sendMessage(id, { text: caption, mentions:[p] }).catch(()=>{})
              }
            } else {
              let mentions = filtered
              let list = mentions.map(j=>`@${j.split('@')[0]}`).join(', ')
              let caption = `À plus à tous 👋\n\n${list}\n\nIls ont quitté *${gName}* 🙏\nOn espère vous revoir bientôt !`
              await sock.sendMessage(id, { text: caption, mentions }).catch(()=>{})
            }
          }catch{}
        }

        if(db.boy.includes(id) && action==='remove'){
          for(let removed of filtered){ 
            if(db.angel.includes(removed) || db.protec.includes(removed) || db.bro.includes(removed)){ 
              await new Promise(r=>setTimeout(r,1200)); 
              await sock.groupParticipantsUpdate(id, [removed], "add").catch(()=>{}); 
              if(author){ 
                await sock.sendMessage(id, {text: `👼🔥 *ANGE A PARLÉ!* @${author.split('@')[0]} a osé bannir @${removed.split('@')[0]}!`, mentions:[author, removed]}).catch(()=>{}) 
              } 
            } 
          }
        }
      }catch(e){ console.log(e.message) }
    })
  }catch(e){ setTimeout(startBot,3000) }
}
startBot()
app.listen(PORT, '0.0.0.0', ()=>console.log("BLACK GOKU V15 LIVE "+PORT))
