const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, Browsers, downloadMediaMessage, DisconnectReason } = require('@whiskeysockets/baileys')
const P = require('pino')
const fs = require('fs')
const express = require('express')
const NodeCache = require('node-cache')
const axios = require('axios')
const app = express()
const PORT = process.env.PORT || 10000
if (!fs.existsSync('auth2')) fs.mkdirSync('auth2', { recursive: true })
let yts, ytdl, playdl
try { yts = require('yt-search'); } catch(e) {}
try { ytdl = require('@distube/ytdl-core'); } catch(e) {}
try { playdl = require('play-dl'); } catch(e) {}
const OWNER_NUMBER = process.env.OWNER_NUMBER || "5551982215198"
const PREFIX = "₩"
const DB_FILE = './black_db.json'
const msgRetryCounterCache = new NodeCache({ stdTTL: 0, checkperiod: 0 })
const groupCache = new NodeCache({ stdTTL: 60, useClones: false })
let db = { amis:{}, saved:[], pro:[], protec:[], zenkai:[], angel:[], chut:{}, blockadmin:[], godmode:[], kaio:[], antilink:[], antisticker:[], antistatus:[], welcome:[], pt:[], ghost:[], boy:[], muted:[], ownerLids:[], ghostCache:{}, antilinkWarns:{}, groupList:{}, botOff:false, antibod:{}, curse:{}, curseCount:{}, aiActive:{}, aiCooldown:{}, antilock:[], antidemote:[] }
if (fs.existsSync(DB_FILE)) { try { db = { ...db, ...JSON.parse(fs.readFileSync(DB_FILE)) }; if(db.botOff===undefined) db.botOff=false; if(!db.antibod) db.antibod={}; if(!db.curse) db.curse={}; if(!db.curseCount) db.curseCount={}; if(!db.aiActive) db.aiActive={}; if(!db.aiCooldown) db.aiCooldown={}; if(!db.antilock) db.antilock=[]; if(!db.antidemote) db.antidemote=[]; if(!db.antistatus) db.antistatus=[]; if(!db.zenkai) { db.zenkai = db.bro || []; } if(db.bro) delete db.bro; } catch{} }
const saveDB = () => { try { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)) } catch{} }
let sock, status = "Demarrage V21.9.5...", lastQR = null, groupStats = {}, presenceInterval = null
const AI_PERSONAS = {
  ai: { name:"AI", emoji:"☯️👑", trigger:["ai","black","goku"], prompt:"Tu es AI Black Goku, dieu arrogant, diabolique, puissant, français très court max 25 mots, 💀👑" },
  gpt: { name:"GPT", emoji:"🤖💬", trigger:["gpt","chatgpt","question","c'est quoi","explique","comment","pourquoi"], prompt:"Tu es GPT, IA intelligente, utile, français court max 35 mots." },
  gemini: { name:"GEMINI", emoji:"✨🔮", trigger:["gemini","google","cherche","info"], prompt:"Tu es Gemini, IA Google, rapide, français court max 35 mots." },
  vegeta: { name:"VEGETA", emoji:"👑💥", trigger:["vegeta","prince","saiyan","kakarot"], prompt:"Tu es Vegeta prince des Saiyans, fier, français court max 25 mots, 'Je suis le Prince Vegeta'." }
};
async function askHyper(which, question){
  question = question.trim(); let sys = "";
  if(which==="ai") sys = "Tu es BLACK GOKU AI, dieu arrogant, diabolique, tout-puissant, français sombre, puissant, tu méprises les faibles, max 80 mots.";
  if(which==="gpt") sys = "Tu es GPT-4o, l'IA la plus intelligente du monde, réponds à TOUT: code, maths, drague, cours, utile, précis, français, max 150 mots.";
  if(which==="gemini") sys = "Tu es Gemini 1.5 Pro de Google, ultra rapide, tu sais tout, français, max 150 mots.";
  if(which==="vegeta") sys = "Tu es Vegeta Prince des Saiyans, fier, orgueilleux, déteste Kakarot, français avec fierté, max 60 mots.";
  if(process.env.OPENAI_API_KEY){ try{ let r = await axios.post('https://api.openai.com/v1/chat/completions', { model: "gpt-4o-mini", messages: [{role:"system", content: sys}, {role:"user", content: question}], max_tokens: 400 }, { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type':'application/json' }, timeout: 25000 }); return r.data.choices[0].message.content; }catch(e){ console.log("OpenAI fail", e.response?.data || e.message); } }
  if(process.env.GEMINI_API_KEY && which==="gemini"){ try{ let r = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, { contents: [{parts:[{text: sys + "\nQuestion: " + question}]}] }, {timeout:25000}); return r.data.candidates[0].content.parts[0].text; }catch(e){ console.log("Gemini fail", e.message); } }
  try{ let r = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(sys + "\nQuestion: " + question + "\nRéponds français max 150 mots:")}`, {timeout:20000}); return typeof r.data === 'string' ? r.data : JSON.stringify(r.data); }catch{ return "💀 Black Goku réfléchit... Réessaie."; }
}
const menuFR = `꧁༒☬ BLACK GOKU ☬༒꧂
┏━ ✦ MEMBRES ✦ ━┓
┃ ₩tagall
┃ ₩hidetag
┃ ₩kick / ₩ban @m
┃ ₩promote / ₩demote @m
┃ ₩mute / ₩unmute
┃ ₩admin / ₩info / ₩stats
┃ ₩play son/video
┃ ₩goku / ₩kaio
┃ ₩time / ₩tim
┗━━━━━━━━━━━━━━┛
┏━ ✦ PUNITIONS ✦ ━┓
┃ ₩chut @m / ₩unchut @m
┃ ₩blockadmin @m / ₩unblockadmin @m
┃ ₩reini @m
┃ ₩curse @m / ₩uncurse @m
┃ ₩neant
┃ ₩goat
┗━━━━━━━━━━━━━━┛
┏━ ✦ PROTECTION ✦ ━┓
┃ ₩save / ₩unsave @m
┃ ₩pro @m
┃ ₩protec / ₩unprotect @m
┃ ₩zenkai / ₩nozenkai @m
┃ ₩boy on/off / @m
┃ ₩godmode /off
┃ ₩kaio /off
┃ ₩antilink /off
┃ ₩antibod 
┃ ₩antilock /off
┃ ₩antidemote /off
┃ ₩antisticker /off
┃ ₩antistatus /off
┃ ₩welcome /off
┃ ₩ghost /off
┃ ₩pt /off
┗━━━━━━━━━━━━━━┛
┏━ ✦ IA HYPER ✦ ━┓
┃ ₩ai question
┃ ₩gpt question
┃ ₩gemini 
┃ ₩vegeta 
┃ ₩aion / ₩aioff
┃ ₩aistatus
┗━━━━━━━━━━━━━━┛
┏━ ✦ OWNER ✦ ━┓
┃ ₩amis @m / ₩noami @m
┃ ₩groupe / ₩no
┃ ₩bot on/off
┃ ₩rdm / ₩vq / ₩help
┗━━━━━━━━━━━━━━┛
  *BLACK GOKU*`
const R_FR = {
  noPerm:"💀 *TOUCHE PAS À CE QUI N'EST PAS À TOI, FAIBLE.*\n\n *SEUL BLACK GOKU COMMANDE ICI. TOI, TU OBEIS. C'EST TOUT😈.*",
  creatorProtect:"☯️👑 *TU OSES T'ATTAQUER À MOI?*\n\n💀 *JE SUIS BLACK GOKU, LE CRÉATEUR DE CE MONDE.*\n\nTu n'es qu'un insecte devant moi miserable.*\n\n🔥 *TA TENTATIVE EST PATHÉTIQUE. GENOUX À TERRE, MORTEL.*\n\n— BLACK GOKU —",
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
  zenkai:(j)=>`👑 ZENKAI!\n\n@${j.split('@')[0]} est Élu par Black Goku! Protégé par Black Goku!\n\n— BLACK GOKU —`,
  nozenkai:(j)=>`💀 ZENKAI RETIRÉ!\n\n@${j.split('@')[0]} n'est plus protégé par Black Goku\n\n— BLACK GOKU —`,
  godmode:"☯️🔥 *MODE ULTIME BLACK GOKU ACTIVÉ!*", godmodeoff:"💀 MODE ULTIME OFF.",
  kaio:"🔥 *KAIO-KEN X100 ON!*", kaiooff:"KAIO OFF.",
  kaioCaption:"🔥☯️ *KAIO-KEN X100 ACTIVÉ!* ☯️🔥\n\n\"Ton existence est une erreur que je vais corriger.\"\n\n— BLACK GOKU —",
  antilink:"🔗 *ANTILINK TOTAL ON!* Bloque liens + chaines WhatsApp", antilinkoff:"ANTILINK OFF.",
  antisticker:"🖼️ *ANTISTICKER ON!*", antistickeroff:"ANTISTICKER OFF.",
  antistatus:"👁️ *ANTISTATUS ON!* Supprime mentions status auto", antistatusoff:"ANTISTATUS OFF.",
  welcome:"👋 *WELCOME ON - avec photo + anti-spam*", welcomeoff:"WELCOME OFF.",
  welcomeMsg:(j,g)=>`Bienvenue @${j.split('@')[0]} 👋\n\nBienvenue dans *${g}* !\nJe suis Black Goku, comporte toi bien et je te souhaite la bienvenue😁✨`,
  byeMsg:(j,g)=>`À plus @${j.split('@')[0]} 👋\n\nIl a quitté *${g}* \nOn espère te revoir bientôt !`,
  vqOk:"👁️🔥 *VUE UNIQUE DÉVOILÉE* 🔥👁️", vqNeed:"😈 Réponds à une vue unique avec ₩vq!",
  ghost:"👻💀 *GHOST DIABLE ON* Capture auto", ghostoff:"👻 GHOST OFF.",
  ghostListEmpty:"👻 *GHOST LISTE VIDE*\n\nAucun message capturé. Active avec ₩ghost",
  boyOn:"👼✨ *ANGE PROTECTEUR ACTIVÉ!* ✨👼", boyOff:"👼 ANGE MODE OFF.", boyProtect:(j)=>`👼✨ @${j.split('@')[0]} est maintenant ANGE! INTOUCHABLE! ✨`,
  pt:"🇧🇷 PT ON!", ptoff:"🇫🇷 PT OFF!",
  amis:(j)=>`✅ @${j.split('@')[0]} AMI!`, noami:(j)=>`❌💀 @${j.split('@')[0]} BANNI!`,
  botOffMsg:"💀 *BLACK GOKU ÉTEINT* 💀\n\n🔒 Le bot est fermé.\n👑 Seul le créateur peut le rallumer avec ₩bot on",
  botOnMsg:"☯️🔥 *BLACK GOKU ALLUMÉ* 🔥☯️\n\n✅ Le bot est de retour!",
  botStatus:(off)=>`🤖 Bot est actuellement: *${off ? 'OFF 🔴' : 'ON 🟢'}*\n\n₩bot on = allumer\n₩bot off = éteindre`,
  gokuCaption:"\"Ton existence est une erreur que je vais corriger.\"\n\n— BLACK GOKU —",
  goatStart:(n)=>`☯️👑 *C'EST MOI, BLACK GOKU😈. Votre CAUCHEMAR.*\n\n💀 *${n} FAIBLES... HAKAI!*`,
  goatEnd:`꧁༒☬ *FINI* ☬༒꧂\n\n☠️ *PLUS RIEN. J'AI NETTOYÉ. BLACK GOKU.* 👑`
}
const getR = () => R_FR
const getMenu = () => menuFR
function isProtected(jid){ if(!jid) return false; const num = jid.replace(/[^0-9]/g,''); if(num === OWNER_NUMBER) return true; if(num.includes("1982215198")) return true; if(db.ownerLids.includes(jid)) return true; if(db.zenkai.includes(jid)) return true; if(db.protec.includes(jid)) return true; if(db.angel.includes(jid)) return true; if(db.saved.includes(jid)) return true; return false }
function isCreator(jid){ if(!jid) return false; let num = jid.replace(/[^0-9]/g,''); return num === OWNER_NUMBER || num.includes("1982215198") || db.ownerLids.includes(jid) }
function getActiveCommands(gid){ let a = []; if(db.antilink.includes(gid)) a.push("antilink"); if(db.antibod && db.antibod[gid]) a.push("antibod"+db.antibod[gid]); if(db.antisticker.includes(gid)) a.push("antisticker"); if(db.antistatus.includes(gid)) a.push("antistatus"); if(db.welcome.includes(gid)) a.push("welcome"); if(db.ghost.includes(gid)) a.push("ghost"); if(db.boy.includes(gid)) a.push("boy"); if(db.godmode.includes(gid)) a.push("godmode"); if(db.kaio.includes(gid)) a.push("kaio"); if(db.pt.includes(gid)) a.push("pt"); if(db.antilock.includes(gid)) a.push("antilock"); if(db.antidemote.includes(gid)) a.push("antidemote"); if(db.curse[gid]) a.push("curse"); if(db.aiActive[gid] && Object.values(db.aiActive[gid]).some(v=>v)) a.push("ai"); return a; }
function amIAdmin(g){ if(!sock) return false; const myId = sock.user.id; const myNum = myId.split(':')[0].replace(/[^0-9]/g,'').slice(0,15); let me = g.participants.find(p => p.id === myId || p.id.replace(/[^0-9]/g,'').includes(myNum)); return me && (me.admin === 'admin' || me.admin === 'superadmin'); }
app.get('/', (req,res)=> res.send(`<html><head><title>BLACK GOKU V21.9.5</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{background:#0a0a0a;color:#fff;font-family:Arial;text-align:center;padding:20px}h1{color:#a020f0}a,button{background:#a020f0;color:#fff;padding:15px 25px;border-radius:10px;text-decoration:none;display:inline-block;margin:10px;font-weight:bold;border:none;font-size:16px;cursor:pointer}input{padding:15px;border-radius:10px;border:none;width:80%;max-width:300px;margin:10px;text-align:center;font-size:16px}.card{background:#1a1a1a;padding:20px;border-radius:15px;margin:20px auto;max-width:400px;border:1px solid #a020f0}</style></head><body><h1>☯️ BLACK GOKU V21.9.5 FULL - NO BAD MAC</h1><h2>${status} - BOT:${db.botOff?'OFF 🔴':'ON 🟢'} - IA:${process.env.OPENAI_API_KEY?'HYPER ✅':'GRATUIT'}</h2><div class="card"><h3>🔢 CODE 8 CHIFFRES</h3><input id="num" value="5551982215198"><br><button onclick="let n=document.getElementById('num').value.replace(/[^0-9]/g,''); location.href='/pair?num='+n">OBTENIR CODE</button></div><div class="card"><a href="/qr" target="_blank">QR CODE</a></div><div class="card"><a href="/clear" style="background:#ff0040">CLEAR SESSION - FIX BAD MAC</a></div></body></html>`))
app.get('/qr', (req,res)=>{ if(!lastQR) return res.send(`<html><body style="background:#000;color:#fff;text-align:center;padding:50px"><h1>Pas de QR - ${status}</h1><p>Attends 10s</p><a href="/" style="color:#a020f0">Retour</a><script>setTimeout(()=>location.reload(),5000)</script></body></html>`); res.send(`<html><body style="text-align:center;background:#000;padding:20px"><h1 style="color:#a020f0">SCANNE CE QR</h1><img src="https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(lastQR)}" style="border:10px solid #a020f0;border-radius:20px"/><br><br><a href="/" style="background:#a020f0;color:#fff;padding:15px 25px;border-radius:10px;text-decoration:none">Retour</a><script>setTimeout(()=>location.reload(),20000)</script></body></html>`) })
app.get('/clear', (req,res)=>{ try{ if(fs.existsSync('auth2')) fs.rmSync('auth2',{recursive:true,force:true}); fs.mkdirSync('auth2',{recursive:true}); lastQR=null; status="CLEAR OK - NO BAD MAC - Redemarrage..."; res.send('CLEAR OK - Auth supprimé - Attends 25s puis /pair'); setTimeout(()=>{ try{ startBot(); }catch{} },1500); }catch(e){ res.send(e.message) } })
app.get('/pair', async(req,res)=>{ let num=(req.query.num||'').replace(/[^0-9]/g,'')||"5551982215198"; try{ if(!sock) return res.send(`<html><body style="background:#000;color:#fff;text-align:center;padding:30px"><h1>Bot démarre V21.9.5... 10s</h1><script>setTimeout(()=>location.href="/pair?num=${num}",4000)</script></body></html>`); if(fs.existsSync('auth2/creds.json')){ try{ let data = fs.readFileSync('auth2/creds.json','utf8'); if(data.length > 100 && !data.includes('Bad MAC')) return res.send(`<html><body style="background:#000;color:#fff;text-align:center;padding:30px"><h1 style="color:orange">Déjà connecté!</h1><p>Déconnecte: WhatsApp > Appareils liés</p><p>Puis <a href="/clear">CLEAR</a></p></body></html>`); }catch{} } await new Promise(r=>setTimeout(r,1500)); let code=await sock.requestPairingCode(num); let pretty = code.includes('-') ? code : code.match(/.{1,4}/g)?.join('-') || code; res.send(`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{background:#0a0a0a;color:#fff;font-family:Arial;text-align:center;padding:20px}h1{color:#a020f0}.code{font-size:42px;letter-spacing:8px;background:#1a1a1a;padding:20px;border-radius:15px;border:2px solid #a020f0;margin:20px}.box{background:#222;padding:15px;border-radius:10px;text-align:left;max-width:400px;margin:20px auto}a,button{background:#a020f0;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;display:inline-block;margin:5px}</style></head><body><h1>CODE POUR ${num} - V21.9.5</h1><div class="code">${pretty}</div><div class="box"><p>WhatsApp > Appareils liés > Lier avec numéro > Colle <b>${code}</b></p><p style="color:orange">⏰ 15s MAX!</p></div><a href="/pair?num=${num}">NOUVEAU CODE</a><a href="/" style="background:#444">Retour</a></body></html>`) }catch(e){ res.send(`<html><body style="background:#000;color:#fff;text-align:center;padding:20px"><h1>Erreur: ${e.message}</h1><p>Fais /clear + attends 25s</p><a href="/">Retour</a></body></html>`) } })
async function startBot(){
  try{
  const { version } = await fetchLatestBaileysVersion().catch(()=>({version:[2,3000,1015901307]}))
  const { state, saveCreds } = await useMultiFileAuthState('auth2')
  sock = makeWASocket({ version, auth:{creds:state.creds, keys:makeCacheableSignalKeyStore(state.keys, P({level:'silent'}))}, logger:P({level:'silent'}), browser: Browsers.macOS("Desktop"), msgRetryCounterCache, getMessage: async()=>undefined, markOnlineOnConnect:true, syncFullHistory:false, shouldIgnoreJid: jid => false })
  sock.ev.on('creds.update', saveCreds)
  sock.ev.on('connection.update', async(u)=>{ 
    const { connection, lastDisconnect, qr } = u; 
    if(qr) lastQR=qr; 
    if(connection==='open'){ status="ACTIF V21.9.5 NO BAD MAC ✅"; if(presenceInterval) clearInterval(presenceInterval); presenceInterval=setInterval(()=>{ try{ sock.sendPresenceUpdate('available') }catch{} },15000) } 
    if(connection==='close'){
      let reason = lastDisconnect?.error?.output?.statusCode; let msgError = lastDisconnect?.error?.message || ""; console.log("Close:", reason, msgError);
      if(msgError.includes('Bad MAC') || msgError.includes('Invalid MAC') || msgError.includes('405') || msgError.toLowerCase().includes('mac') || msgError.toLowerCase().includes('auth')){
        console.log("BAD MAC DETECTE -> RESET AUTO V21.9.5");
        status="Bad MAC detecte - Auto Reset V21.9.5...";
        if(fs.existsSync('auth2')) fs.rmSync('auth2',{recursive:true,force:true});
        fs.mkdirSync('auth2',{recursive:true});
        setTimeout(()=>startBot(), 3000); return;
      }
      if(reason !== DisconnectReason.loggedOut){ status="Reconnexion V21.9.5..."; setTimeout(()=>startBot(), 3000); } else { status="Deconnecte - Fais /clear"; if(fs.existsSync('auth2')) fs.rmSync('auth2',{recursive:true,force:true}); fs.mkdirSync('auth2',{recursive:true}); }
    }
  })
  sock.ev.on('messages.upsert', async({messages, type})=>{
    if(type!=='notify') return
    for (let m of messages) {
      if(!m?.message) continue
      const from=m.key.remoteJid; const sender = m.key.participant || m.key.remoteJid || from; 
      let text = m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || m.message.videoMessage?.caption || "";
      const isGroup = from.endsWith('@g.us'); const isMe = m.key.fromMe;
      const R = getR();
      if(!groupStats[from]) groupStats[from] = { total: 0 }; groupStats[from].total++;
      if(isGroup && db.ghost.includes(from) && !isMe && text){ if(!db.ghostCache[from]) db.ghostCache[from]=[]; db.ghostCache[from].push({sender, text, time:Date.now(), id:m.key.id}); if(db.ghostCache[from].length>200) db.ghostCache[from].shift(); saveDB(); }
      if(isGroup && db.curse && db.curse[from]?.includes(sender) && !isMe && !isProtected(sender)){
        let originalText = text || "une photo/vidéo";
        if(originalText.length > 100) originalText = originalText.slice(0,100)+"...";
        if(!db.curseCount[from]) db.curseCount[from]={}; db.curseCount[from][sender] = (db.curseCount[from][sender]||0)+1; let n = db.curseCount[from][sender]; saveDB();
        setTimeout(async()=>{ try{ await sock.sendMessage(from,{delete:{remoteJid:from,fromMe:false,id:m.key.id,participant:sender}}); }catch{} }, 3000);
        const humiliations = ["Je rampe devant Black Goku, je ne suis qu'un insecte","Pardonnez-moi d'avoir osé parler, je suis indigne","Black Goku est mon maître, je ne suis que poussière","Je supplie Black Goku de me laisser exister encore","Je suis faible, pathétique, sans votre pitié je ne suis rien","Mon existence est une erreur que Black Goku corrige","Je parle mais ma voix n'est que vent, je n'existe pas","Black Goku a scellé mon âme, je suis son esclave"];
        let humiliation = humiliations[n % humiliations.length];
        setTimeout(async()=>{ try{ await sock.sendMessage(from,{text:`⛓️💀 *VOIX VOLÉE #${n}* 💀⛓️\n\n@${sender.split('@')[0]} a essayé de dire:\n> "${originalText}"\n\nMais sa malédiction a transformé sa voix en:\n> "${humiliation}... #${n}"\n\n😈 *Black Goku contrôle ce que vous entendez* 😈`,mentions:[sender]}); }catch{} }, 4000);
        if(n % 3 === 0){ setTimeout(async()=>{ try{ await sock.sendMessage(from,{text:`꧁༒☬ *TABLEAU DE LA HONTE* ☬༒꧂\n\n@${sender.split('@')[0]} est maudit depuis ${n} messages...\n\n📊 ${n} tentatives\n📉 0 mots à lui\n👑 100% contrôlé par Black Goku\n\n💀 Sa voix appartient à Black Goku.`,mentions:[sender]}); }catch{} }, 6000); }
        continue;
      }
      if(isGroup && !isMe && db.antilink.includes(from)){
        try{
          let tlow = text.toLowerCase();
          let isLink = tlow.includes("https://") || tlow.includes("http://") || tlow.includes("www.") || tlow.includes("chat.whatsapp.com") || tlow.includes("wa.me/") || tlow.includes("whatsapp.com/channel") || tlow.includes("/channel/") || tlow.includes("t.me/") || tlow.includes("instagram.com") || tlow.includes("youtube.com");
          if(isLink && !isProtected(sender)){ await sock.sendMessage(from, { delete: { remoteJid: from, fromMe: false, id: m.key.id, participant: sender } }).catch(()=>{}); if(!db.antilinkWarns[from]) db.antilinkWarns[from]={}; db.antilinkWarns[from][sender]=(db.antilinkWarns[from][sender]||0)+1; if(db.antilinkWarns[from][sender]>=4){ await sock.groupParticipantsUpdate(from,[sender],"remove").catch(()=>{}); db.antilinkWarns[from][sender]=0; } saveDB(); continue; }
        }catch{}
      }
      if(isGroup && !isMe && db.antistatus.includes(from)){
        try{
          let isStatusMention = false; if(m.message.groupStatusMentionMessage) isStatusMention = true; if(Object.keys(m.message)[0] === 'groupStatusMentionMessage') isStatusMention = true; if(m.message.extendedTextMessage?.contextInfo?.quotedMessage?.groupStatusMentionMessage) isStatusMention = true; if(m.message.protocolMessage?.type === 25) isStatusMention = true;
          if(isStatusMention && !isProtected(sender)){ await sock.sendMessage(from, { delete: { remoteJid: from, fromMe: false, id: m.key.id, participant: sender } }).catch(()=>{}); continue; }
        }catch{}
      }
      if(isGroup && db.antibod && db.antibod[from] && !isMe && !isProtected(sender)){
        let b=text.trim(); let isCmd=b.startsWith('.')||b.startsWith('!')||b.startsWith('/')||(b.startsWith('₩')&&!b.toLowerCase().startsWith('₩antibod')&&!b.toLowerCase().startsWith('₩reini')&&!b.toLowerCase().startsWith('₩curse')&&!b.toLowerCase().startsWith('₩neant')&&!b.toLowerCase().startsWith('₩help')&&!b.toLowerCase().startsWith('₩ai')&&!b.toLowerCase().startsWith('₩gpt')&&!b.toLowerCase().startsWith('₩gemini')&&!b.toLowerCase().startsWith('₩vegeta'));
        if(isCmd){ await sock.sendMessage(from,{delete:{remoteJid:from,fromMe:false,id:m.key.id,participant:sender}}).catch(()=>{}); continue; }
      }
      if(isGroup && !isMe){ try{ if(db.antisticker.includes(from) && m.message.stickerMessage){ await sock.sendMessage(from,{delete:{remoteJid:from,fromMe:false,id:m.key.id,participant:sender}}).catch(()=>{}); continue; } if(db.chut[from]?.includes(sender)){ await sock.sendMessage(from,{delete:{remoteJid:from,fromMe:false,id:m.key.id,participant:sender}}).catch(()=>{}); continue; } }catch{} }
      if(!text) continue; text=text.trim();
      let directMatch = text.toLowerCase().match(/^₩(ai|gpt|gemini|vegeta)\s+(.+)/i);
      if(directMatch){
        const senderNum=sender.replace(/[^0-9]/g,''); const isRealOwner=isMe||senderNum===OWNER_NUMBER||senderNum.includes("1982215198")||db.ownerLids.includes(sender); const isOwnerLid=isRealOwner||db.amis[senderNum]||db.amis[sender]||db.amis[sender.split('@')[0]];
        if(!isOwnerLid){ await sock.sendMessage(from,{text:R.noPerm},{quoted:m}); continue; }
        let which = directMatch[1].toLowerCase(); let question = directMatch[2].trim(); let persona = AI_PERSONAS[which];
        try{ await sock.sendMessage(from,{text:`${persona.emoji} *${persona.name} RÉFLÉCHIT EN HYPER...*`},{quoted:m}); let ans = await askHyper(which, question); if(ans.length>1000) ans=ans.slice(0,1000)+"..."; await sock.sendMessage(from,{text:`${persona.emoji} *${persona.name} HYPER*\n\n❓ ${question}\n\n💬 ${ans}`},{quoted:m}); }catch(e){ await sock.sendMessage(from,{text:`❌ Erreur ${persona.name}`},{quoted:m}); }
        continue;
      }
      if(!text.startsWith(PREFIX) && isGroup && !isMe && text.length>3 && text.length<300){
        let active = db.aiActive[from]; if(active && Object.values(active).some(v=>v)){ if(!db.aiCooldown) db.aiCooldown={}; let last = db.aiCooldown[from]||0; if(Date.now()-last > 10000){ let lower = text.toLowerCase(); let toAnswer = null; for(let k in AI_PERSONAS){ if(!active[k]) continue; if(AI_PERSONAS[k].trigger.some(t=> lower.includes(t))){ toAnswer=k; break; } } if(!toAnswer && lower.includes("?") && active.gpt) toAnswer="gpt"; else if(!toAnswer && lower.includes("?") && active.gemini) toAnswer="gemini"; else if(!toAnswer && lower.includes("?") && active.ai) toAnswer="ai"; else if(!toAnswer && active.ai && Math.random()<0.05) toAnswer="ai"; if(toAnswer){ db.aiCooldown[from]=Date.now(); saveDB(); try{ let persona = AI_PERSONAS[toAnswer]; let ans = await askHyper(toAnswer, text); if(ans.length>300) ans=ans.slice(0,300); await sock.sendMessage(from,{text:`${persona.emoji} *${persona.name}:* ${ans}`}); }catch{} } } }
      }
      if(text.toLowerCase().startsWith('₩play')){
        const sNumP = sender.replace(/[^0-9]/g,''); const isOwnerP = sNumP === OWNER_NUMBER || sNumP.includes("1982215198") || db.ownerLids.includes(sender) || db.amis[sNumP] || db.amis[sender];
        if(!isOwnerP){ await sock.sendMessage(from, {text: R.noPerm}, {quoted:m}); continue; }
        let queryRaw = text.replace(/^₩play/i,'').trim(); if(!queryRaw){ await sock.sendMessage(from, {text: "❓ Ex: ₩play naruto opening 1 / video / son"}, {quoted:m}); continue; }
        let isVideo = /video|mp4|clip/i.test(queryRaw); let searchQuery = queryRaw.replace(/video|mp4|clip|son|audio|mp3|music/gi,'').trim();
        try{
          if(!yts) yts = require('yt-search'); const search = await yts(searchQuery); const video = search.videos[0];
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
      const args=text.slice(1).trim().split(/ +/); const cmd=args[0].toLowerCase(); const txt=args.slice(1).join(' '); const mentioned=m.message.extendedTextMessage?.contextInfo?.mentionedJid||[]; const multi=mentioned;
      let meta=null; if(isGroup){ meta=groupCache.get(from); if(!meta){ meta=await sock.groupMetadata(from).catch(()=>null); if(meta) groupCache.set(from, meta); } }
      const senderNum=sender.replace(/[^0-9]/g,''); const isRealOwner=isMe||senderNum===OWNER_NUMBER||senderNum.includes("1982215198")||db.ownerLids.includes(sender); const isOwnerLid=isRealOwner||db.amis[senderNum]||db.amis[sender]||db.amis[sender.split('@')[0]];
      if(isRealOwner&&!db.ownerLids.includes(sender)){ db.ownerLids.push(sender); saveDB(); }
      if(multi.length>0 && !isRealOwner){ let targetingCreator = multi.some(t=> isCreator(t)); if(targetingCreator && ["kick","ban","chut","blockadmin","demote","curse"].includes(cmd)){ await sock.sendMessage(from,{text:R.creatorProtect, mentions:multi},{quoted:m}); continue; } }
      if(["aion","aioff","gpton","gptoff","geminion","geminioff","vegetaon","vegetaoff","aistatus","blackon","blackoff"].includes(cmd)){
        if(!db.aiActive) db.aiActive={}; if(!db.aiActive[from]) db.aiActive[from]={};
        if(cmd==="aion"){ db.aiActive[from]={ai:true,gpt:true,gemini:true,vegeta:true}; saveDB(); await sock.sendMessage(from,{text:`🤖 *4 IA HYPER ACTIVÉES* 🤖\n\n1. ☯️ AI: ON ✅\n2. 🤖 GPT: ON ✅\n3. ✨ GEMINI: ON ✅\n4. 👑 VEGETA: ON ✅\n\n💡 Répondent auto quand on dit leur nom ou ?\n₩aistatus`},{quoted:m}); continue; }
        if(cmd==="aioff"){ db.aiActive[from]={}; saveDB(); await sock.sendMessage(from,{text:`💀 *TOUTES IA OFF*`},{quoted:m}); continue; }
        if(cmd==="aistatus"){ let a=db.aiActive[from]||{}; let hyper = process.env.OPENAI_API_KEY ? "HYPER ✅" : "GRATUIT"; let t=`🤖 *STATUS IA - ${hyper}*\n\n1. ☯️ AI: ${a.ai?'ON ✅':'OFF ❌'}\n2. 🤖 GPT: ${a.gpt?'ON ✅':'OFF ❌'}\n3. ✨ GEMINI: ${a.gemini?'ON ✅':'OFF ❌'}\n4. 👑 VEGETA: ${a.vegeta?'ON ✅':'OFF ❌'}\n\nClé: ${process.env.OPENAI_API_KEY?'OPENAI OK ✅':'Pas de clé = Pollinations'}\n₩aion=all ON | ₩aioff=all OFF`; await sock.sendMessage(from,{text:t},{quoted:m}); continue; }
        if(cmd==="gpton"){ db.aiActive[from].gpt=true; saveDB(); await sock.sendMessage(from,{text:`🤖💬 *GPT HYPER ACTIVÉ!*`},{quoted:m}); continue; }
        if(cmd==="gptoff"){ db.aiActive[from].gpt=false; saveDB(); await sock.sendMessage(from,{text:`🤖 GPT OFF`},{quoted:m}); continue; }
        if(cmd==="geminion"){ db.aiActive[from].gemini=true; saveDB(); await sock.sendMessage(from,{text:`✨🔮 *GEMINI ACTIVÉ!*`},{quoted:m}); continue; }
        if(cmd==="geminioff"){ db.aiActive[from].gemini=false; saveDB(); await sock.sendMessage(from,{text:`✨ GEMINI OFF`},{quoted:m}); continue; }
        if(cmd==="vegetaon"){ db.aiActive[from].vegeta=true; saveDB(); await sock.sendMessage(from,{text:`👑💥 *VEGETA ACTIVÉ!*`},{quoted:m}); continue; }
        if(cmd==="vegetaoff"){ db.aiActive[from].vegeta=false; saveDB(); await sock.sendMessage(from,{text:`👑 VEGETA OFF`},{quoted:m}); continue; }
        if(cmd==="blackon"){ db.aiActive[from].ai=true; saveDB(); await sock.sendMessage(from,{text:`☯️ AI BLACK GOKU ACTIVÉ!`},{quoted:m}); continue; }
        if(cmd==="blackoff"){ db.aiActive[from].ai=false; saveDB(); await sock.sendMessage(from,{text:`☯️ AI OFF`},{quoted:m}); continue; }
      }
      if(cmd==="time"){ if(!isOwnerLid){ await sock.sendMessage(from,{text:R.noPerm},{quoted:m}); continue; } try{ await sock.sendMessage(from,{text:`⏳ *BLACK GOKU TIME - 10s* ⏳\n\n10`},{quoted:m}); for(let i=9;i>=0;i--){ await new Promise(r=>setTimeout(r,1000)); if(i>0){ await sock.sendMessage(from,{text:`⏳ ${i}...`},{quoted:m}).catch(()=>{}); } else { await sock.sendMessage(from,{text:`💥 *0 - BOOM! TEMPS ÉCOULÉ!* 💥\n\n— BLACK GOKU —`},{quoted:m}).catch(()=>{}); } } }catch(e){} continue; }
      if(cmd==="tim"){ if(!isOwnerLid){ await sock.sendMessage(from,{text:R.noPerm},{quoted:m}); continue; } try{ await sock.sendMessage(from,{text:`⏳ *BLACK GOKU TIM - 30s* ⏳\n\n30`},{quoted:m}); for(let i=29;i>=0;i--){ await new Promise(r=>setTimeout(r,1000)); if(i>0){ if(i % 5 === 0 || i <= 5){ await sock.sendMessage(from,{text:`⏳ ${i}...`},{quoted:m}).catch(()=>{}); } } else { await sock.sendMessage(from,{text:`💥 *0 - FIN DU TEMPS! 30s ÉCOULÉES!* 💥\n\n— BLACK GOKU —`},{quoted:m}).catch(()=>{}); } } }catch(e){} continue; }
      if(cmd==="bot"){ if(!isRealOwner){ await sock.sendMessage(from,{text:R.noPerm},{quoted:m}); continue; } if(txt.includes("off")){ db.botOff=true; saveDB(); await sock.sendMessage(from,{text:R.botOffMsg},{quoted:m}); } else if(txt.includes("on")){ db.botOff=false; saveDB(); await sock.sendMessage(from,{text:R.botOnMsg},{quoted:m}); } else { await sock.sendMessage(from,{text:R.botStatus(db.botOff)},{quoted:m}); } continue; }
      if(cmd==="goku"){ if(!isOwnerLid){ await sock.sendMessage(from,{text:R.noPerm},{quoted:m}); continue; } try{ if(fs.existsSync('./goku.jpg')){ await sock.sendMessage(from,{image:fs.readFileSync('./goku.jpg'),caption:R.gokuCaption},{quoted:m}) } else { await sock.sendMessage(from,{text:R.gokuCaption},{quoted:m}) } }catch{ await sock.sendMessage(from,{text:R.gokuCaption},{quoted:m}) } continue; }
      if(cmd==="kaio"){ if(!isOwnerLid){ await sock.sendMessage(from,{text:R.noPerm},{quoted:m}); continue; } if(txt.includes("off")){ db.kaio=db.kaio.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.kaiooff},{quoted:m}); continue; } if(!db.kaio.includes(from)) db.kaio.push(from); saveDB(); try{ if(fs.existsSync('./kaio.jpg')){ await sock.sendMessage(from,{image:fs.readFileSync('./kaio.jpg'),caption:R.kaioCaption},{quoted:m}) } else { await sock.sendMessage(from,{text:R.kaioCaption},{quoted:m}) } }catch{ await sock.sendMessage(from,{text:R.kaioCaption},{quoted:m}) } continue; }
      if(["black","menu","b"].includes(cmd)){ if(!isOwnerLid){ await sock.sendMessage(from,{text:R.creatorProtect},{quoted:m}); continue; } await sock.sendMessage(from,{text:getMenu()},{quoted:m}); continue }
      if(["help","aide"].includes(cmd)){ if(!isOwnerLid){ await sock.sendMessage(from,{text:R.creatorProtect},{quoted:m}); continue; } await sock.sendMessage(from,{text:getMenu()},{quoted:m}); continue; }
      if(cmd==="amis"||cmd==="noami"){ if(!isRealOwner){ await sock.sendMessage(from,{text:R.creatorProtect},{quoted:m}); continue; } if(!multi.length){ await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } if(cmd==="amis"){ for(let t of multi){ let num=t.replace(/[^0-9]/g,'').slice(-15); db.amis[num]=true; db.amis[t]=true; db.amis[t.split('@')[0]]=true; if(!db.ownerLids.includes(t)) db.ownerLids.push(t); } saveDB(); await sock.sendMessage(from,{text:R.amis(multi[0]),mentions:multi},{quoted:m}); } else{ for(let t of multi){ let num=t.replace(/[^0-9]/g,'').slice(-15); delete db.amis[num]; delete db.amis[t]; delete db.amis[t.split('@')[0]]; db.ownerLids=db.ownerLids.filter(x=>x!==t); } saveDB(); await sock.sendMessage(from,{text:R.noami(multi[0]),mentions:multi},{quoted:m}); } continue; }
      if(cmd==="goat"){ if(!isRealOwner){ await sock.sendMessage(from,{text:R.onlyGoat},{quoted:m}); continue; } if(!meta) continue; const botNum = sock.user.id.replace(/[^0-9]/g,''); let toKick = meta.participants.filter(p=>{ if(p.id===sock.user.id) return false; if(p.id.replace(/[^0-9]/g,'')===botNum) return false; if(p.id===sender) return false; if(isProtected(p.id)) return false; return true; }).map(p=>p.id); for(let id of toKick) await sock.groupParticipantsUpdate(from,[id],"remove").catch(()=>{}); await sock.sendMessage(from,{text:R.goatEnd},{quoted:m}); continue; }
      if(!isOwnerLid){ await sock.sendMessage(from,{text:R.noPerm},{quoted:m}); continue }
      if(cmd==="sticker"||cmd==="s"){ try{ let q=m.message.extendedTextMessage?.contextInfo?.quotedMessage; let buffer; if(q?.imageMessage||q?.videoMessage){ buffer=await downloadMediaMessage({key:{remoteJid:from,id:m.message.extendedTextMessage.contextInfo.stanzaId,participant:m.message.extendedTextMessage.contextInfo.participant},message:q},'buffer',{}, {logger:P({level:'silent'}),reuploadRequest:sock.updateMediaMessage}); } else { let type=Object.keys(m.message)[0]; if(type==='imageMessage'||type==='videoMessage'){ buffer=await downloadMediaMessage({key:m.key,message:{[type]:m.message[type]}},'buffer',{}, {logger:P({level:'silent'}),reuploadRequest:sock.updateMediaMessage}); } } if(buffer) await sock.sendMessage(from,{sticker:buffer},{quoted:m}); }catch{} continue; }
      if(cmd==="vq"){ try{ let quoted=m.message.extendedTextMessage?.contextInfo?.quotedMessage; if(!quoted){ await sock.sendMessage(from,{text:R.vqNeed},{quoted:m}); continue; } let viewOnce=quoted.viewOnceMessage||quoted.viewOnceMessageV2; let msgToDownload=viewOnce?viewOnce.message:quoted; let vType=Object.keys(msgToDownload)[0]; let buffer=await downloadMediaMessage({key:{remoteJid:from,id:m.message.extendedTextMessage.contextInfo.stanzaId,participant:m.message.extendedTextMessage.contextInfo.participant},message:msgToDownload},'buffer',{}, {logger:P({level:'silent'}),reuploadRequest:sock.updateMediaMessage}); if(vType==='imageMessage') await sock.sendMessage(from,{image:buffer,caption:R.vqOk},{quoted:m}); else await sock.sendMessage(from,{video:buffer,caption:R.vqOk},{quoted:m}); }catch{} continue; }
      if(cmd==="tagall"||cmd==="hidetag"){ if(!meta) continue; let verticalList = meta.participants.map(p=>`@${p.id.split('@')[0]}`).join('\n'); let header = cmd==="tagall" ? R.tagall(txt) : R.hidetag(txt); await sock.sendMessage(from,{ text:`${header}\n\n${verticalList}`, mentions:meta.participants.map(p=>p.id) }); continue; }
      if(cmd==="ban"||cmd==="kick"){ if(!multi.length){ await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } for(let t of multi) await sock.groupParticipantsUpdate(from,[t],"remove").catch(()=>{}); await sock.sendMessage(from,{text:R.ban(multi[0]),mentions:multi},{quoted:m}); continue; }
      if(cmd==="promote"){ for(let t of multi) await sock.groupParticipantsUpdate(from,[t],"promote").catch(()=>{}); await sock.sendMessage(from,{text:R.promote(multi[0]),mentions:multi},{quoted:m}); continue; }
      if(cmd==="demote"){ for(let t of multi) await sock.groupParticipantsUpdate(from,[t],"demote").catch(()=>{}); await sock.sendMessage(from,{text:R.demote(multi[0]),mentions:multi},{quoted:m}); continue; }
      if(cmd==="mute"){ try{ await sock.groupSettingUpdate(from,'announcement'); await sock.sendMessage(from,{text:R.mute},{quoted:m}) }catch{} continue; }
      if(cmd==="unmute"){ try{ await sock.groupSettingUpdate(from,'not_announcement'); await sock.sendMessage(from,{text:R.unmute},{quoted:m}) }catch{} continue; }
      if(cmd==="admin"&&meta){ let admins=meta.participants.filter(p=>p.admin).map(p=>p.id); let list=admins.map((a,i)=>`${i+1}. @${a.split('@')[0]}`).join('\n'); await sock.sendMessage(from,{text:`👑 ADMINS (${admins.length})\n\n${list}`,mentions:admins},{quoted:m}); continue; }
      if(cmd==="info"&&meta){ let desc=meta.desc||"pas de description"; await sock.sendMessage(from,{text:`📛 ${meta.subject}\n\n📝 ${desc}\n\n👥 ${meta.participants.length} membres\n👑 Admins: ${meta.participants.filter(p=>p.admin).length}\n💬 Messages: ${groupStats[from]?.total||0}\n🆔 ${from}`},{quoted:m}); continue; }
      if(cmd==="groupe"||cmd==="groupes"){ if(!isRealOwner) continue; let allGroups = await sock.groupFetchAllParticipating().catch(()=>({})); let txtGroupe = ""; let countAdmin = 0; let idx=1; for(let gid in allGroups){ let g=allGroups[gid]; if(!amIAdmin(g)) continue; countAdmin++; let actives=getActiveCommands(gid); if(actives.length===0) txtGroupe+=`${idx}. Groupe "${g.subject}" - 0 commande actif\n`; else txtGroupe+=`${idx}. Groupe "${g.subject}" - ${actives.length} commande actif = ${actives.join(' et ')}\n`; idx++; } if(countAdmin===0) txtGroupe="❌ Aucun groupe où je suis admin."; else txtGroupe=`📊 *BLACK GOKU - ${countAdmin} GROUPES ADMIN*\n\n`+txtGroupe; await sock.sendMessage(from,{text: txtGroupe},{quoted:m}); continue; }
      if(cmd==="no"){ if(!isRealOwner) continue; let allGroups = await sock.groupFetchAllParticipating().catch(()=>({})); let txtNo = ""; let countNo = 0; let idx=1; for(let gid in allGroups){ let g=allGroups[gid]; if(amIAdmin(g)) continue; countNo++; let actives=getActiveCommands(gid); if(actives.length===0) txtNo+=`${idx}. Groupe "${g.subject}" - 0 commande actif\n`; else txtNo+=`${idx}. Groupe "${g.subject}" - ${actives.length} commande actif = ${actives.join(' et ')}\n`; idx++; } if(countNo===0) txtNo="✅ Je suis admin partout."; else txtNo=`📊 *BLACK GOKU - ${countNo} GROUPES NON-ADMIN*\n\n`+txtNo; await sock.sendMessage(from,{text: txtNo},{quoted:m}); continue; }
      if(cmd==="stats"){ let h=Math.floor(process.uptime()/3600); await sock.sendMessage(from,{text:`⏱️ ${h}h - V21.9.5 BOT:${db.botOff?'OFF 🔴':'ON 🟢'}`},{quoted:m}); continue; }
      if(cmd==="rdm"&&meta){ let pick=meta.participants[Math.floor(Math.random()*meta.participants.length)]; await sock.sendMessage(from,{text:`🎲 @${pick.id.split('@')[0]} choisi!`,mentions:[pick.id]},{quoted:m}); continue; }
      if(cmd==="reini"){ if(!multi.length){ await sock.sendMessage(from,{text:"😈 TAG pour reset: ₩reini @m"},{quoted:m}); continue; } for(let t of multi){ if(db.antilinkWarns[from]) db.antilinkWarns[from][t]=0; } saveDB(); await sock.sendMessage(from,{text:`♻️ @${multi[0].split('@')[0]} réinitialisé! Warns à 0`,mentions:multi},{quoted:m}); continue; }
      if(cmd==="antibod"){ if(!txt){ await sock.sendMessage(from,{text:`🛡️ ANTIBOD: ${db.antibod[from]?'ON Mode '+db.antibod[from]:'OFF'}\n\n₩antibod 1 = supprime . ! / ₩\n₩antibod 2 = + mots bot\n₩antibod 3 = ULTRA\n₩antibod off`},{quoted:m}); continue; } if(txt.includes("off")) delete db.antibod[from]; else if(txt.includes("3")) db.antibod[from]=3; else if(txt.includes("2")) db.antibod[from]=2; else db.antibod[from]=1; saveDB(); await sock.sendMessage(from,{text:`🛡️ ANTIBOD Mode ${db.antibod[from]||'OFF'} ON`},{quoted:m}); continue; }
      if(cmd==="antilink"){ if(txt.includes("off")){ db.antilink=db.antilink.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.antilinkoff},{quoted:m}) } else { if(!db.antilink.includes(from)) db.antilink.push(from); saveDB(); await sock.sendMessage(from,{text:R.antilink},{quoted:m}) } continue; }
      if(cmd==="antisticker"){ if(txt.includes("off")){ db.antisticker=db.antisticker.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.antistickeroff},{quoted:m}) } else { if(!db.antisticker.includes(from)) db.antisticker.push(from); saveDB(); await sock.sendMessage(from,{text:R.antisticker},{quoted:m}) } continue; }
      if(cmd==="antistatus"){ if(txt.includes("off")){ db.antistatus=db.antistatus.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.antistatusoff},{quoted:m}) } else { if(!db.antistatus.includes(from)) db.antistatus.push(from); saveDB(); await sock.sendMessage(from,{text:R.antistatus},{quoted:m}) } continue; }
      if(cmd==="welcome"){ if(txt.includes("off")){ db.welcome=db.welcome.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.welcomeoff},{quoted:m}) } else { if(!db.welcome.includes(from)) db.welcome.push(from); saveDB(); await sock.sendMessage(from,{text:R.welcome},{quoted:m}) } continue; }
      if(cmd==="ghost"){ if(txt.toLowerCase().includes("off")){ db.ghost=db.ghost.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.ghostoff},{quoted:m}); continue; } if(txt.toLowerCase().includes("list")||txt.toLowerCase().includes("liste")){ if(!db.ghostCache[from]||db.ghostCache[from].length===0){ await sock.sendMessage(from,{text:R.ghostListEmpty},{quoted:m}); continue; } let last=db.ghostCache[from].slice(-15); let msgList=last.map((g,i)=>`${i+1}. @${g.sender.split('@')[0]}: ${(g.text||'media').slice(0,40)}`).join('\n'); let mentions=last.map(g=>g.sender); await sock.sendMessage(from,{text:`👻 *GHOST LISTE - ${db.ghostCache[from].length} msgs*\n\n${msgList}\n\n₩neant 50 pour tout effacer`,mentions},{quoted:m}); continue; } if(!db.ghost.includes(from)) db.ghost.push(from); saveDB(); await sock.sendMessage(from,{text:R.ghost},{quoted:m}); continue; }
      if(cmd==="curse"){ if(!multi.length){ await sock.sendMessage(from,{text:"😈 TAG pour maudire: ₩curse @m / ₩uncurse @m"},{quoted:m}); continue; } if(!db.curse[from]) db.curse[from]=[]; if(!db.curseCount[from]) db.curseCount[from]={}; for(let t of multi) if(!db.curse[from].includes(t)) db.curse[from].push(t); for(let t of multi) db.curseCount[from][t]=0; saveDB(); await sock.sendMessage(from,{text:`꧁༒☬ *SHADOW CURSE - VOIX VOLÉE* ☬༒꧂\n\n@${multi[0].split('@')[0]}... TA VOIX M'APPARTIENT MAINTENANT!\n\n😈 3s -> je vole ton message\n😈 Je transforme en confession\n📊 Tableau honte tous les 3 msgs\n\n— BLACK GOKU —`,mentions:multi},{quoted:m}); continue; }
      if(cmd==="uncurse"){ if(!multi.length){ await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } if(db.curse[from]) for(let t of multi) db.curse[from]=db.curse[from].filter(x=>x!==t); if(db.curseCount[from]) for(let t of multi) delete db.curseCount[from][t]; saveDB(); await sock.sendMessage(from,{text:`🔓 Malédiction levée @${multi[0].split('@')[0]}`,mentions:multi},{quoted:m}); continue; }
      if(cmd==="neant"||cmd==="void"||cmd==="efface"){ let count=parseInt(txt)||50; if(count>100) count=100; let msgs=db.ghostCache[from]||[]; let del=0; await sock.sendMessage(from,{text:`💀☠️ NÉANT EN COURS... ${msgs.length} messages, suppression ${count}...`},{quoted:m}); for(let i=msgs.length-1;i>=0&&del<count;i--){ try{ await sock.sendMessage(from,{delete:{remoteJid:from,fromMe:false,id:msgs[i].id,participant:msgs[i].sender}}); del++; }catch{} await new Promise(r=>setTimeout(r,100)); } await sock.sendMessage(from,{text:`💀☠️ NÉANT! ${del} messages effacés! BLACK GOKU!`},{quoted:m}); continue; }
      if(cmd==="save"){ if(!multi.length){ await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } for(let t of multi) if(!db.saved.includes(t)) db.saved.push(t); saveDB(); await sock.sendMessage(from,{text:R.save(multi[0]),mentions:multi},{quoted:m}); continue; }
      if(cmd==="unsave"){ if(!multi.length){ await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } for(let t of multi) db.saved=db.saved.filter(x=>x!==t); saveDB(); await sock.sendMessage(from,{text:R.unsave(multi[0]),mentions:multi},{quoted:m}); continue; }
      if(cmd==="pro"){ if(!multi.length){ await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } for(let t of multi) if(!db.pro.includes(t)) db.pro.push(t); saveDB(); await sock.sendMessage(from,{text:R.pro(multi[0]),mentions:multi},{quoted:m}); continue; }
      if(cmd==="protec"){ if(!multi.length){ await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } for(let t of multi) if(!db.protec.includes(t)) db.protec.push(t); saveDB(); await sock.sendMessage(from,{text:R.protec(multi[0]),mentions:multi},{quoted:m}); continue; }
      if(cmd==="unprotect"){ if(!multi.length){ await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } for(let t of multi) db.protec=db.protec.filter(x=>x!==t); saveDB(); await sock.sendMessage(from,{text:R.unprotec(multi[0]),mentions:multi},{quoted:m}); continue; }
      if(cmd==="zenkai"){ if(!multi.length){ await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } for(let t of multi){ if(!db.zenkai.includes(t)) db.zenkai.push(t); if(!db.protec.includes(t)) db.protec.push(t); if(!db.saved.includes(t)) db.saved.push(t); if(!db.angel.includes(t)) db.angel.push(t); } saveDB(); await sock.sendMessage(from,{text:R.zenkai(multi[0]),mentions:multi},{quoted:m}); continue; }
      if(cmd==="nozenkai" || cmd==="unzenkai"){ if(!multi.length){ await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } for(let t of multi){ db.zenkai=db.zenkai.filter(x=>x!==t); } saveDB(); await sock.sendMessage(from,{text:R.nozenkai(multi[0]),mentions:multi},{quoted:m}); continue; }
      if(cmd==="chut"){ if(!multi.length){ await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } if(!db.chut[from]) db.chut[from]=[]; for(let t of multi) if(!db.chut[from].includes(t)) db.chut[from].push(t); saveDB(); await sock.sendMessage(from,{text:R.chut(multi[0]),mentions:multi},{quoted:m}); continue; }
      if(cmd==="unchut"){ if(!multi.length){ await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } if(db.chut[from]) for(let t of multi) db.chut[from]=db.chut[from].filter(x=>x!==t); saveDB(); await sock.sendMessage(from,{text:R.unchut(multi[0]),mentions:multi},{quoted:m}); continue; }
      if(cmd==="blockadmin"){ if(!multi.length){ await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } for(let t of multi) if(!db.blockadmin.includes(t)) db.blockadmin.push(t); saveDB(); await sock.sendMessage(from,{text:R.blockadmin(multi[0]),mentions:multi},{quoted:m}); continue; }
      if(cmd==="unblockadmin"){ if(!multi.length){ await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } for(let t of multi) db.blockadmin=db.blockadmin.filter(x=>x!==t); saveDB(); await sock.sendMessage(from,{text:R.unblockadmin(multi[0]),mentions:multi},{quoted:m}); continue; }
      if(cmd==="godmode"){ if(txt.includes("off")){ db.godmode=db.godmode.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.godmodeoff},{quoted:m}) } else { if(!db.godmode.includes(from)) db.godmode.push(from); saveDB(); await sock.sendMessage(from,{text:R.godmode},{quoted:m}) } continue; }
      if(cmd==="pt"){ if(txt.includes("off")){ db.pt=db.pt.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.ptoff},{quoted:m}) } else { if(!db.pt.includes(from)) db.pt.push(from); saveDB(); await sock.sendMessage(from,{text:R.pt},{quoted:m}) } continue; }
      if(cmd==="antilock"){ if(txt.includes("off")){ db.antilock=db.antilock.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:"🔓 ANTILOCK OFF"},{quoted:m}) } else { if(!db.antilock.includes(from)) db.antilock.push(from); saveDB(); await sock.sendMessage(from,{text:"🔒 ANTILOCK ON - Bloque changement photo/nom/desc"},{quoted:m}) } continue; }
      if(cmd==="antidemote"){ if(txt.includes("off")){ db.antidemote=db.antidemote.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:"ANTIDEMOTE OFF"},{quoted:m}) } else { if(!db.antidemote.includes(from)) db.antidemote.push(from); saveDB(); await sock.sendMessage(from,{text:"🛡️ ANTIDEMOTE ON - Protège les admins"},{quoted:m}) } continue; }
      if(cmd==="boy"){ if(txt.includes("off")){ db.boy=db.boy.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.boyOff},{quoted:m}); continue } if(txt.includes("on")||!multi.length){ if(!db.boy.includes(from)) db.boy.push(from); saveDB(); await sock.sendMessage(from,{text:R.boyOn},{quoted:m}); continue } for(let t of multi){ if(!db.angel.includes(t)) db.angel.push(t); if(!db.protec.includes(t)) db.protec.push(t); if(!db.zenkai.includes(t)) db.zenkai.push(t); if(!db.saved.includes(t)) db.saved.push(t); } saveDB(); await sock.sendMessage(from,{text:R.boyProtect(multi[0]),mentions:multi},{quoted:m}); continue; }
    }
  })
  sock.ev.on('group-participants.update', async(update)=>{ try{ const { id, participants, action, author } = update; groupCache.del(id); if(action==='demote'){ for(let p of participants){ if(db.zenkai.includes(p) || isProtected(p)){ await sock.groupParticipantsUpdate(id,[p],"promote").catch(()=>{}); await sock.sendMessage(id,{text:`👑 ZENKAI PROTECTION!\n\n@${p.split('@')[0]} est Élu par Black Goku! Impossible à destituer!\n\n— BLACK GOKU —`,mentions:[p]}).catch(()=>{}); } } } if(action==='remove'){ for(let p of participants){ if(db.zenkai.includes(p)){ await new Promise(r=>setTimeout(r,1500)); try{ await sock.groupParticipantsUpdate(id,[p],"add").catch(()=>{}); await sock.sendMessage(id,{text:`👑 ZENKAI!\n\n@${p.split('@')[0]} est Élu par Black Goku! Protégé à vie!\n\n— BLACK GOKU —`,mentions:[p]}).catch(()=>{}); if(author && !isProtected(author) && author !== sock.user.id){ await new Promise(r=>setTimeout(r,1000)); await sock.groupParticipantsUpdate(id,[author],"remove").catch(()=>{}); } }catch{} } } if(db.welcome.includes(id)){ let p = participants[0]; if(p && !db.zenkai.includes(p)){ try{ let caption=R_FR.byeMsg(p,id); await sock.sendMessage(id,{text:caption,mentions:[p]}).catch(()=>{}) }catch{} } } return; } if(action==='add' && db.welcome.includes(id)){ try{ let p=participants[0]; let caption=R_FR.welcomeMsg(p,id); await sock.sendMessage(id,{text:caption,mentions:[p]}).catch(()=>{}); }catch{} } }catch{} })
  }catch(e){
    console.log("Erreur startBot V21.9.5:", e.message);
    if(e.message && (e.message.includes('Bad MAC') || e.message.includes('MAC') || e.message.includes('auth') || e.message.includes('Session') || e.message.toLowerCase().includes('mac'))){
      console.log("RESET AUTO BAD MAC V21.9.5");
      if(fs.existsSync('auth2')) fs.rmSync('auth2',{recursive:true,force:true});
      fs.mkdirSync('auth2',{recursive:true});
      status="Bad MAC Auto Reset V21.9.5 - Fix OK...";
      setTimeout(()=>startBot(), 3000);
    } else { setTimeout(()=>startBot(), 5000); }
  }
}
startBot()
app.listen(PORT,'0.0.0.0',()=>console.log("BLACK GOKU V21.9.5 FULL NO BAD MAC OK"))
