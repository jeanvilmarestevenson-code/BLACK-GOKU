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

let yts, ytdl, playdl
try { yts = require('yt-search'); } catch(e) {}
try { ytdl = require('@distube/ytdl-core'); } catch(e) {}
try { playdl = require('play-dl'); } catch(e) {}

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
const groupCache = new NodeCache({ stdTTL: 60, useClones: false })
let db = { amis:{}, saved:[], pro:[], protec:[], bro:[], angel:[], chut:{}, blockadmin:[], godmode:[], kaio:[], antilink:[], antisticker:[], antistatus:[], welcome:[], pt:[], ghost:[], boy:[], muted:[], ownerLids:[], ghostCache:{}, antilinkWarns:{}, groupList:{}, botOff:false }
if (fs.existsSync(DB_FILE)) { try { db = { ...db, ...JSON.parse(fs.readFileSync(DB_FILE)) }; if(db.botOff===undefined) db.botOff=false; } catch{} }
const saveDB = () => { try { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)) } catch{} }

let sock, status = "Demarrage...", lastCode = "pas encore", lastQR = null, groupStats = {}, presenceInterval = null

const menuFR = `꧁༒☬ BLACK GOKU H24 ☬༒꧂
┏━ ✦ MEMBRES ✦ ━┓
┃ ₩tagall 
┃ ₩hidetag 
┃ ₩kick / ₩ban @m
┃ ₩promote / ₩demote @m
┃ ₩mute / ₩unmute
┃ ₩admin / ₩info / ₩stats
┃ ₩play [son/video]
┃ ₩goku - image Black Goku
┃ ₩kaio - image KAIO-KEN
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
┃ ₩ghost /off
┃ ₩pt /off
┗━━━━━━━━━━━━━━┛
┏━ ✦ FUN & OUTILS ✦ ━┓
┃ ₩sticker / ₩s
┃ ₩vq - view once
┃ ₩rdm - random
┗━━━━━━━━━━━━━━┛
┏━ ✦ OWNER ✦ ━┓
┃ ₩amis @m / ₩noami @m
┃ ₩groupe / ₩no
┃ ₩bot on/off
┗━━━━━━━━━━━━━━┛
*BLACK GOKU H24 V20.6*`
const menuPT = menuFR

const R_FR = {
  noPerm:"💀 *TOUCHE PAS À CE QUI N'EST PAS À TOI, FAIBLE.*\n\n *SEUL BLACK GOKU COMMANDE ICI. TOI, TU OBEIS. C'EST TOUT😈.*", 
  onlyGoat:"👑💀 SEUL BLACK GOKU PEUT UTILISER ₩goat - HAKAI INTERDIT AUX MORTELS!", 
  needTag:"😈 TAG UN MORTEL! @m",
  ban:(j)=>`💀 HAKAI! @${j.split('@')[0]} effacé.`, kick:(j)=>`💀 @${j.split('@')[0]} expulsé.`,
  promote:(j)=>`👑 @${j.split('@')[0]} élevé admin.`, demote:(j)=>`@${j.split('@')[0]} n'est plus admin.`,
  mute:"🤫 *GROUPE FERMÉ!* 🔒", unmute:"🔊 *GROUPE OUVERT!* 🔓",
  tagall:(t)=>`🔥 *BLACK GOKU VOUS INVOQUE!* 🔥\n\n${t||"Tous!"}`, hidetag:(t)=>`👻 Invocation...\n${t||"Marqués."}`,
  chut:(j)=>`🔇 @${j.split('@')[0]} au Néant.`, unchut:(j)=>`🔓 @${j.split('@')[0]} peut parler.`,
  blockadmin:(j)=>`⛓️ @${j.split('@')[0]} POUVOIRS SCELLÉS!`, unblockadmin:(j)=>`🔓 @${j.split('@')[0]} chaînes brisées.`,
  save:(j)=>`🛡️ @${j.split('@')[0]} Intouchable.`, unsave:(j)=>`🛡️ Marque retirée @${j.split('@')[0]}.`,
  pro:(j)=>`✨ @${j.split('@')[0]} béni PRO.`, protec:(j)=>`👑🔥 *PROTEC* 🔥👑\n\n@${j.split('@')[0]} Protégé.`, unprotec:(j)=>`💀 PROTEC retirée @${j.split('@')[0]}.`,
  bro:(j)=>`👑🔥 *BRO* 🔥👑\n\n@${j.split('@')[0]} est mon BRO!`, nobro:(j)=>`💀 BRO retiré @${j.split('@')[0]}.`,
  godmode:"☯️🔥 *MODE ULTIME BLACK GOKU ACTIVÉ!* ✅", godmodeoff:"💀 MODE ULTIME OFF. ✅",
  kaio:"🔥 *KAIO-KEN X100 ON!* ✅", kaiooff:"KAIO OFF. ✅",
  kaioCaption:"🔥☯️ *KAIO-KEN X100 ACTIVÉ!* ☯️🔥\n\n\"Ton existence est une erreur que je vais corriger.\"\n\n— BLACK GOKU —",
  antilink:"🔗 *ANTILINK TOTAL ON!* ✅ Bloque tout + chaines", antilinkoff:"ANTILINK OFF. ✅",
  antisticker:"🖼️ *ANTISTICKER ON!* ✅", antistickeroff:"ANTISTICKER OFF. ✅",
  antistatus:"👁️ *ANTISTATUS ON!* ✅", antistatusoff:"ANTISTATUS OFF. ✅",
  welcome:"👋 *WELCOME ON - avec photo + anti-spam* ✅", welcomeoff:"WELCOME OFF. ✅",
  welcomeMsg:(j,g)=>`Bienvenue @${j.split('@')[0]} 👋\n\nBienvenue dans *${g}* !\nJe suis Black Goku, comporte toi bien 😁✨`,
  byeMsg:(j,g)=>`À plus @${j.split('@')[0]} 👋\n\nIl a quitté *${g}* 🙏\nOn espère te revoir bientôt !`,
  vqOk:"👁️🔥 *VUE UNIQUE DÉVOILÉE* 🔥👁️", vqNeed:"😈 Réponds à une vue unique avec ₩vq!",
  ghost:"👻💀 *GHOST DIABLE ON* ✅", ghostoff:"👻 GHOST OFF. ✅",
  boyOn:"👼✨ *ANGE PROTECTEUR ACTIVÉ!* ✨👼 ✅", boyOff:"👼 ANGE MODE OFF. ✅", boyProtect:(j)=>`👼✨ @${j.split('@')[0]} est maintenant ANGE! INTOUCHABLE! ✨ ✅`,
  pt:"🇧🇷 PT ON! ✅", ptoff:"🇫🇷 PT OFF! ✅",
  amis:(j)=>`✅ @${j.split('@')[0]} AMI! ✅`, noami:(j)=>`❌💀 @${j.split('@')[0]} BANNI! ✅`,
  botOffMsg:"💀 *BLACK GOKU ÉTEINT* 💀\n\n🔒 Le bot est fermé.\n👑 Seul le créateur peut le rallumer avec ₩bot on\n❌ Même les ₩amis ne peuvent plus l'utiliser.",
  botOnMsg:"☯️🔥 *BLACK GOKU ALLUMÉ* 🔥☯️\n\n✅ Le bot est de retour!",
  botStatus:(off)=>`🤖 Bot est actuellement: *${off ? 'OFF 🔴' : 'ON 🟢'}*\n\n₩bot on = allumer\n₩bot off = éteindre (seul créateur)`,
  gokuCaption:"\"Ton existence est une erreur que je vais corriger.\"\n\n— BLACK GOKU —",
  goatStart:(n)=>`☯️👑 *C'EST MOI, BLACK GOKU😈. TON CAUCHEMAR.*\n\n💀 *${n} FAIBLES... HAKAI!*`,
  goatEnd:`꧁༒☬ *FINI* ☬༒꧂\n\n☠️ *PLUS RIEN. J'AI NETTOYÉ. BLACK GOKU.* 👑`
}
const R_PT = R_FR
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
function getActiveCommands(gid){
  let a = [];
  if(db.antilink.includes(gid)) a.push("antilink");
  if(db.antisticker.includes(gid)) a.push("antisticker");
  if(db.antistatus.includes(gid)) a.push("antistatus");
  if(db.welcome.includes(gid)) a.push("welcome");
  if(db.ghost.includes(gid)) a.push("ghost");
  if(db.boy.includes(gid)) a.push("boy");
  if(db.godmode.includes(gid)) a.push("godmode");
  if(db.kaio.includes(gid)) a.push("kaio");
  if(db.pt.includes(gid)) a.push("pt");
  return a;
}
function amIAdmin(g){
  if(!sock) return false;
  const myId = sock.user.id;
  const myNum = myId.split(':')[0].replace(/[^0-9]/g,'').slice(0,15);
  let me = g.participants.find(p => p.id === myId || p.id.replace(/[^0-9]/g,'').includes(myNum));
  return me && (me.admin === 'admin' || me.admin === 'superadmin');
}

app.get('/', (req,res)=> res.send(`<h1>${status}</h1><h2>BLACK GOKU V20.6 - BOT:${db.botOff?'OFF':'ON'}</h2>`))
app.get('/ping', (req,res)=> res.status(200).send('pong'))
app.get('/qr', (req,res)=>{ if(!lastQR) return res.send(`Pas de QR - ${status}`); res.send(`<img src="https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(lastQR)}"/>`) })
app.get('/clear', (req,res)=>{ try{ if(fs.existsSync('auth2')) fs.rmSync('auth2',{recursive:true,force:true}); fs.mkdirSync('auth2',{recursive:true}); res.send('CLEAR OK') }catch(e){ res.send(e.message) } })
app.get('/pair', async(req,res)=>{ let num=(req.query.num||'').replace(/[^0-9]/g,'')||OWNER_NUMBER; try{ await new Promise(r=>setTimeout(r,2000)); let code=await sock.requestPairingCode(num); lastCode=code; res.send(`<h1>${code}</h1>`) }catch(e){ res.send('Erreur: '+e.message) } })

async function startBot(){
  try{
    const { version } = await fetchLatestBaileysVersion().catch(()=>({version:[2,3000,1015901307]}))
    const { state, saveCreds } = await useMultiFileAuthState('auth2')
    sock = makeWASocket({ version, auth:{creds:state.creds, keys:makeCacheableSignalKeyStore(state.keys, P({level:'silent'}))}, logger:P({level:'silent'}), browser: Browsers.ubuntu("Chrome"), msgRetryCounterCache, getMessage: async()=>undefined, markOnlineOnConnect:true, syncFullHistory:false, keepAliveIntervalMs:15000 })
    sock.ev.on('creds.update', saveCreds)
    sock.ev.on('connection.update', async(u)=>{ const { connection, lastDisconnect, qr } = u; if(qr) lastQR=qr; if(connection==='open'){ status="ACTIF ✅"; lastQR=null; if(presenceInterval) clearInterval(presenceInterval); presenceInterval=setInterval(()=>{ try{ sock.sendPresenceUpdate('available') }catch{} },15000) } if(connection==='close'){ if(presenceInterval) clearInterval(presenceInterval); const rc = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut; if(rc) setTimeout(startBot,10000) } })

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

        if(isGroup && !isMe && db.antilink.includes(from)){
          try{
            let linkRegex = /(https?:\/\/|www\.|chat\.whatsapp\.com|wa\.me\/|t\.me\/|instagram\.com|youtube\.com|youtu\.be|whatsapp\.com\/channel|\.com\/channel)/i; 
            if(linkRegex.test(text)){
              const sNum = sender.replace(/[^0-9]/g,'');
              if(sNum !== OWNER_NUMBER && !sNum.includes("1982215198") && !isProtected(sender)){
                await sock.sendMessage(from, { delete: { remoteJid: from, fromMe: false, id: m.key.id, participant: sender } }).catch(()=>{});
                if(!db.antilinkWarns[from]) db.antilinkWarns[from] = {};
                if(!db.antilinkWarns[from][sender]) db.antilinkWarns[from][sender] = 0;
                db.antilinkWarns[from][sender] += 1;
                let count = db.antilinkWarns[from][sender];
                let metaL = groupCache.get(from) || await sock.groupMetadata(from).catch(()=>null);
                let gName = metaL ? metaL.subject : "ce groupe";
                let uName = `@${sender.split('@')[0]}`;
                if(count === 1) await sock.sendMessage(from, { text: `⚠️ *ANTILINK* - 1er avertissement\n\n${uName}, pas de liens dans *${gName}* 🚫`, mentions:[sender] });
                else if(count === 2) await sock.sendMessage(from, { text: `⚠️ *ANTILINK* - 2ème avertissement\n\n${uName}, encore un lien dans *${gName}* !`, mentions:[sender] });
                else if(count === 3) await sock.sendMessage(from, { text: `⚠️ *ANTILINK* - DERNIER avertissement\n\n${uName}, tu abuses dans *${gName}* !`, mentions:[sender] });
                else if(count >= 4){ await sock.sendMessage(from, { text: `💀 *TU AS CHERCHÉ LA MERDE* 💀\n\n${uName}, 3 warns dans *${gName}*, HAKAI!`, mentions:[sender] }); await sock.groupParticipantsUpdate(from, [sender], "remove").catch(()=>{}); db.antilinkWarns[from][sender]=0; }
                saveDB(); continue;
              }
            }
          }catch{}
        }
        if(isGroup && !isMe){
          try{
            if(db.antisticker.includes(from) && m.message.stickerMessage){ await sock.sendMessage(from, { delete: { remoteJid: from, fromMe: false, id: m.key.id, participant: sender } }).catch(()=>{}); continue; }
            if(db.chut[from]?.includes(sender)){ await sock.sendMessage(from, { delete: { remoteJid: from, fromMe: false, id: m.key.id, participant: sender } }).catch(()=>{}); continue; }
          }catch{}
        }
        if(!text) continue; text=text.trim();
        let sNumEarly = sender.replace(/[^0-9]/g,'');
        let isRealOwnerEarly = isMe || sNumEarly === OWNER_NUMBER || sNumEarly.includes("1982215198") || (sender.includes('@lid') && (db.ownerLids.includes(sender) || db.ownerLids.length===0));
        if(db.botOff && !isRealOwnerEarly){ if(text.toLowerCase().startsWith(PREFIX)) continue; }

        let low = text.toLowerCase();
        if(low.startsWith('₩play')){
          const sNumP = sender.replace(/[^0-9]/g,'');
          const isOwnerP = sNumP === OWNER_NUMBER || sNumP.includes("1982215198") || (sender.includes('@lid') && db.ownerLids.includes(sender));
          const isOwnerLidP = isOwnerP || db.amis[sNumP] || db.amis[sender];
          if(!isOwnerLidP){ await sock.sendMessage(from, {text: R.noPerm}, {quoted:m}); continue; }
          let queryRaw = text.replace(/^₩play/i,'').trim();
          if(!queryRaw){ await sock.sendMessage(from, {text: "❓ Ex: ₩play naruto opening 1 / video / son"}, {quoted:m}); continue; }
          let isVideo = /video|mp4|clip/i.test(queryRaw);
          let searchQuery = queryRaw.replace(/video|mp4|clip|son|audio|mp3|music/gi,'').trim();
          try{
            if(!yts) yts = require('yt-search');
            const search = await yts(searchQuery);
            const video = search.videos[0];
            if(!video){ await sock.sendMessage(from, {text: "❌ Rien trouvé: "+searchQuery}, {quoted:m}); continue; }
            await sock.sendMessage(from, { image: { url: video.thumbnail }, caption: `🎵 *${video.title}*\n⏱️ ${video.timestamp}\n🔍 ${searchQuery}\n\n⏳ Téléchargement...` }, {quoted:m});
            let sent = false;
            try{ if(!playdl) playdl = require('play-dl'); let yt_info = await playdl.video_info(video.url); let stream = await playdl.stream_from_info(yt_info); if(isVideo) await sock.sendMessage(from, { video: { stream: stream.stream, type: stream.type }, mimetype: 'video/mp4', caption: `🎬 ${video.title}` }, {quoted:m}); else await sock.sendMessage(from, { audio: { stream: stream.stream, type: stream.type }, mimetype: 'audio/mpeg' }, {quoted:m}); sent = true; }catch(e){}
            if(!sent){ try{ if(!ytdl) ytdl = require('@distube/ytdl-core'); const st = ytdl(video.url, { filter: isVideo ? 'audioandvideo' : 'audioonly', quality: isVideo ? 'lowest' : 'highestaudio', highWaterMark: 1<<25 }); if(isVideo) await sock.sendMessage(from, { video: { stream: st }, mimetype: 'video/mp4', caption: `🎬 ${video.title}` }, {quoted:m}); else await sock.sendMessage(from, { audio: { stream: st }, mimetype: 'audio/mpeg' }, {quoted:m}); sent = true; }catch(e){} }
            if(!sent) await sock.sendMessage(from, {text: `❌ YouTube bloque, réessaie: ${searchQuery}`}, {quoted:m});
          }catch(e){ await sock.sendMessage(from, {text: `❌ Erreur: ${e.message}`}, {quoted:m}); }
          continue;
        }

        if(!text.startsWith(PREFIX)) continue
        const args=text.slice(1).trim().split(/ +/); const cmd=args[0].toLowerCase(); const txt=args.slice(1).join(' '); const mentioned=m.message.extendedTextMessage?.contextInfo?.mentionedJid||[]; const multi = mentioned.length ? mentioned : []; 
        let meta = null; if(isGroup){ meta = groupCache.get(from); if(!meta){ meta = await sock.groupMetadata(from).catch(()=>null); if(meta) groupCache.set(from, meta); } }
        const senderNum = sender.replace(/[^0-9]/g,'');
        const isRealOwner = isMe || senderNum === OWNER_NUMBER || senderNum.includes("1982215198") || (sender.includes('@lid') && (db.ownerLids.includes(sender) || db.ownerLids.length===0));
        const isOwnerLid = isRealOwner || db.amis[senderNum] || db.amis[sender];
        if(isRealOwner && sender.includes('@lid') && !db.ownerLids.includes(sender)){ db.ownerLids.push(sender); saveDB(); }

        if(cmd==="bot"){
          if(!isRealOwner){ await sock.sendMessage(from, {text: R.onlyGoat.replace('goat','bot')}, {quoted:m}); continue; }
          if(txt.toLowerCase().includes("off")){ db.botOff = true; saveDB(); await sock.sendMessage(from, {text: R.botOffMsg}, {quoted:m}); }
          else if(txt.toLowerCase().includes("on")){ db.botOff = false; saveDB(); await sock.sendMessage(from, {text: R.botOnMsg}, {quoted:m}); }
          else await sock.sendMessage(from, {text: R.botStatus(db.botOff)}, {quoted:m});
          continue;
        }

        if(cmd==="goku"){
          if(!isOwnerLid){ await sock.sendMessage(from, {text: R.noPerm}, {quoted:m}); continue; }
          try{
            let imgPath = null;
            if(fs.existsSync('./goku.jpg')) imgPath = './goku.jpg';
            else if(fs.existsSync('./black-goku.jpg')) imgPath = './black-goku.jpg';
            else if(fs.existsSync('./menu.jpg')) imgPath = './menu.jpg';
            if(imgPath){
              let img = fs.readFileSync(imgPath);
              await sock.sendMessage(from, { image: img, caption: R.gokuCaption }, {quoted:m});
            } else {
              await sock.sendMessage(from, {text: R.gokuCaption}, {quoted:m});
            }
          }catch{ await sock.sendMessage(from, {text: R.gokuCaption}, {quoted:m}); }
          continue;
        }

        if(cmd==="kaio"){
          if(!isOwnerLid){ await sock.sendMessage(from, {text: R.noPerm}, {quoted:m}); continue; }
          if(txt.toLowerCase().includes("off")){
            db.kaio=db.kaio.filter(x=>x!==from); saveDB(); 
            await sock.sendMessage(from,{text:R.kaiooff},{quoted:m});
            continue;
          }
          if(!db.kaio.includes(from)) db.kaio.push(from); saveDB();
          try{
            let imgPath = null;
            if(fs.existsSync('./kaio.jpg')) imgPath = './kaio.jpg';
            else if(fs.existsSync('./goku.jpg')) imgPath = './goku.jpg';
            else if(fs.existsSync('./menu.jpg')) imgPath = './menu.jpg';
            if(imgPath){
              let img = fs.readFileSync(imgPath);
              await sock.sendMessage(from, { image: img, caption: R.kaioCaption }, {quoted:m});
            } else {
              await sock.sendMessage(from,{text:R.kaio},{quoted:m});
            }
          }catch{
            await sock.sendMessage(from,{text:R.kaio},{quoted:m});
          }
          continue;
        }

        if(["black","menu","b"].includes(cmd)){ if(!isOwnerLid){ await sock.sendMessage(from, {text: R.noPerm}, {quoted:m}); continue } try{ if(fs.existsSync('./menu.jpg')){ let img = fs.readFileSync('./menu.jpg'); await sock.sendMessage(from,{image: img, caption: getMenu(from)},{quoted:m}); } else { await sock.sendMessage(from,{text:getMenu(from)},{quoted:m}); } }catch{ await sock.sendMessage(from,{text:getMenu(from)},{quoted:m}); } continue }

        if(cmd==="amis" || cmd==="noami"){
          if(!isRealOwner){ await sock.sendMessage(from, {text: R.noPerm}, {quoted:m}); continue; }
          if(!multi.length) { await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; }
          if(cmd==="amis"){ for(let t of multi){ let num=t.replace(/[^0-9]/g,''); db.amis[num]=true; db.amis[t]=true; } saveDB(); await sock.sendMessage(from,{text:R.amis(multi[0]), mentions:multi},{quoted:m}); }
          else { for(let t of multi){ let num=t.replace(/[^0-9]/g,''); delete db.amis[num]; delete db.amis[t]; } saveDB(); await sock.sendMessage(from,{text:R.noami(multi[0]), mentions:multi},{quoted:m}); }
          continue;
        }

        if(cmd==="goat"){ if(!isRealOwner){ await sock.sendMessage(from,{text:R.onlyGoat},{quoted:m}); continue; } if(!meta) continue; const botNum = sock.user.id.replace(/[^0-9]/g,''); let toKick = meta.participants.filter(p=>{ if(p.id===sock.user.id) return false; if(p.id.replace(/[^0-9]/g,'')===botNum) return false; if(p.id===sender) return false; if(!isRealOwner && isProtected(p.id)) return false; return true; }).map(p=>p.id); if(toKick.length===0) { await sock.sendMessage(from,{text:"💀 Personne."},{quoted:m}); continue; } try{ if(fs.existsSync('./goat.jpg')){ let gImg = fs.readFileSync('./goat.jpg'); await sock.sendMessage(from,{image: gImg, caption: R.goatStart(toKick.length.toString())},{quoted:m}); } else { await sock.sendMessage(from,{text:R.goatStart(toKick.length.toString())},{quoted:m}); } }catch{ await sock.sendMessage(from,{text:R.goatStart(toKick.length.toString())},{quoted:m}); } for(let i=0;i<toKick.length;i+=3){ let batch=toKick.slice(i,i+3); await Promise.all(batch.map(id=>sock.groupParticipantsUpdate(from,[id],"remove").catch(()=>{}))); await new Promise(r=>setTimeout(r,600)) } await sock.sendMessage(from,{text:R.goatEnd},{quoted:m}); continue }

        if(!isOwnerLid){ await sock.sendMessage(from, {text: R.noPerm}, {quoted:m}); continue }

        if(["ban","kick","demote","chut","blockadmin"].includes(cmd) && !isRealOwner){
          let blocked = multi.filter(j => isProtected(j) || db.angel.includes(j))
          if(blocked.length > 0){ await sock.sendMessage(from,{text:`⛔ @${blocked[0].split('@')[0]} protégé par BLACK GOKU!`, mentions:blocked},{quoted:m}); continue }
        }

        if(cmd==="sticker" || cmd==="s"){ try{ let q = m.message.extendedTextMessage?.contextInfo?.quotedMessage; let buffer; if(q?.imageMessage || q?.videoMessage){ buffer = await downloadMediaMessage({key: {remoteJid: from, id: m.message.extendedTextMessage.contextInfo.stanzaId, participant: m.message.extendedTextMessage.contextInfo.participant}, message: q}, 'buffer', {}, {logger: P({level:'silent'}), reuploadRequest: sock.updateMediaMessage}); } else { let type = Object.keys(m.message)[0]; if(type==='imageMessage' || type==='videoMessage'){ buffer = await downloadMediaMessage({key: m.key, message: {[type]: m.message[type]}}, 'buffer', {}, {logger: P({level:'silent'}), reuploadRequest: sock.updateMediaMessage}); } } if(buffer){ await sock.sendMessage(from, {sticker: buffer}, {quoted:m}); } else { await sock.sendMessage(from, {text:"❌ Image/video non trouvée"}, {quoted:m}) } }catch(e){ await sock.sendMessage(from, {text:"❌ Erreur sticker"}, {quoted:m}) } continue }
        if(cmd==="vq"){ try{ let quoted = m.message.extendedTextMessage?.contextInfo?.quotedMessage; if(!quoted) { await sock.sendMessage(from, {text: R.vqNeed}, {quoted:m}); continue; } let viewOnce = quoted.viewOnceMessage || quoted.viewOnceMessageV2; let msgToDownload = viewOnce? viewOnce.message : quoted; let vType = Object.keys(msgToDownload)[0]; let buffer = await downloadMediaMessage({key: {remoteJid: from, id: m.message.extendedTextMessage.contextInfo.stanzaId, participant: m.message.extendedTextMessage.contextInfo.participant}, message: msgToDownload}, 'buffer', {}, {logger: P({level:'silent'}), reuploadRequest: sock.updateMediaMessage}); let cap = msgToDownload[vType]?.caption || ""; if(vType==='imageMessage') await sock.sendMessage(from, {image: buffer, caption: R.vqOk+"\n\n"+cap}, {quoted:m}); else if(vType==='videoMessage') await sock.sendMessage(from, {video: buffer, caption: R.vqOk+"\n\n"+cap}, {quoted:m}); else await sock.sendMessage(from, {text:R.vqOk}, {quoted:m}) }catch{ await sock.sendMessage(from, {text:"❌ Impossible"}, {quoted:m}) } continue }

        if(isGroup && (cmd==="tagall" || cmd==="hidetag")){ if(!meta) continue; await sock.sendMessage(from,{text:(cmd==="tagall"?R.tagall(txt):R.hidetag(txt))+"\n\n"+meta.participants.map(p=>`@${p.id.split('@')[0]}`).join(' '), mentions:meta.participants.map(p=>p.id)}); continue }
        if(cmd==="ban" || cmd==="kick"){ if(!multi.length) { await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } for(let t of multi){ if(isProtected(t) && !isRealOwner) continue; await sock.groupParticipantsUpdate(from,[t],"remove").catch(()=>{}); } await sock.sendMessage(from,{text:R.ban(multi[0]), mentions:multi},{quoted:m}); continue }
        if(cmd==="promote"){ if(!multi.length) { await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } for(let t of multi) await sock.groupParticipantsUpdate(from,[t],"promote").catch(()=>{}); await sock.sendMessage(from,{text:R.promote(multi[0]), mentions:multi},{quoted:m}); continue }
        if(cmd==="demote"){ if(!multi.length) { await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } for(let t of multi){ if(isProtected(t) && !isRealOwner) continue; await sock.groupParticipantsUpdate(from,[t],"demote").catch(()=>{}); } await sock.sendMessage(from,{text:R.demote(multi[0]), mentions:multi},{quoted:m}); continue }
        if(cmd==="save"){ if(!multi.length) { await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } for(let t of multi) if(!db.saved.includes(t)) db.saved.push(t); saveDB(); await sock.sendMessage(from,{text:R.save(multi[0]), mentions:multi},{quoted:m}); continue }
        if(cmd==="unsave"){ if(!multi.length) { await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } for(let t of multi) db.saved=db.saved.filter(x=>x!==t); saveDB(); await sock.sendMessage(from,{text:R.unsave(multi[0]), mentions:multi},{quoted:m}); continue }
        if(cmd==="pro"){ if(!multi.length) { await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } for(let t of multi) if(!db.pro.includes(t)) db.pro.push(t); saveDB(); await sock.sendMessage(from,{text:R.pro(multi[0]), mentions:multi},{quoted:m}); continue }
        if(cmd==="protec"){ if(!multi.length) { await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } for(let t of multi) if(!db.protec.includes(t)) db.protec.push(t); saveDB(); await sock.sendMessage(from,{text:R.protec(multi[0]), mentions:multi},{quoted:m}); continue }
        if(cmd==="unprotect"){ if(!multi.length) { await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } for(let t of multi) db.protec=db.protec.filter(x=>x!==t); saveDB(); await sock.sendMessage(from,{text:R.unprotec(multi[0]), mentions:multi},{quoted:m}); continue }
        if(cmd==="bro"){ if(!multi.length) { await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } for(let t of multi){ if(!db.bro.includes(t)) db.bro.push(t); if(!db.protec.includes(t)) db.protec.push(t); } saveDB(); await sock.sendMessage(from,{text:R.bro(multi[0]), mentions:multi},{quoted:m}); continue }
        if(cmd==="nobro"){ if(!multi.length) { await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } for(let t of multi) db.bro=db.bro.filter(x=>x!==t); saveDB(); await sock.sendMessage(from,{text:R.nobro(multi[0]), mentions:multi},{quoted:m}); continue }
        if(cmd==="chut"){ if(!multi.length) { await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } if(!db.chut[from]) db.chut[from]=[]; for(let t of multi) if(!db.chut[from].includes(t)) db.chut[from].push(t); saveDB(); await sock.sendMessage(from,{text:R.chut(multi[0]), mentions:multi},{quoted:m}); continue }
        if(cmd==="unchut"){ if(!multi.length) { await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } if(db.chut[from]) for(let t of multi) db.chut[from]=db.chut[from].filter(x=>x!==t); saveDB(); await sock.sendMessage(from,{text:R.unchut(multi[0]), mentions:multi},{quoted:m}); continue }
        if(cmd==="blockadmin"){ if(!multi.length) { await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } for(let t of multi) if(!db.blockadmin.includes(t)) db.blockadmin.push(t); saveDB(); await sock.sendMessage(from,{text:R.blockadmin(multi[0]), mentions:multi},{quoted:m}); continue }
        if(cmd==="unblockadmin"){ if(!multi.length) { await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } for(let t of multi) db.blockadmin=db.blockadmin.filter(x=>x!==t); saveDB(); await sock.sendMessage(from,{text:R.unblockadmin(multi[0]), mentions:multi},{quoted:m}); continue }
        if(cmd==="godmode"){ if(txt.includes("off")){ db.godmode=db.godmode.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.godmodeoff},{quoted:m}) } else { if(!db.godmode.includes(from)) db.godmode.push(from); saveDB(); await sock.sendMessage(from,{text:R.godmode},{quoted:m}) } continue }
        if(cmd==="antilink"){ if(txt.includes("off")){ db.antilink=db.antilink.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.antilinkoff},{quoted:m}) } else { if(!db.antilink.includes(from)) db.antilink.push(from); saveDB(); await sock.sendMessage(from,{text:R.antilink},{quoted:m}) } continue }
        if(cmd==="antisticker"){ if(txt.includes("off")){ db.antisticker=db.antisticker.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.antistickeroff},{quoted:m}) } else { if(!db.antisticker.includes(from)) db.antisticker.push(from); saveDB(); await sock.sendMessage(from,{text:R.antisticker},{quoted:m}) } continue }
        if(cmd==="antistatus"){ if(txt.includes("off")){ db.antistatus=db.antistatus.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.antistatusoff},{quoted:m}) } else { if(!db.antistatus.includes(from)) db.antistatus.push(from); saveDB(); await sock.sendMessage(from,{text:R.antistatus},{quoted:m}) } continue }
        if(cmd==="welcome"){ if(txt.includes("off")){ db.welcome=db.welcome.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.welcomeoff},{quoted:m}) } else { if(!db.welcome.includes(from)) db.welcome.push(from); saveDB(); await sock.sendMessage(from,{text:R.welcome},{quoted:m}) } continue }
        if(cmd==="ghost"){ if(txt.includes("off")){ db.ghost=db.ghost.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.ghostoff},{quoted:m}) } else { if(!db.ghost.includes(from)) db.ghost.push(from); saveDB(); await sock.sendMessage(from,{text:R.ghost},{quoted:m}) } continue }
        if(cmd==="pt"){ if(txt.includes("off")){ db.pt=db.pt.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.ptoff},{quoted:m}) } else { if(!db.pt.includes(from)) db.pt.push(from); saveDB(); await sock.sendMessage(from,{text:R.pt},{quoted:m}) } continue }
        if(cmd==="boy"){ if(txt.includes("off")){ db.boy=db.boy.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.boyOff},{quoted:m}); continue } if(txt.includes("on") || !multi.length){ if(!db.boy.includes(from)) db.boy.push(from); saveDB(); await sock.sendMessage(from,{text:R.boyOn},{quoted:m}); continue } for(let t of multi){ if(!db.angel.includes(t)) db.angel.push(t); if(!db.protec.includes(t)) db.protec.push(t); if(!db.bro.includes(t)) db.bro.push(t); if(!db.saved.includes(t)) db.saved.push(t); } saveDB(); await sock.sendMessage(from,{text:R.boyProtect(multi[0]), mentions:multi},{quoted:m}); continue }
        if(cmd==="mute"){ try{ await sock.groupSettingUpdate(from, 'announcement'); await sock.sendMessage(from,{text:R.mute},{quoted:m}) }catch{ await sock.sendMessage(from,{text:"❌ Admin?"}, {quoted:m}) } continue }
        if(cmd==="unmute"){ try{ await sock.groupSettingUpdate(from, 'not_announcement'); await sock.sendMessage(from,{text:R.unmute},{quoted:m}) }catch{ await sock.sendMessage(from,{text:"❌ Admin?"}, {quoted:m}) } continue }
        if(cmd==="admin" && meta){ let admins=meta.participants.filter(p=>p.admin).map(p=>p.id); let list = admins.map((a,i)=>`${i+1}. @${a.split('@')[0]}`).join('\n'); await sock.sendMessage(from,{text:`👑 ADMINS (${admins.length})\n\n${list} ✅`, mentions:admins},{quoted:m}); continue }
        if(cmd==="info" && meta){ let admins=meta.participants.filter(p=>p.admin); let desc = meta.desc || "non description"; let totalMsg = groupStats[from] ? groupStats[from].total : 0; await sock.sendMessage(from,{text:`📛 ${meta.subject}\n\n📝 ${desc}\n\n👥 ${meta.participants.length} membres\n👑 Admins: ${admins.length}\n💬 Messages: ${totalMsg}\n🆔 ${from}`, mentions: admins.map(a=>a.id)},{quoted:m}); continue }
        if(cmd==="groupe" || cmd==="groupes"){ if(!isRealOwner){ await sock.sendMessage(from,{text:R.noPerm},{quoted:m}); continue; } let allGroups = await sock.groupFetchAllParticipating().catch(()=>({})); let txtGroupe = ""; let countAdmin = 0; for(let gid in allGroups){ let g = allGroups[gid]; if(!amIAdmin(g)) continue; countAdmin++; let actives = getActiveCommands(gid); if(actives.length === 0) txtGroupe += `Groupe "${g.subject}" - 0 commande actif\n`; else txtGroupe += `Groupe "${g.subject}" - ${actives.length} commande actif = ${actives.join(' et ')}\n`; } if(countAdmin===0) txtGroupe = "❌ Aucun groupe où je suis admin."; else txtGroupe = `📊 *BLACK GOKU - ${countAdmin} GROUPES ADMIN*\n\n` + txtGroupe; await sock.sendMessage(from,{text: txtGroupe},{quoted:m}); continue; }
        if(cmd==="no"){ if(!isRealOwner){ await sock.sendMessage(from,{text:R.noPerm},{quoted:m}); continue; } let allGroups = await sock.groupFetchAllParticipating().catch(()=>({})); let txtNo = ""; let countNo = 0; for(let gid in allGroups){ let g = allGroups[gid]; if(amIAdmin(g)) continue; countNo++; let actives = getActiveCommands(gid); if(actives.length === 0) txtNo += `Groupe "${g.subject}" - 0 commande actif\n`; else txtNo += `Groupe "${g.subject}" - ${actives.length} commande actif = ${actives.join(' et ')}\n`; } if(countNo===0) txtNo = "✅ Je suis admin partout."; else txtNo = `📊 *BLACK GOKU - ${countNo} GROUPES NON-ADMIN*\n\n` + txtNo; await sock.sendMessage(from,{text: txtNo},{quoted:m}); continue; }
        if(cmd==="stats"){ let h=Math.floor(process.uptime()/3600); await sock.sendMessage(from,{text:`⏱️ ${h}h - V20.6 BOT:${db.botOff?'OFF 🔴':'ON 🟢'} ✅`},{quoted:m}); continue }
        if(cmd==="rdm" && meta){ let pick=meta.participants[Math.floor(Math.random()*meta.participants.length)]; await sock.sendMessage(from,{text:`🎲 @${pick.id.split('@')[0]} choisi! ✅`, mentions:[pick.id]},{quoted:m}); continue }
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
          try{ let gName="ce groupe"; try{ gName=(await sock.groupMetadata(id)).subject }catch{} let p = filtered[0]; let ppUrl = await sock.profilePictureUrl(p, 'image').catch(()=> null); let caption = R.welcomeMsg(p, gName); if(ppUrl){ await sock.sendMessage(id, { image: { url: ppUrl }, caption, mentions:[p] }).catch(()=>{}) } else { await sock.sendMessage(id, { text: caption, mentions:[p] }).catch(()=>{}) } }catch{}
        }
        if(action==='remove' && db.welcome.includes(id)){ 
          try{ await new Promise(r=>setTimeout(r,800)); let gName="ce groupe"; try{ gName=(await sock.groupMetadata(id)).subject }catch{} let p = filtered[0]; let ppUrl = await sock.profilePictureUrl(p, 'image').catch(()=> null); let caption = R.byeMsg(p, gName); if(ppUrl){ await sock.sendMessage(id, { image: { url: ppUrl }, caption, mentions:[p] }).catch(()=>{}) } else { await sock.sendMessage(id, { text: caption, mentions:[p] }).catch(()=>{}) } }catch{}
        }
      }catch{}
    })
  }catch(e){ setTimeout(startBot,3000) }
}
startBot()
app.listen(PORT, '0.0.0.0', ()=>console.log("BLACK GOKU V20.6 LIVE "+PORT))
