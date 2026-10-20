process.on('uncaughtException', (e) => { if (e.message && e.message.includes('Bad MAC')) return; console.log("UNCAUGHT", e.message) })
process.on('unhandledRejection', (e) => { if (e?.message && e.message.includes('Bad MAC')) return; console.log("REJECTION", e?.message || e) })

const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, Browsers, downloadMediaMessage, DisconnectReason } = require('@whiskeysockets/baileys')
const P = require('pino')
const fs = require('fs')
const express = require('express')
const NodeCache = require('node-cache')
const app = express()
const PORT = process.env.PORT || 10000

if (!fs.existsSync('auth2')) fs.mkdirSync('auth2', { recursive: true })

// 🔥 FIX ANTI-DECO RENDER - RESTAURE SESSION AUTO
if (process.env.SESSION_ID) {
  try {
    if (!fs.existsSync('auth2/creds.json')) {
      const sess = Buffer.from(process.env.SESSION_ID, 'base64').toString();
      fs.writeFileSync('auth2/creds.json', sess);
      console.log("✅ SESSION RESTAURÉE DEPUIS ENV - PLUS BESOIN DE SCAN");
    }
  } catch(e) { console.log("SESSION ERR", e.message) }
}

const OWNER_NUMBER = "5551982215198"
const PREFIX = "₩"
const DB_FILE = './black_db.json'
const msgRetryCounterCache = new NodeCache({ stdTTL: 0, checkperiod: 0 })
const groupCache = new NodeCache({ stdTTL: 5 * 60, useClones: false })

let db = { amis:{}, saved:[], pro:[], protec:[], bro:[], chut:{}, blockadmin:[], godmode:[], kaio:[], antilink:[], antisticker:[], antistatus:[], welcome:[], pt:[], ghost:[], muted:[], autoPromote:{}, autoDemote:{}, vengeance:{}, shadow:[], ownerLids:[] }
if (fs.existsSync(DB_FILE)) { try { db = { ...db, ...JSON.parse(fs.readFileSync(DB_FILE)) } } catch (e) { } }
const saveDB = () => { try { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)) } catch (e) { } }

let sock, status = "Demarrage...", lastCode = "pas encore", lastQR = null
let groupStats = {}
let presenceInterval = null

const getMenu = () => `꧁༒☬ BLACK GOKU H24 ☬༒꧂
┏━ ✦ MEMBRES ✦ ━┓
┃ ₩tagall
┃ ₩hidetag 
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
┃ ₩goat 
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
┃ ₩vq
┃ ₩rdm
┃ ₩boy
┃ ₩ghost /off
┃ ₩pt /off
┗━━━━━━━━━━━━━━┛
┏━ ✦ OWNER ONLY ✦ ━┓
┃ ₩amis @m (multi)
┃ ₩noami @m (multi)
┗━━━━━━━━━━━━━━┛
 *BLACK GOKU H24*`;

const R = {
  noPerm: "Seul BLACK GOKU peut utiliser cette commande 👑",
  onlyOwner: "👑🔥 SEUL Black Goku PEUT utiliser ce bot.",
  onlyGoat: "👑💀 SEUL BLACK GOKU PEUT UTILISER ₩goat - HAKAI INTERDIT AUX MORTELS!",
  ban:(j)=>`💀 HAKAI! @${j.split('@')[0]} effacé.`,
  kick:(j)=>`💀 @${j.split('@')[0]} expulsé.`,
  promote:(j)=>`👑 @${j.split('@')[0]} élevé admin.`,
  demote:(j)=>`@${j.split('@')[0]} n'est plus admin.`,
  mute:"🤫 *GROUPE FERMÉ!* 🔒",
  unmute:"🔊 *GROUPE OUVERT!* 🔓",
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
  bro:(j)=>`👑🔥 *BRO PROTECTION* 🔥👑\n\n@${j.split('@')[0]} est mon BRO!`,
  nobro:(j)=>`💀 BRO retiré @${j.split('@')[0]}.`,
  protecTriggered:(prot, att)=>`☯️🔥 *PROTEC ACTIVÉE!* 🔥☯️\n\n💀 @${att.split('@')[0]} a osé bannir @${prot.split('@')[0]}!`,
  protecDemote:(prot, att)=>`☯️🔥 *ANTI-DEMOTE!* 🔥☯️\n\n💀 @${att.split('@')[0]} a osé demote @${prot.split('@')[0]}!`,
  godmode:"☯️🔥 *MODE ULTIME BLACK GOKU ACTIVÉ!* 🔥☯️\n\nPLUS PERSONNE NE PEUT BAN/DEMOTE/MUTE ICI.",
  godmodeoff:"💀 MODE ULTIME OFF.",
  kaio:"🔥 *KAIO-KEN ON!* Tout ban sera puni!",
  kaiooff:"KAIO OFF.",
  antilink:"🔗 *ANTILINK ON!*",
  antilinkoff:"ANTILINK OFF.",
  antisticker:"🖼️ *ANTISTICKER ON!*",
  antistickeroff:"ANTISTICKER OFF.",
  antistatus:"👁️ *ANTISTATUS ON!*",
  antistatusoff:"ANTISTATUS OFF.",
  welcome:"👋 *WELCOME ON*",
  welcomeoff:"WELCOME OFF.",
  welcomeMsg:(j, g)=>`꧁༒ BIENVENUE ☬༒꧂\n\n👑 @${j.split('@')[0]} dans *${g}*. Je suis Black Goku Comporte toi bien je te souhaite la bienvenue😁.`,
  vqOk: "👁️🔥 *VUE UNIQUE DÉVOILÉE* 🔥👁️",
  vqNeed: "😈 Réponds à une vue unique avec ₩vq!",
  boy:"💀 JE SUIS BLACK GOKU",
  ghost:"👻 *GHOST MODE ON*",
  ghostoff:"GHOST OFF.",
  pt:"🗣️ PT ON.",
  ptoff:"PT OFF.",
  amis:(j)=>`✅ *AMITIÉ* @${j.split('@')[0]} AMI!`,
  noami:(j)=>`❌💀 *BANNI!* @${j.split('@')[0]} plus de bot!`,
  needTag:"😈 TAG UN MORTEL! @m",
  antiOwner:"👑🔥 IMPOSSIBLE! Protégé!",
  goatStart:(n)=>`꧁༒☬ *BLACK GOKU - GOAT* ☬༒꧂\n\n💀 *Vous n'auriez jamais dû exister...* 💀\n\n☠️ Je vous regarde. Faibles. Inutiles. Bruyants.\n\n🩸 J'ai supporté assez longtemps vos voix. Maintenant... *taisez-vous pour l'éternité.*\n\n🔥 *${n} ÂMES. JE VAIS TOUT EFFACER. HAKAI!* 🔥`,
  goatEnd:`꧁༒ *C'EST FINI* ༒꧂\n\n🩸 Plus un bruit. Plus une âme. Juste le vide.\n\n💀 C'est ça la paix. Un monde sans vous.\n\n👑 *BLACK GOKU A PARLÉ. DISPARAISSEZ.* 👑\n\n☠️ *GOAT ACCOMPLI.* ☠️`
}

app.get('/', (req,res)=> res.send(`<h1>${status}</h1><p>CODE: ${lastCode}</p><h2 style="color:green">BLACK GOKU ONLINE - ${new Date().toISOString()}</h2><a href="/pair?num=${OWNER_NUMBER}">PAIR</a> | <a href="/qr">QR</a> | <a href="/clear">CLEAR</a>`))
app.get('/ping', (req,res)=> res.status(200).send('pong - '+Date.now()))
app.get('/qr', (req,res)=>{ if(!lastQR) return res.send(`<h1>Pas de QR - ${status}</h1>`); res.send(`<div style="text-align:center"><h1>SCAN QR</h1><img src="https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(lastQR)}"/><script>setTimeout(()=>location.reload(),25000)</script></div>`) })
app.get('/clear', (req,res)=>{ try{ if(fs.existsSync('auth2')) fs.rmSync('auth2',{recursive:true,force:true}); fs.mkdirSync('auth2',{recursive:true}); lastQR=null; if(presenceInterval) clearInterval(presenceInterval); res.send('CLEAR OK') }catch(e){ res.send(e.message) } })
app.get('/pair', async(req,res)=>{ let num=(req.query.num||'').replace(/[^0-9]/g,'')||OWNER_NUMBER; try{ if(!sock) return res.send('Bot demarre...'); await new Promise(r=>setTimeout(r,2000)); let code=await sock.requestPairingCode(num); lastCode=code; res.send(`<h1 style="font-size:60px;text-align:center">${code}</h1>`) }catch(e){ res.send('Erreur: '+e.message) } })

async function startBot(){
  try{
    const { version } = await fetchLatestBaileysVersion().catch(()=>({version:[2,3000,1015901307]}))
    const { state, saveCreds } = await useMultiFileAuthState('auth2')
    sock = makeWASocket({ 
      version, 
      auth:{creds:state.creds, keys:makeCacheableSignalKeyStore(state.keys, P({level:'silent'}))}, 
      logger:P({level:'silent'}), 
      browser: Browsers.ubuntu("Chrome"),
      msgRetryCounterCache, 
      getMessage: async (key) => { return undefined },
      markOnlineOnConnect:true, 
      syncFullHistory:false,
      shouldSyncHistoryMessage: () => false,
      fireInitQueries: true,
      keepAliveIntervalMs:15000, 
      connectTimeoutMs:60000,
      retryRequestDelayMs: 250,
      maxMsgRetryCount: 5
    })
    sock.ev.on('creds.update', async() => {
      await saveCreds();
      try {
        if (fs.existsSync('auth2/creds.json')) {
          const creds = fs.readFileSync('auth2/creds.json', 'utf8');
          const b64 = Buffer.from(creds).toString('base64');
          console.log("\n====== COPIE CE SESSION_ID DANS RENDER ENV ======\n"+b64+"\n====== FIN SESSION_ID ======\n");
        }
      } catch(e) {}
    })
    sock.ev.on('connection.update', async(u)=>{ 
      const { connection, lastDisconnect, qr } = u; 
      if(qr) lastQR = qr; 
      if(connection==='open'){ 
        status="BLACK GOKU ACTIF ✅ H24"; lastQR=null; 
        console.log("✅ CONNECTE - ACTIF EN LIGNE - PROTECTION OK");
        try{ await sock.sendPresenceUpdate('available') }catch{}
        if(presenceInterval) clearInterval(presenceInterval)
        presenceInterval = setInterval(async()=>{ try{ await sock.sendPresenceUpdate('available') }catch{} }, 15000)
      } 
      if(connection==='close'){ 
        if(presenceInterval) clearInterval(presenceInterval)
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut; 
        if(shouldReconnect) setTimeout(startBot,2000) 
      } 
    })

    sock.ev.on('messages.upsert', async({messages, type})=>{
      if(type!=='notify') return
      for (let m of messages) {
        if(!m?.message || !m.key?.id) continue
        const from=m.key.remoteJid; const sender = m.key.participant || m.key.remoteJid || from; 
        let text = m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || m.message.videoMessage?.caption || "";
        const isGroup = from.endsWith('@g.us')
        const isMe = m.key.fromMe;

        if(!groupStats[from]) groupStats[from] = { total: 0 }; groupStats[from].total++;

        if(isGroup && !isMe){
          try{
            if(db.antilink.includes(from)){ 
              let linkRegex = /(https?:\/\/|www\.|chat\.whatsapp\.com|wa\.me\/|t\.me\/|instagram\.com|youtube\.com|youtu\.be)/i
              if(linkRegex.test(text)){ 
                await sock.sendMessage(from, { delete: { remoteJid: from, fromMe: false, id: m.key.id, participant: sender } }).catch(()=>{}); 
                continue; 
              } 
            }
            if(db.antisticker.includes(from) && m.message.stickerMessage){ 
              await sock.sendMessage(from, { delete: { remoteJid: from, fromMe: false, id: m.key.id, participant: sender } }).catch(()=>{}); 
              continue; 
            }
            if(db.chut[from]?.includes(sender)){ 
              await sock.sendMessage(from, { delete: { remoteJid: from, fromMe: false, id: m.key.id, participant: sender } }).catch(()=>{}); 
              continue; 
            }
          }catch(e){ console.log("FILTER ERR", e.message)}
        }

        if(!text) continue; text=text.trim(); if(!text.startsWith(PREFIX)) continue
        const args=text.slice(1).trim().split(/ +/); const cmd=args[0].toLowerCase(); const txt=args.slice(1).join(' '); const mentioned=m.message.extendedTextMessage?.contextInfo?.mentionedJid||[]; const multi = mentioned.length ? mentioned : []; 
        let meta = null
        if(isGroup){
          meta = groupCache.get(from)
          if(!meta){
            meta = await sock.groupMetadata(from).catch(()=>null)
            if(meta) groupCache.set(from, meta)
          }
        }
        const senderNum = sender.replace(/[^0-9]/g,'');
        let senderPhone = sender;
        if (meta) {
          const part = meta.participants.find(p => p.id === sender);
          if (part?.jid) senderPhone = part.jid;
          if (part?.phoneNumber) senderPhone = part.phoneNumber;
        }
        let senderPhoneNum = senderPhone.replace(/[^0-9]/g,'');
        if (!senderPhoneNum) senderPhoneNum = senderNum;

        // VRAI OWNER = SEULEMENT TOI
        const isRealOwner = (() => {
          if(isMe) return true;
          if(senderNum === OWNER_NUMBER) return true;
          if(senderPhoneNum === OWNER_NUMBER) return true;
          return false;
        })();

        const isOwnerLid = (() => {
          if(isRealOwner) return true;
          if(senderPhoneNum.endsWith(OWNER_NUMBER.slice(-8))) return true;
          if(db.amis[senderNum]) return true;
          if(db.amis[senderPhoneNum]) return true;
          if(db.amis[sender]) return true;
          if(db.ownerLids && db.ownerLids.includes(sender)) return true;
          return false;
        })();

        if(isRealOwner && sender.includes('@lid') && !db.ownerLids.includes(sender)){ db.ownerLids.push(sender); saveDB(); }

        if(["black","menu","b"].includes(cmd)){ 
          if(!isOwnerLid){ await sock.sendMessage(from, {text: R.noPerm}, {quoted:m}).catch(()=>{}); continue } 
          try{
            if(fs.existsSync('./menu.jpg')){
              let menuImg = fs.readFileSync('./menu.jpg');
              await sock.sendMessage(from,{image: menuImg, caption: getMenu()},{quoted:m});
            } else if(fs.existsSync('./goat.jpg')){
              let menuImg = fs.readFileSync('./goat.jpg');
              await sock.sendMessage(from,{image: menuImg, caption: getMenu()},{quoted:m});
            } else {
              await sock.sendMessage(from,{text:getMenu()},{quoted:m});
            }
          }catch(e){
            await sock.sendMessage(from,{text:getMenu()},{quoted:m});
          }
          continue 
        }

        if(!isOwnerLid){ await sock.sendMessage(from, {text: R.noPerm}, {quoted:m}).catch(()=>{}); continue }
        
        if(cmd==="sticker" || cmd==="s"){ try{ let q = m.message.extendedTextMessage?.contextInfo?.quotedMessage; let msg = q || m.message; let type = Object.keys(msg)[0]; if(type==='imageMessage' || type==='videoMessage'){ let buffer = await downloadMediaMessage({key: m.key, message: { [type]: msg[type] } }, 'buffer', {}, {logger: P({level:'silent'}), reuploadRequest: sock.updateMediaMessage}); await sock.sendMessage(from, {sticker: buffer}, {quoted:m}) } else if(q && (q.imageMessage || q.videoMessage)){ let buffer = await downloadMediaMessage({key: {remoteJid: from, id: m.message.extendedTextMessage.contextInfo.stanzaId, participant: m.message.extendedTextMessage.contextInfo.participant}, message: q}, 'buffer', {}, {logger: P({level:'silent'}), reuploadRequest: sock.updateMediaMessage}); await sock.sendMessage(from, {sticker: buffer}, {quoted:m}) } else { await sock.sendMessage(from, {text:"😈 Envoie une image/vidéo avec ₩s ou réponds à une image!"}, {quoted:m}) } }catch(e){ await sock.sendMessage(from, {text:"❌ Erreur sticker: "+e.message}, {quoted:m}) } continue }
        if(cmd==="vq"){ try{ let quoted = m.message.extendedTextMessage?.contextInfo?.quotedMessage; if(!quoted) { await sock.sendMessage(from, {text: R.vqNeed}, {quoted:m}); continue; } let viewOnce = quoted.viewOnceMessage || quoted.viewOnceMessageV2 || quoted.viewOnceMessageV2Extension; let msgToDownload = viewOnce? viewOnce.message : quoted; let vType = Object.keys(msgToDownload)[0]; let buffer = await downloadMediaMessage({key: {remoteJid: from, id: m.message.extendedTextMessage.contextInfo.stanzaId, participant: m.message.extendedTextMessage.contextInfo.participant}, message: msgToDownload}, 'buffer', {}, {logger: P({level:'silent'}), reuploadRequest: sock.updateMediaMessage}); let cap = msgToDownload[vType]?.caption || ""; if(vType==='imageMessage') await sock.sendMessage(from, {image: buffer, caption: R.vqOk+"\n\n"+cap}, {quoted:m}); else if(vType==='videoMessage') await sock.sendMessage(from, {video: buffer, caption: R.vqOk+"\n\n"+cap}, {quoted:m}); else if(vType==='audioMessage') await sock.sendMessage(from, {audio: buffer, mimetype: 'audio/ogg; codecs=opus', ptt: true}, {quoted:m}); else await sock.sendMessage(from, {text: "Type non supporté: "+vType}, {quoted:m}) }catch(e){ await sock.sendMessage(from, {text: "❌ Erreur VQ: "+e.message}, {quoted:m}) } continue }
        if(isGroup && (cmd==="tagall" || cmd==="hidetag")){ if(!meta) continue; await sock.sendMessage(from,{text:(cmd==="tagall"?R.tagall(txt):R.hidetag(txt))+"\n\n"+meta.participants.map(p=>`@${p.id.split('@')[0]}`).join(' '), mentions:meta.participants.map(p=>p.id)}); continue }
        if((cmd==="ban" || cmd==="kick")){ if(!multi.length) { await sock.sendMessage(from,{text:R.needTag}); continue; } for(let t of multi){ let tNum = t.replace(/[^0-9]/g,''); if(tNum===OWNER_NUMBER || db.amis[tNum]) continue; if(db.protec.includes(t) || db.bro.includes(t)) { await sock.sendMessage(from,{text:`😈 IMPOSSIBLE! @${t.split('@')[0]} sous PROTEC/BRO!`, mentions:[t]}); continue; } await sock.groupParticipantsUpdate(from,[t],"remove").catch(()=>{}); } await sock.sendMessage(from,{text:`💀 HAKAI! ${multi.length} effacés.`, mentions:multi}); continue }
        
        // 🔥 GOAT - SEUL REAL OWNER
        if(cmd==="goat"){ 
          if(!isRealOwner){
            await sock.sendMessage(from,{text:R.onlyGoat}, {quoted:m});
            continue;
          }
          if(!meta) { await sock.sendMessage(from,{text:"❌ Groupe uniquement"}, {quoted:m}); continue; } 
          const botNum = sock.user.id.replace(/[^0-9]/g,''); 
          let toKick = meta.participants.filter(p=>{ 
            let id=p.id; let num=id.replace(/[^0-9]/g,''); 
            if(id===sock.user.id) return false; 
            if(num===botNum) return false; 
            if(id.includes(botNum.substring(0,8)) && num.length>10) return false; 
            if(id===sender) return false; 
            if(num===OWNER_NUMBER || num.includes(OWNER_NUMBER)) return false; 
            if(db.bro.some(b=>b.replace(/[^0-9]/g,'')===num) || db.bro.includes(p.id)) return false; 
            if(db.protec.some(pr=>pr.replace(/[^0-9]/g,'')===num) || db.protec.includes(p.id)) return false; 
            if(db.amis[num] || db.amis[p.id]) return false; 
            if(db.ownerLids.includes(p.id)) return false; 
            return true; 
          }).map(p=>p.id); 
          if(toKick.length===0) { await sock.sendMessage(from,{text:"💀 Personne à effacer."}, {quoted:m}); continue; } 
          
          try{
            if(fs.existsSync('./goat.jpg')){
              let goatImg = fs.readFileSync('./goat.jpg');
              await sock.sendMessage(from,{image: goatImg, caption: R.goatStart(toKick.length.toString())}, {quoted:m});
            } else {
              await sock.sendMessage(from,{text:R.goatStart(toKick.length.toString())}, {quoted:m});
            }
          }catch(e){
            await sock.sendMessage(from,{text:R.goatStart(toKick.length.toString())}, {quoted:m});
          }

          for(let i=0; i<toKick.length; i+=3){ 
            let batch = toKick.slice(i, i+3); 
            await Promise.all(batch.map(id=> sock.groupParticipantsUpdate(from,[id],"remove").catch(()=>{}))); 
            await new Promise(r=>setTimeout(r,150)); 
          } 

          try{
            if(fs.existsSync('./goat.jpg')){
              let goatImg2 = fs.readFileSync('./goat.jpg');
              await sock.sendMessage(from,{image: goatImg2, caption: R.goatEnd}, {quoted:m});
            } else {
              await sock.sendMessage(from,{text:R.goatEnd}, {quoted:m});
            }
          }catch(e){
            await sock.sendMessage(from,{text:R.goatEnd}, {quoted:m});
          }
          continue 
        }

        if(cmd==="promote"){ if(!multi.length) { await sock.sendMessage(from,{text:R.needTag}); continue; } for(let t of multi){ if(!db.autoPromote[from]) db.autoPromote[from]=[]; if(!db.autoPromote[from].includes(t)) db.autoPromote[from].push(t); if(db.autoDemote[from]) db.autoDemote[from]=db.autoDemote[from].filter(x=>x!==t); await sock.groupParticipantsUpdate(from,[t],"promote").catch(()=>{}); } saveDB(); await sock.sendMessage(from,{text:`👑 ${multi.length} élevés admin.`, mentions:multi}); continue }
        if(cmd==="demote"){ if(!multi.length) { await sock.sendMessage(from,{text:R.needTag}); continue; } for(let t of multi){ let tNum = t.replace(/[^0-9]/g,''); if(tNum===OWNER_NUMBER) continue; if(db.bro.includes(t)) continue; if(!db.autoDemote[from]) db.autoDemote[from]=[]; if(!db.autoDemote[from].includes(t)) db.autoDemote[from].push(t); if(db.autoPromote[from]) db.autoPromote[from]=db.autoPromote[from].filter(x=>x!==t); await sock.groupParticipantsUpdate(from,[t],"demote").catch(()=>{}); } saveDB(); await sock.sendMessage(from,{text:`${multi.length} demotes.`, mentions:multi}); continue }
        if(cmd==="bro"){ if(!multi.length) { await sock.sendMessage(from,{text:R.needTag}); continue; } for(let t of multi){ if(!db.bro.includes(t)) db.bro.push(t); if(!db.protec.includes(t)) db.protec.push(t); if(!db.pro.includes(t)) db.pro.push(t); if(!db.saved.includes(t)) db.saved.push(t); if(!db.autoPromote[from]) db.autoPromote[from]=[]; if(!db.autoPromote[from].includes(t)) db.autoPromote[from].push(t); } saveDB(); await sock.sendMessage(from,{text:`👑🔥 ${multi.length} en BRO!`, mentions:multi}); continue }
        if(cmd==="nobro"){ if(!multi.length) { await sock.sendMessage(from,{text:R.needTag}); continue; } for(let t of multi) db.bro=db.bro.filter(x=>x!==t); saveDB(); await sock.sendMessage(from,{text:`💀 ${multi.length} BRO retirés.`, mentions:multi}); continue }
        if(cmd==="protec"){ if(!multi.length) { await sock.sendMessage(from,{text:R.needTag}); continue; } for(let t of multi){ if(!db.protec.includes(t)) db.protec.push(t); if(!db.pro.includes(t)) db.pro.push(t); if(!db.saved.includes(t)) db.saved.push(t); if(!db.autoPromote[from]) db.autoPromote[from]=[]; if(!db.autoPromote[from].includes(t)) db.autoPromote[from].push(t); if(db.autoDemote[from]) db.autoDemote[from]=db.autoDemote[from].filter(x=>x!==t); } saveDB(); await sock.sendMessage(from,{text:`👑🔥 ${multi.length} en PROTEC!`, mentions:multi}); continue }
        if(cmd==="unprotect"){ if(!multi.length) { await sock.sendMessage(from,{text:R.needTag}); continue; } for(let t of multi){ db.protec=db.protec.filter(x=>x!==t); db.pro=db.pro.filter(x=>x!==t); db.saved=db.saved.filter(x=>x!==t); } saveDB(); await sock.sendMessage(from,{text:`💀 ${multi.length} PROTEC retirées.`, mentions:multi}); continue }
        if(cmd==="save"){ if(!multi.length) { await sock.sendMessage(from,{text:R.needTag}); continue; } for(let t of multi) if(!db.saved.includes(t)) db.saved.push(t); saveDB(); await sock.sendMessage(from,{text:`🛡️ ${multi.length} en SAVE.`, mentions:multi}); continue }
        if(cmd==="unsave"){ if(!multi.length) { await sock.sendMessage(from,{text:R.needTag}); continue; } for(let t of multi) db.saved=db.saved.filter(x=>x!==t); saveDB(); await sock.sendMessage(from,{text:`🛡️ ${multi.length} SAVE retirés.`, mentions:multi}); continue }
        if(cmd==="pro"){ if(!multi.length) { await sock.sendMessage(from,{text:R.needTag}); continue; } for(let t of multi) if(!db.pro.includes(t)) db.pro.push(t); saveDB(); await sock.sendMessage(from,{text:`✨ ${multi.length} en PRO.`, mentions:multi}); continue }
        if(cmd==="chut"){ if(!multi.length) { await sock.sendMessage(from,{text:R.needTag}); continue; } if(!db.chut[from]) db.chut[from]=[]; for(let t of multi) if(!db.chut[from].includes(t)) db.chut[from].push(t); saveDB(); await sock.sendMessage(from,{text:`🔇 ${multi.length} au Néant.`, mentions:multi}); continue }
        if(cmd==="unchut"){ if(!multi.length) { await sock.sendMessage(from,{text:R.needTag}); continue; } if(db.chut[from]) for(let t of multi) db.chut[from]=db.chut[from].filter(x=>x!==t); saveDB(); await sock.sendMessage(from,{text:`🔓 ${multi.length} libérés.`, mentions:multi}); continue }
        if(cmd==="blockadmin"){ if(!multi.length) { await sock.sendMessage(from,{text:R.needTag}); continue; } for(let t of multi) if(!db.blockadmin.includes(t)) db.blockadmin.push(t); saveDB(); await sock.sendMessage(from,{text:`⛓️ ${multi.length} scellés.`, mentions:multi}); continue }
        if(cmd==="unblockadmin"){ if(!multi.length) { await sock.sendMessage(from,{text:R.needTag}); continue; } for(let t of multi) db.blockadmin=db.blockadmin.filter(x=>x!==t); saveDB(); await sock.sendMessage(from,{text:`🔓 ${multi.length} libérés.`, mentions:multi}); continue }
        if(cmd==="godmode"){ if(txt.includes("off")){ db.godmode=db.godmode.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.godmodeoff}) } else { if(!db.godmode.includes(from)) db.godmode.push(from); saveDB(); await sock.sendMessage(from,{text:R.godmode}) } continue }
        if(cmd==="kaio"){ if(txt.includes("off")){ db.kaio=db.kaio.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.kaiooff}) } else { if(!db.kaio.includes(from)) db.kaio.push(from); saveDB(); await sock.sendMessage(from,{text:R.kaio}) } continue }
        if(cmd==="antilink"){ if(txt.includes("off")){ db.antilink=db.antilink.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.antilinkoff}) } else { if(!db.antilink.includes(from)) db.antilink.push(from); saveDB(); await sock.sendMessage(from,{text:R.antilink}) } continue }
        if(cmd==="antisticker"){ if(txt.includes("off")){ db.antisticker=db.antisticker.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.antistickeroff}) } else { if(!db.antisticker.includes(from)) db.antisticker.push(from); saveDB(); await sock.sendMessage(from,{text:R.antisticker}) } continue }
        if(cmd==="antistatus"){ if(txt.includes("off")){ db.antistatus=db.antistatus.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.antistatusoff}) } else { if(!db.antistatus.includes(from)) db.antistatus.push(from); saveDB(); await sock.sendMessage(from,{text:R.antistatus}) } continue }
        if(cmd==="welcome"){ if(txt.includes("off")){ db.welcome=db.welcome.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.welcomeoff}) } else { if(!db.welcome.includes(from)) db.welcome.push(from); saveDB(); await sock.sendMessage(from,{text:R.welcome}) } continue }
        if(cmd==="ghost"){ if(txt.includes("off")){ db.ghost=db.ghost.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.ghostoff}) } else { if(!db.ghost.includes(from)) db.ghost.push(from); saveDB(); await sock.sendMessage(from,{text:R.ghost}) } continue }
        if(cmd==="pt"){ if(txt.includes("off")){ db.pt=db.pt.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.ptoff}) } else { if(!db.pt.includes(from)) db.pt.push(from); saveDB(); await sock.sendMessage(from,{text:R.pt}) } continue }
        if(cmd==="mute"){ try{ await sock.groupSettingUpdate(from, 'announcement'); if(!db.muted.includes(from)) db.muted.push(from); saveDB(); await sock.sendMessage(from,{text:R.mute}) }catch(e){ await sock.sendMessage(from,{text:"❌ Bot doit être admin."}) } continue }
        if(cmd==="unmute"){ try{ await sock.groupSettingUpdate(from, 'not_announcement'); db.muted=db.muted.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.unmute}) }catch(e){ await sock.sendMessage(from,{text:"❌ Bot doit être admin."}) } continue }
        if(cmd==="admin" && meta){ let admins=meta.participants.filter(p=>p.admin).map(p=>p.id); let list = admins.map((a,i)=>`${i+1}. @${a.split('@')[0]} ${meta.participants.find(p=>p.id===a)?.admin === 'superadmin'? '(Créateur)' : ''}`).join('\n'); await sock.sendMessage(from,{text:`👑 *ADMINS (${admins.length})* 👑\n\n${list}`, mentions:admins}); continue }
        if(cmd==="info" && meta){ let total = meta.participants.length; let admins = meta.participants.filter(p=>p.admin).length; let stats = groupStats[from] || { total: 0 }; let text = `꧁༒ *INFOS GROUPE* ༒꧂\n\n📛 Nom: ${meta.subject}\n👥 Total membres: ${total}\n👑 Admins: ${admins}\n📊 MESSAGES: ${stats.total}\n\n*BLACK GOKU H24*`; await sock.sendMessage(from,{text:text}); continue }
        if(cmd==="stats"){ let uptime = process.uptime(); let h = Math.floor(uptime/3600); let m = Math.floor((uptime%3600)/60); let s = Math.floor(uptime%60); await sock.sendMessage(from,{text:`📊 *STATS BLACK GOKU H24*\n\n⏱️ Allumé depuis: ${h}h ${m}m ${s}s\n\n*BLACK GOKU*`}); continue }
        if(cmd==="amis"){ if(!multi.length) continue; for(let t of multi){ let n=t.replace(/[^0-9]/g,''); db.amis[n]=true; db.amis[t]=true; } saveDB(); await sock.sendMessage(from,{text:`✅ ${multi.length} AMIS ajoutés.`, mentions:multi}); continue }
        if(cmd==="noami"){ if(!multi.length) { await sock.sendMessage(from,{text:R.onlyOwner}); continue; } for(let t of multi){ let n=t.replace(/[^0-9]/g,''); delete db.amis[n]; delete db.amis[t]; } saveDB(); await sock.sendMessage(from,{text:`❌ ${multi.length} bannis.`, mentions:multi}); continue }
        if(cmd==="rdm" && meta){ let mems = meta.participants; let pick = mems[Math.floor(Math.random()*mems.length)]; await sock.sendMessage(from,{text:`🎲 Destin: @${pick.id.split('@')[0]} a été choisi!`, mentions:[pick.id]}); continue }
        if(cmd==="boy"){ await sock.sendMessage(from,{text:R.boy}); continue }
      }
    })

    sock.ev.on('groups.update', async(updates)=>{ try{ for(let upd of updates){ if(!db.godmode.includes(upd.id)) continue; if(upd.announce === true || upd.announce === 'true'){ await new Promise(r=>setTimeout(r,1000)); await sock.groupSettingUpdate(upd.id, 'not_announcement').catch(()=>{}); await sock.sendMessage(upd.id, {text: "☯️🔥 *PROTECTION MAX!* Quelqu'un a essayé de fermer le groupe, j'ai rouvert! 🔥☯️"}).catch(()=>{}) } } }catch(e){} })
    
    sock.ev.on('group-participants.update', async(update)=>{
      try{
        const { id, participants, action, author } = update
        groupCache.del(id);
        const botNum = sock.user.id.split(':')[0].replace(/[^0-9]/g,'')
        const isBot = (jid) => jid.includes(botNum) || jid===sock.user.id
        const getIsBotAdmin = async()=>{ try{ const meta=await sock.groupMetadata(id); return!!meta.participants.find(p=>isBot(p.id))?.admin }catch{ return false } }
        const isGodmode = db.godmode.includes(id); const isKaio = db.kaio.includes(id)
        if(action==='add' && db.welcome.includes(id)){ for(let p of participants){ if(isBot(p)) continue; let gName = "ce groupe"; try{ gName = (await sock.groupMetadata(id)).subject }catch{}; await sock.sendMessage(id, {text: R.welcomeMsg(p, gName), mentions:[p]}).catch(()=>{}) } }
        if(action==='demote'){
          for(let demoted of participants){
            if(author && isBot(author)) continue;
            if(isBot(demoted)){ await new Promise(r=>setTimeout(r,1500)); await sock.groupParticipantsUpdate(id, [sock.user.id], "promote").catch(()=>{}); if(isGodmode && author){ await sock.sendMessage(id, {text: `☯️🔥 *PROTECTION MAX!* @${author.split('@')[0]} a osé demote BLACK GOKU!`, mentions:[author]}).catch(()=>{}); await sock.groupParticipantsUpdate(id, [author], "demote").catch(()=>{}) } continue }
            let demNum = demoted.replace(/[^0-9]/g,''); let isProtectedNormal = db.protec.includes(demoted) || db.bro.includes(demoted) || db.pro.includes(demoted) || db.saved.includes(demoted) || db.amis[demNum] || demNum===OWNER_NUMBER || db.autoPromote[id]?.includes(demoted)
            let shouldProtect = isProtectedNormal || isGodmode
            if(shouldProtect){ await new Promise(r=>setTimeout(r,1000)); if(await getIsBotAdmin()){ for(let i=0;i<3;i++){ try{ await sock.groupParticipantsUpdate(id, [demoted], "promote"); break }catch{ await new Promise(r=>setTimeout(r,800)) } } if(author && author!==demoted){ let aNum = author.replace(/[^0-9]/g,''); let authorIsOwner = aNum===OWNER_NUMBER || db.protec.includes(author) || db.bro.includes(author) || (author && db.amis[aNum]); if(!authorIsOwner){ await new Promise(r=>setTimeout(r,500)); await sock.groupParticipantsUpdate(id, [author], "demote").catch(()=>{}); let msg = isGodmode? `☯️🔥 *PROTECTION MAX!* @${author.split('@')[0]} a demote @${demoted.split('@')[0]}, il est puni!` : R.protecDemote(demoted, author); await sock.sendMessage(id, {text: msg, mentions:[demoted, author]}).catch(()=>{}) } } } }
          }
        }
        if(action==='remove'){
          for(let removed of participants){
            if(author && isBot(author)) continue;
            if(isBot(removed)){ if(!db.vengeance) db.vengeance={}; if(!db.vengeance[id]) db.vengeance[id]=[]; if(author &&!db.vengeance[id].includes(author)){ db.vengeance[id].push(author); saveDB() } continue }
            let num = removed.replace(/[^0-9]/g,''); let isProtectedNormal = db.protec.includes(removed) || db.bro.includes(removed) || db.pro.includes(removed) || db.saved.includes(removed) || db.amis[num] || num===OWNER_NUMBER
            let shouldProtect = isProtectedNormal || isKaio || isGodmode
            if(shouldProtect){ let meta = await sock.groupMetadata(id).catch(()=>null); if(!meta) continue; let botIsAdmin = meta.participants.find(p=>isBot(p.id))?.admin; if(!botIsAdmin) continue; let authorNum = author? author.replace(/[^0-9]/g,'') : ''; let authorIsOwner = authorNum===OWNER_NUMBER || db.protec.includes(author) || db.bro.includes(author) || (author && db.amis[authorNum]); if(!authorIsOwner){ await sock.groupParticipantsUpdate(id, [removed], "add").catch(()=>{}); await new Promise(r=>setTimeout(r,500)); if(author && author!==removed){ await sock.groupParticipantsUpdate(id, [author], "remove").catch(()=>{}); let msg = isGodmode? `☯️🔥 *PROTECTION MAX!* @${author.split('@')[0]} a osé bannir @${removed.split('@')[0]}! IL EST HAKAI!` : R.protecTriggered(removed, author); await sock.sendMessage(id, {text: msg, mentions:[removed, author]}).catch(()=>{}) } } }
          }
        }
        if(action==='add'){ let botAdded = participants.some(isBot); if(botAdded){ await sock.sendMessage(id, {text: "BLACK GOKU EST LA - MODE PROTECTION MAX ACTIF 🔥"}).catch(()=>{}) } if(botAdded && db.vengeance?.[id]?.length){ await new Promise(r=>setTimeout(r,1500)); for(let attacker of db.vengeance[id]){ await sock.groupParticipantsUpdate(id, [attacker], "remove").catch(()=>{}); await sock.sendMessage(id, {text: `🔥 VENGEANCE! @${attacker.split('@')[0]} m'avait banni!`, mentions:[attacker]}).catch(()=>{}) } db.vengeance[id]=[]; saveDB() } }
      }catch(e){ console.log("PROTEC ERR", e.message) }
    })
  }catch(e){ console.log("START ERROR", e.message); setTimeout(startBot,3000) }
}
startBot()
app.listen(PORT, '0.0.0.0', ()=>console.log("BLACK GOKU LIVE "+PORT))
