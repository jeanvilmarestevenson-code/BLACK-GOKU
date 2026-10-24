const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, Browsers, downloadMediaMessage, DisconnectReason } = require('@whiskeysockets/baileys')
const P = require('pino')
const fs = require('fs')
const express = require('express')
const NodeCache = require('node-cache')
const axios = require('axios')
const app = express()
const PORT = process.env.PORT || 10000

process.on('uncaughtException', e => console.log("uncaught:", e.message))
process.on('unhandledRejection', e => console.log("unhandled:", e?.message))

if (!fs.existsSync('auth2')) fs.mkdirSync('auth2', { recursive: true })

const OWNER_NUMBER = process.env.OWNER_NUMBER || "5551982215198"
const PREFIX = "₩"
const DB_FILE = './black_db.json'
const msgRetryCounterCache = new NodeCache({ stdTTL: 0, checkperiod: 0 })
const groupCache = new NodeCache({ stdTTL: 300, useClones: false })

let db = { amis:{}, saved:[], protec:[], zenkai:[], angel:[], chut:{}, blockadmin:[], antilink:[], antisticker:[], antistatus:[], welcome:[], ghost:[], boy:[], muted:[], ownerLids:[], ghostCache:{}, antilinkWarns:{}, botOff:false, antibod:{}, curse:{}, curseCount:{}, aiActive:{}, aiCooldown:{}, antilock:[], antidemote:[] }
if (fs.existsSync(DB_FILE)) { try { db = { ...db, ...JSON.parse(fs.readFileSync(DB_FILE)) } } catch{} }
const saveDB = () => { try { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)) } catch{} }

let sock, status = "Demarrage V22.6 BLACK GOKU...", lastQR = null, groupStats = {}, presenceInterval = null

const AI_PERSONAS = {
  ai: { name:"AI", emoji:"🤖", trigger:["ai","black","goku"] },
  gpt: { name:"GPT", emoji:"💬", trigger:["gpt","chatgpt","question"] },
  gemini: { name:"GEMINI", emoji:"✨", trigger:["gemini","google"] },
  vegeta: { name:"VEGETA", emoji:"💡", trigger:["vegeta","prince"] }
};

async function askHyper(which, question){
  let sys = "Tu es un assistant IA amical qui répond clair en français.";
  if(process.env.OPENAI_API_KEY){ try{ let r=await axios.post('https://api.openai.com/v1/chat/completions',{model:"gpt-4o-mini",messages:[{role:"system",content:sys},{role:"user",content:question}],max_tokens:400},{headers:{'Authorization':`Bearer ${process.env.OPENAI_API_KEY}`},timeout:20000}); return r.data.choices[0].message.content; }catch{} }
  try{ let r=await axios.get(`https://text.pollinations.ai/${encodeURIComponent(sys+"\n"+question)}`,{timeout:15000}); return typeof r.data==='string'?r.data:JSON.stringify(r.data); }catch{ return "IA indisponible."; }
}

const menuFR = `꧁༒☬ BLACK GOKU ☬༒꧂

┏━ ✦ MEMBRES ✦ ━┓
┃ ₩tagall
┃ ₩hidetag
┃ ₩kick / ₩ban
┃ ₩promote / ₩demote
┃ ₩mute / ₩unmute
┃ ₩admin
┃ ₩info
┃ ₩stats
┃ ₩goku
┃ ₩time
┃ ₩tim
┗━━━━━━━━━━━━━━┛

┏━ ✦ PUNITIONS ✦ ━┓
┃ ₩chut / ₩unchut
┃ ₩blockadmin
┃ ₩unblockadmin
┃ ₩reini
┃ ₩curse / ₩uncurse
┃ ₩neant
┃ ₩goat
┗━━━━━━━━━━━━━━┛

┏━ ✦ PROTECTION ✦ ━┓
┃ ₩save / ₩unsave
┃ ₩protec / ₩unprotect
┃ ₩zenkai / ₩nozenkai
┃ ₩boy / ₩boy on / off
┃ ₩antilink / off
┃ ₩antibod / off
┃ ₩antilock / off
┃ ₩antidemote / off
┃ ₩antisticker / off
┃ ₩antistatus / off
┃ ₩welcome / off
┃ ₩ghost / off / list
┗━━━━━━━━━━━━━━┛

┏━ ✦ IA ✦ ━┓
┃ ₩ai
┃ ₩gpt
┃ ₩gemini
┃ ₩vegeta
┃ ₩aion
┃ ₩aioff
┃ ₩aistatus
┗━━━━━━━━━━━━━━┛

┏━ ✦ OWNER ✦ ━┓
┃ ₩amis / ₩noami
┃ ₩groupe
┃ ₩no
┃ ₩bot on / off
┃ ₩vq
┃ ₩sticker
┃ ₩rdm
┗━━━━━━━━━━━━━━┛

*CRÉÉ PAR THE GOAT BLACK GOKU*`

const R = {
  noPerm:"💀 *TOUCHE PAS À CE QUI N'EST PAS À TOI, FAIBLE.*\n\n *SEUL BLACK GOKU COMMANDE ICI.*",
  creatorProtect:"☯️👑 *TU OSES T'ATTAQUER À MOI? JE SUIS BLACK GOKU!*",
  onlyGoat:"👑💀 SEUL BLACK GOKU PEUT UTILISER ₩goat!",
  needTag:"😈 TAG UN MORTEL! @m",
  ban:(j)=>`💀 HAKAI! @${j.split('@')[0]} effacé.`, 
  kick:(j)=>`💀 @${j.split('@')[0]} expulsé.`,
  promote:(j)=>`👑 @${j.split('@')[0]} élevé admin.`, 
  demote:(j)=>`@${j.split('@')[0]} n'est plus admin.`,
  mute:"🤫 *GROUPE FERMÉ!* 🔒", 
  unmute:"🔊 *GROUPE OUVERT!* 🔓",
  tagall:(t)=>`🔥 *BLACK GOKU VOUS INVOQUE!* 🔥\n\n${t||"Tous!"}`, 
  hidetag:(t)=>`${t||"👻 Invocation..."}`,
  chut:(j)=>`🔇 @${j.split('@')[0]} au Néant.`, 
  unchut:(j)=>`🔓 @${j.split('@')[0]} peut parler.`,
  blockadmin:(j)=>`⛓️ @${j.split('@')[0]} POUVOIRS SCELLÉS!`, 
  unblockadmin:(j)=>`🔓 @${j.split('@')[0]} chaînes brisées.`,
  save:(j)=>`🛡️ @${j.split('@')[0]} Intouchable.`, 
  unsave:(j)=>`🛡️ Marque retirée @${j.split('@')[0]}.`,
  protec:(j)=>`👑🔥 *PROTEC* 🔥👑\n\n@${j.split('@')[0]} Protégé.`, 
  unprotec:(j)=>`💀 PROTEC retirée @${j.split('@')[0]}.`,
  zenkai:(j)=>`👑 ZENKAI!\n\n@${j.split('@')[0]} est Élu par Black Goku!`, 
  nozenkai:(j)=>`💀 ZENKAI RETIRÉ @${j.split('@')[0]}! Toutes protections retirées.`,
  antilink:"🔗 *ANTILINK TOTAL ON!* Bloque liens + chaines.", 
  antilinkoff:"ANTILINK OFF.",
  antibodOn:(m)=>`🛡️ *ANTIBOD MODE ${m} ON!*`,
  antibodOff:"ANTIBOD OFF.",
  antilock:"🔒 *ANTILOCK ON!* Bloque photo/nom/desc.", 
  antilockoff:"ANTILOCK OFF.",
  antidemote:"🛡️ *ANTIDEMOTE ON!*", 
  antidemoteoff:"ANTIDEMOTE OFF.",
  antisticker:"🖼️ *ANTISTICKER ON!*", 
  antistickeroff:"ANTISTICKER OFF.",
  antistatus:"👁️ *ANTISTATUS ON!*", 
  antistatusoff:"ANTISTATUS OFF.",
  welcome:"👋 *WELCOME ON*", 
  welcomeoff:"WELCOME OFF.",
  ghost:"👻💀 *GHOST DIABLE ON*", 
  ghostoff:"GHOST OFF.",
  ghostListEmpty:"👻 *GHOST LISTE VIDE*",
  boyOn:"👼✨ *ANGE PROTECTEUR ACTIVÉ!* ✨👼", 
  boyOff:"👼 ANGE MODE OFF.", 
  boyProtect:(j)=>`👼✨ @${j.split('@')[0]} est maintenant protégé par Black Goku`,
  amis:(j)=>`✅ @${j.split('@')[0]} PEUT UTILISER UNE PART DE TON POUVOIR.`, 
  noami:(j)=>`❌💀 @${j.split('@')[0]} PEUT PLUS UTILISER TON POUVOIR.`,
  curseOn:(j)=>`꧁༒☬ *SHADOW CURSE ON* ☬༒꧂\n\n@${j.split('@')[0]}... TA VOIX M'APPARTIENT!`,
  curseOff:(j)=>`🔓 Malédiction levée @${j.split('@')[0]}`,
  neantOn:(c,d)=>`💀☠️ NÉANT! ${d}/${c} messages effacés!`,
  neantStart:(c)=>`💀☠️ NÉANT EN COURS... suppression ${c}...`,
  reiniOk:(j)=>`♻️ @${j.split('@')[0]} réinitialisé! Warns à 0`,
  botOffMsg:"💀 *BLACK GOKU ÉTEINT* 💀", 
  botOnMsg:"☯️🔥 *BLACK GOKU ALLUMÉ* 🔥☯️",
  botStatus:(off)=>`🤖 Bot: *${off?'OFF 🔴':'ON 🟢'}*`,
  gokuCaption:"\"Ton existence est une erreur que je vais corriger.\"\n\n— BLACK GOKU —",
  goatStart:(n)=>`☯️👑 *C'EST MOI, BLACK GOKU VOTRE CAUCHEMAR😈*\n\n💀 *${n} FAIBLES... HAKAI!*`,
  goatEnd:`꧁༒☬ *FINI* ☬༒꧂\n\n☠️ *PLUS RIEN. BLACK GOKU.* 👑`,
  vqOk:"👁️🔥 *VUE UNIQUE DÉVOILÉE* 🔥👁️", 
  vqNeed:"😈 Réponds à une vue unique avec ₩vq!",
  statsOk:(h)=>`⏱️ ${h}h - V22.6 BOT ON`,
  welcomeMsg:(j,n)=>`Bienvenue @${j.split('@')[0]} 👋\n\nBienvenue dans *${n}* !`,
  byeMsg:(j,n)=>`À plus @${j.split('@')[0]} 👋\n\nIl a quitté *${n}*`
}

function isProtected(jid){ if(!jid) return false; const num=jid.replace(/[^0-9]/g,''); if(num===OWNER_NUMBER||num.includes("1982215198")) return true; return db.ownerLids.includes(jid)||db.zenkai.includes(jid)||db.protec.includes(jid)||db.angel.includes(jid)||db.saved.includes(jid); }
function isCreator(jid){ if(!jid) return false; const num=jid.replace(/[^0-9]/g,''); return num===OWNER_NUMBER||num.includes("1982215198")||db.ownerLids.includes(jid); }
function getActiveCommands(gid){ let a=[]; if(db.antilink.includes(gid)) a.push("antilink"); if(db.antibod[gid]) a.push("antibod"+db.antibod[gid]); if(db.antisticker.includes(gid)) a.push("antisticker"); if(db.antistatus.includes(gid)) a.push("antistatus"); if(db.welcome.includes(gid)) a.push("welcome"); if(db.ghost.includes(gid)) a.push("ghost"); if(db.boy.includes(gid)) a.push("boy"); if(db.antilock.includes(gid)) a.push("antilock"); if(db.antidemote.includes(gid)) a.push("antidemote"); return a; }
function amIAdmin(g){ if(!sock) return false; const myId=sock.user.id; const myNum=myId.split(':')[0].replace(/[^0-9]/g,'').slice(0,15); let me=g.participants.find(p=>p.id===myId||p.id.replace(/[^0-9]/g,'').includes(myNum)); return me&&(me.admin==='admin'||me.admin==='superadmin'); }

app.get('/', (req,res)=> res.send(`<html><head><title>BLACK GOKU V22.6</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{background:#0a0a0a;color:#fff;font-family:Arial;text-align:center;padding:20px}h1{color:#a020f0}a,button{background:#a020f0;color:#fff;padding:15px 25px;border-radius:10px;text-decoration:none;display:inline-block;margin:10px;font-weight:bold;border:none}input{padding:15px;border-radius:10px;border:none;width:80%;max-width:300px;margin:10px;text-align:center}.card{background:#1a1a1a;padding:20px;border-radius:15px;margin:20px auto;max-width:400px;border:1px solid #a020f0}</style></head><body><h1>☯️ BLACK GOKU V22.6 COMPLET</h1><h2>${status} - BOT:${db.botOff?'OFF 🔴':'ON 🟢'}</h2><div class="card"><input id="num" value="5551982215198"><br><button onclick="let n=document.getElementById('num').value.replace(/[^0-9]/g,''); location.href='/pair?num='+n">CODE</button></div><div class="card"><a href="/qr">QR</a> <a href="/clear" style="background:#ff0040">CLEAR</a></div></body></html>`))
app.get('/health', (req,res)=> res.send('OK '+status))
app.get('/qr', (req,res)=>{ if(!lastQR) return res.send(`<html><body style="background:#000;color:#fff;text-align:center;padding:50px"><h1>Pas de QR - ${status}</h1><script>setTimeout(()=>location.reload(),5000)</script></body></html>`); res.send(`<html><body style="text-align:center;background:#000;padding:20px"><h1 style="color:#a020f0">QR</h1><img src="https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(lastQR)}" style="border:10px solid #a020f0;border-radius:20px"/><br><br><a href="/" style="background:#a020f0;color:#fff;padding:15px 25px;border-radius:10px;text-decoration:none">Retour</a><script>setTimeout(()=>location.reload(),20000)</script></body></html>`) })
app.get('/clear', (req,res)=>{ try{ if(fs.existsSync('auth2')) fs.rmSync('auth2',{recursive:true,force:true}); fs.mkdirSync('auth2',{recursive:true}); lastQR=null; status="CLEAR OK"; res.send('CLEAR OK'); setTimeout(()=>startBot(),1500); }catch(e){ res.send(e.message) } })
app.get('/pair', async(req,res)=>{ let num=(req.query.num||'').replace(/[^0-9]/g,'')||"5551982215198"; try{ if(!sock) return res.send(`<html><body style="background:#000;color:#fff;text-align:center;padding:30px"><h1>Bot démarre...</h1><script>setTimeout(()=>location.href="/pair?num=${num}",4000)</script></body></html>`); await new Promise(r=>setTimeout(r,1000)); let code=await sock.requestPairingCode(num); let pretty=code.includes('-')?code:code.match(/.{1,4}/g)?.join('-')||code; res.send(`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{background:#0a0a0a;color:#fff;font-family:Arial;text-align:center;padding:20px}h1{color:#a020f0}.code{font-size:42px;letter-spacing:8px;background:#1a1a1a;padding:20px;border-radius:15px;border:2px solid #a020f0;margin:20px}.box{background:#222;padding:15px;border-radius:10px;text-align:left;max-width:400px;margin:20px auto}a{color:#fff;background:#a020f0;padding:12px 20px;border-radius:10px;text-decoration:none;display:inline-block;margin:5px}</style></head><body><h1>CODE ${num}</h1><div class="code">${pretty}</div><div class="box"><p>WhatsApp > Appareils liés > Lier avec numéro > ${code}</p></div><a href="/pair?num=${num}">NOUVEAU</a><a href="/" style="background:#444">Retour</a></body></html>`) }catch(e){ res.send(`<html><body style="background:#000;color:#fff;text-align:center;padding:20px"><h1>Erreur: ${e.message}</h1><a href="/">Retour</a></body></html>`) } })

async function startBot(){
  try{
    const { version } = await fetchLatestBaileysVersion().catch(()=>({version:[2,3000,1015901307]}))
    const { state, saveCreds } = await useMultiFileAuthState('auth2')
    sock = makeWASocket({ version, auth:{creds:state.creds, keys:makeCacheableSignalKeyStore(state.keys, P({level:'silent'}))}, logger:P({level:'silent'}), browser: Browsers.ubuntu("Chrome"), msgRetryCounterCache, getMessage: async()=>undefined, markOnlineOnConnect:true, syncFullHistory:false })
    sock.ev.on('creds.update', saveCreds)
    
    sock.ev.on('connection.update', async(u)=>{
      const { connection, lastDisconnect, qr } = u; 
      if(qr) lastQR=qr;
      if(connection==='open'){
        status="ACTIF V22.6 24/7 ✅";
        if(presenceInterval) clearInterval(presenceInterval);
        presenceInterval=setInterval(()=>{ try{ sock.sendPresenceUpdate('available') }catch{} },15000);
        console.log("✅ CONNECTÉ - BLACK GOKU EN LIGNE 24/7");
      }
      if(connection==='close'){
        let reason = lastDisconnect?.error?.output?.statusCode;
        let msgError = lastDisconnect?.error?.message || "";
        console.log("Déco détectée:", reason, msgError);
        if(msgError.toLowerCase().includes('bad mac') || msgError.includes('405')){
          console.log("BAD MAC - RESET AUTO");
          if(fs.existsSync('auth2')) fs.rmSync('auth2',{recursive:true,force:true});
          fs.mkdirSync('auth2',{recursive:true});
          status="Bad MAC Reset...";
          setTimeout(()=>startBot(), 3000);
          return;
        }
        if(reason !== DisconnectReason.loggedOut){
          status="Reconnexion auto 3s...";
          console.log("🔄 RECONNEXION AUTO DANS 3s...");
          setTimeout(()=>startBot(), 3000);
        } else {
          status="Déconnecté - Fais /clear";
          console.log("❌ LOGGED OUT");
        }
      }
    })

    sock.ev.on('messages.upsert', async({messages, type})=>{
      if(type!=='notify') return
      for(let m of messages){
        if(!m?.message) continue
        const from=m.key.remoteJid; const sender=m.key.participant||from;
        let text=m.message.conversation||m.message.extendedTextMessage?.text||m.message.imageMessage?.caption||m.message.videoMessage?.caption||"";
        const isGroup=from.endsWith('@g.us'); const isMe=m.key.fromMe;
        if(!groupStats[from]) groupStats[from]={total:0}; groupStats[from].total++;
        if(isGroup && db.ghost.includes(from) && !isMe && text){ if(!db.ghostCache[from]) db.ghostCache[from]=[]; db.ghostCache[from].push({sender,text,time:Date.now(),id:m.key.id}); if(db.ghostCache[from].length>200) db.ghostCache[from].shift(); saveDB(); }
        if(isGroup && db.curse[from]?.includes(sender) && !isMe && !isProtected(sender)){
          let orig=(text||"media").slice(0,100); if(!db.curseCount[from]) db.curseCount[from]={}; db.curseCount[from][sender]=(db.curseCount[from][sender]||0)+1; let n=db.curseCount[from][sender]; saveDB();
          setTimeout(()=>{ sock.sendMessage(from,{delete:{remoteJid:from,fromMe:false,id:m.key.id,participant:sender}}).catch(()=>{}) },2500);
          setTimeout(()=>{ sock.sendMessage(from,{text:`⛓️💀 *VOIX VOLÉE #${n}* 💀⛓️\n\n@${sender.split('@')[0]} a essayé de dire:\n> "${orig}"\n\nMais: "Je rampe devant Black Goku... #${n}"`,mentions:[sender]}).catch(()=>{}) },3500);
          continue;
        }
        // === ANTILINK AVEC AVERTISSEMENTS BLACK GOKU 1/2/3/4 ===
        if(isGroup && !isMe && db.antilink.includes(from)){
          let tlow=(text||"").toLowerCase();
          let isLink=/https?:\/\/|www\.|chat\.whatsapp\.com|wa\.me\/|whatsapp\.com\/channel|\/channel\/|t\.me\/|discord\.gg|instagram\.com|youtu\.be|youtube\.com/.test(tlow);
          if(isLink && !isProtected(sender)){
            try{ await sock.sendMessage(from,{delete:{remoteJid:from,fromMe:false,id:m.key.id,participant:sender}}) }catch{}
            if(!db.antilinkWarns[from]) db.antilinkWarns[from]={}; 
            db.antilinkWarns[from][sender]=(db.antilinkWarns[from][sender]||0)+1;
            let warns = db.antilinkWarns[from][sender];
            saveDB();
            if(warns===1){
              await sock.sendMessage(from,{text:`⚠️ *AVERTISSEMENT 1/4* ⚠️\n\n@${sender.split('@')[0]} T'oses envoyer des liens dans mon royaume? La prochaine fois je te brise.`,mentions:[sender]}).catch(()=>{});
            } else if(warns===2){
              await sock.sendMessage(from,{text:`⛓️ *AVERTISSEMENT 2/4* ⛓️\n\n@${sender.split('@')[0]} Tu continues à défier Black Goku? 2 avertissements, plus que 2 avant l'effacement.`,mentions:[sender]}).catch(()=>{});
            } else if(warns===3){
              await sock.sendMessage(from,{text:`💀 *DERNIER AVERTISSEMENT 3/4* 💀\n\n@${sender.split('@')[0]} FAIBLE! C'est ton dernier souffle. Un lien de plus et ton existence sera effacée.`,mentions:[sender]}).catch(()=>{});
            } else if(warns>=4){
              await sock.sendMessage(from,{text:`☯️👑 *HAKAI!* 👑☯️\n\n@${sender.split('@')[0]} TU AS OSÉ DÉFIER BLACK GOKU 4 FOIS!\n\n"Ton existence est une erreur que je vais corriger."\n\n💥 *EFFACÉ DU NÉANT!*`,mentions:[sender]}).catch(()=>{});
              await new Promise(r=>setTimeout(r,1500));
              try{ await sock.groupParticipantsUpdate(from,[sender],"remove") }catch{}
              db.antilinkWarns[from][sender]=0;
              saveDB();
            }
            continue;
          }
        }
        if(isGroup && !isMe && db.antistatus.includes(from)){
          let isStatus=!!(m.message.groupStatusMentionMessage||m.message.groupStatusMentionsMessage||Object.keys(m.message).join('').toLowerCase().includes('statusmention')||m.message.protocolMessage?.type===25);
          if(isStatus && !isProtected(sender)){ try{ await sock.sendMessage(from,{delete:{remoteJid:from,fromMe:false,id:m.key.id,participant:sender}}) }catch{}; continue; }
        }
        if(isGroup && db.antibod[from] && !isMe && !isProtected(sender)){
          let b=text.trim().toLowerCase(); let mode=db.antibod[from]; let del=false;
          if(b.startsWith('.')||b.startsWith('!')||b.startsWith('/')) del=true;
          if(mode>=2 && /^(menu|help|bot|ping|alive|tagall|hidetag|kick|ban)/.test(b.replace(/^[.!\/]/,''))) del=true;
          if(mode>=3 && b.startsWith('₩')){ let allowed=["₩antilink","₩antibod","₩reini","₩curse","₩neant","₩help","₩ai","₩gpt","₩gemini","₩vegeta","₩aion","₩aioff","₩tagall","₩hidetag","₩kick","₩ban","₩promote","₩demote","₩mute","₩unmute","₩admin","₩info","₩stats","₩goku","₩time","₩tim","₩amis","₩groupe","₩no","₩bot","₩rdm","₩vq","₩save","₩protec","₩zenkai","₩chut","₩sticker"]; if(!allowed.some(a=>b.startsWith(a))) del=true; }
          if(del){ try{ await sock.sendMessage(from,{delete:{remoteJid:from,fromMe:false,id:m.key.id,participant:sender}}) }catch{}; continue; }
        }
        if(isGroup && !isMe){ try{ if(db.antisticker.includes(from)&&m.message.stickerMessage){ await sock.sendMessage(from,{delete:{remoteJid:from,fromMe:false,id:m.key.id,participant:sender}}).catch(()=>{}); continue; } if(db.chut[from]?.includes(sender)){ await sock.sendMessage(from,{delete:{remoteJid:from,fromMe:false,id:m.key.id,participant:sender}}).catch(()=>{}); continue; } }catch{} }
        if(!text) continue; text=text.trim();
        let direct=text.toLowerCase().match(/^₩(ai|gpt|gemini|vegeta)\s+(.+)/i);
        if(direct){
          const sNum=sender.replace(/[^0-9]/g,''); const isRealOwner=isMe||sNum===OWNER_NUMBER||sNum.includes("1982215198")||db.ownerLids.includes(sender); const isOwnerLid=isRealOwner||db.amis[sNum]||db.amis[sender];
          if(!isOwnerLid){ await sock.sendMessage(from,{text:R.noPerm},{quoted:m}); continue; }
          let which=direct[1].toLowerCase(); let q=direct[2]; let persona=AI_PERSONAS[which];
          try{ await sock.sendMessage(from,{text:`${persona.emoji} *${persona.name} réfléchit...*`},{quoted:m}); let ans=await askHyper(which,q); if(ans.length>1000) ans=ans.slice(0,1000); await sock.sendMessage(from,{text:`${persona.emoji} *${persona.name}*\n\n${ans}`},{quoted:m}); }catch{ await sock.sendMessage(from,{text:`❌ Erreur ${persona.name}`},{quoted:m}); }
          continue;
        }
        if(!text.startsWith(PREFIX)) continue
        const args=text.slice(1).trim().split(/ +/); const cmd=args[0].toLowerCase(); const txt=args.slice(1).join(' '); const mentioned=m.message.extendedTextMessage?.contextInfo?.mentionedJid||[]; const multi=mentioned;
        let meta=null; if(isGroup){ meta=groupCache.get(from); if(!meta){ meta=await sock.groupMetadata(from).catch(()=>null); if(meta) groupCache.set(from,meta); } }
        const senderNum=sender.replace(/[^0-9]/g,''); const isRealOwner=isMe||senderNum===OWNER_NUMBER||senderNum.includes("1982215198")||db.ownerLids.includes(sender); const isOwnerLid=isRealOwner||db.amis[senderNum]||db.amis[sender]||db.amis[sender.split('@')[0]];
        if(isRealOwner&&!db.ownerLids.includes(sender)){ db.ownerLids.push(sender); saveDB(); }
        if(multi.length>0&&!isRealOwner){ let targetingCreator=multi.some(t=>isCreator(t)); if(targetingCreator&&["kick","ban","chut","blockadmin","demote","curse"].includes(cmd)){ await sock.sendMessage(from,{text:R.creatorProtect,mentions:multi},{quoted:m}); continue; } }
        if(["aion","aioff","aistatus"].includes(cmd)){
          if(!db.aiActive[from]) db.aiActive[from]={};
          if(cmd==="aion"){ db.aiActive[from]={ai:true,gpt:true,gemini:true,vegeta:true}; saveDB(); await sock.sendMessage(from,{text:`🤖 *4 IA ACTIVÉES*`},{quoted:m}); continue; }
          if(cmd==="aioff"){ db.aiActive[from]={}; saveDB(); await sock.sendMessage(from,{text:`💀 *TOUTES IA OFF*`},{quoted:m}); continue; }
          if(cmd==="aistatus"){ let a=db.aiActive[from]||{}; await sock.sendMessage(from,{text:`🤖 *STATUS IA*\n\nAI:${a.ai?'ON ✅':'OFF ❌'}\nGPT:${a.gpt?'ON ✅':'OFF ❌'}\nGEMINI:${a.gemini?'ON ✅':'OFF ❌'}\nVEGETA:${a.vegeta?'ON ✅':'OFF ❌'}`},{quoted:m}); continue; }
        }
        if(cmd==="time"){ if(!isOwnerLid){ await sock.sendMessage(from,{text:R.noPerm},{quoted:m}); continue; } await sock.sendMessage(from,{text:`⏳ 10`},{quoted:m}); for(let i=9;i>=0;i--){ await new Promise(r=>setTimeout(r,1000)); await sock.sendMessage(from,{text:i>0?`⏳ ${i}...`:`💥 BOOM!`},{quoted:m}).catch(()=>{}); } continue; }
        if(cmd==="tim"){ if(!isOwnerLid){ await sock.sendMessage(from,{text:R.noPerm},{quoted:m}); continue; } await sock.sendMessage(from,{text:`⏳ 30`},{quoted:m}); for(let i=29;i>=0;i--){ await new Promise(r=>setTimeout(r,1000)); if(i%5===0||i<=5) await sock.sendMessage(from,{text:i>0?`⏳ ${i}...`:`💥 FIN!`},{quoted:m}).catch(()=>{}); } continue; }
        if(cmd==="bot"){ if(!isRealOwner){ await sock.sendMessage(from,{text:R.noPerm},{quoted:m}); continue; } if(txt.includes("off")){ db.botOff=true; saveDB(); await sock.sendMessage(from,{text:R.botOffMsg},{quoted:m}); } else if(txt.includes("on")){ db.botOff=false; saveDB(); await sock.sendMessage(from,{text:R.botOnMsg},{quoted:m}); } else await sock.sendMessage(from,{text:R.botStatus(db.botOff)},{quoted:m}); continue; }
        if(cmd==="goku"){ if(!isOwnerLid){ await sock.sendMessage(from,{text:R.noPerm},{quoted:m}); continue; } try{ if(fs.existsSync('./goku.jpg')) await sock.sendMessage(from,{image:fs.readFileSync('./goku.jpg'),caption:R.gokuCaption},{quoted:m}); else await sock.sendMessage(from,{text:R.gokuCaption},{quoted:m}); }catch{ await sock.sendMessage(from,{text:R.gokuCaption},{quoted:m}); } continue; }
        if(["black","menu","b","help","aide"].includes(cmd)){ if(!isOwnerLid){ await sock.sendMessage(from,{text:R.creatorProtect},{quoted:m}); continue; } try{ if(fs.existsSync('./menu.jpg')) await sock.sendMessage(from,{image:fs.readFileSync('./menu.jpg'),caption:menuFR},{quoted:m}); else await sock.sendMessage(from,{text:menuFR},{quoted:m}); }catch{ await sock.sendMessage(from,{text:menuFR},{quoted:m}); } continue; }
        if(cmd==="amis"||cmd==="noami"){ if(!isRealOwner){ await sock.sendMessage(from,{text:R.creatorProtect},{quoted:m}); continue; } if(!multi.length){ await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } if(cmd==="amis"){ for(let t of multi){ let num=t.replace(/[^0-9]/g,'').slice(-15); db.amis[num]=true; db.amis[t]=true; db.amis[t.split('@')[0]]=true; if(!db.ownerLids.includes(t)) db.ownerLids.push(t); } saveDB(); await sock.sendMessage(from,{text:R.amis(multi[0]),mentions:multi},{quoted:m}); } else{ for(let t of multi){ let num=t.replace(/[^0-9]/g,'').slice(-15); delete db.amis[num]; delete db.amis[t]; delete db.amis[t.split('@')[0]]; db.ownerLids=db.ownerLids.filter(x=>x!==t); } saveDB(); await sock.sendMessage(from,{text:R.noami(multi[0]),mentions:multi},{quoted:m}); } continue; }
        if(cmd==="goat"){ if(!isRealOwner){ await sock.sendMessage(from,{text:R.onlyGoat},{quoted:m}); continue; } if(!meta) continue; const botNum=sock.user.id.replace(/[^0-9]/g,''); let toKick=meta.participants.filter(p=>{ if(p.id===sock.user.id) return false; if(p.id.replace(/[^0-9]/g,'')===botNum) return false; if(p.id===sender) return false; if(isProtected(p.id)) return false; return true; }).map(p=>p.id); await sock.sendMessage(from,{text:R.goatStart(toKick.length)},{quoted:m}); for(let id of toKick) await sock.groupParticipantsUpdate(from,[id],"remove").catch(()=>{}); await sock.sendMessage(from,{text:R.goatEnd},{quoted:m}); continue; }
        if(!isOwnerLid){ await sock.sendMessage(from,{text:R.noPerm},{quoted:m}); continue }
        if(cmd==="sticker"||cmd==="s"){ try{ let q=m.message.extendedTextMessage?.contextInfo?.quotedMessage; let buffer; if(q?.imageMessage||q?.videoMessage){ buffer=await downloadMediaMessage({key:{remoteJid:from,id:m.message.extendedTextMessage.contextInfo.stanzaId,participant:m.message.extendedTextMessage.contextInfo.participant},message:q},'buffer',{}, {logger:P({level:'silent'}),reuploadRequest:sock.updateMediaMessage}); } else { let type=Object.keys(m.message)[0]; if(type==='imageMessage'||type==='videoMessage') buffer=await downloadMediaMessage({key:m.key,message:{[type]:m.message[type]}},'buffer',{}, {logger:P({level:'silent'}),reuploadRequest:sock.updateMediaMessage}); } if(buffer) await sock.sendMessage(from,{sticker:buffer},{quoted:m}); }catch{} continue; }
        if(cmd==="vq"){ try{ let quoted=m.message.extendedTextMessage?.contextInfo?.quotedMessage; if(!quoted){ await sock.sendMessage(from,{text:R.vqNeed},{quoted:m}); continue; } let viewOnce=quoted.viewOnceMessage||quoted.viewOnceMessageV2; let msgToDownload=viewOnce?viewOnce.message:quoted; let buffer=await downloadMediaMessage({key:{remoteJid:from,id:m.message.extendedTextMessage.contextInfo.stanzaId,participant:m.message.extendedTextMessage.contextInfo.participant},message:msgToDownload},'buffer',{}, {logger:P({level:'silent'}),reuploadRequest:sock.updateMediaMessage}); let vType=Object.keys(msgToDownload)[0]; if(vType==='imageMessage') await sock.sendMessage(from,{image:buffer,caption:R.vqOk},{quoted:m}); else await sock.sendMessage(from,{video:buffer,caption:R.vqOk},{quoted:m}); }catch{} continue; }
        if(cmd==="tagall"||cmd==="hidetag"){ if(!meta) continue; let allIds=meta.participants.map(p=>p.id); if(cmd==="tagall"){ let list=meta.participants.map(p=>`@${p.id.split('@')[0]}`).join('\n'); await sock.sendMessage(from,{text:`${R.tagall(txt)}\n\n${list}`,mentions:allIds}); } else { await sock.sendMessage(from,{text:R.hidetag(txt),mentions:allIds}); } continue; }
        if(cmd==="ban"||cmd==="kick"){ if(!multi.length){ await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } for(let t of multi) await sock.groupParticipantsUpdate(from,[t],"remove").catch(()=>{}); await sock.sendMessage(from,{text:R.ban(multi[0]),mentions:multi},{quoted:m}); continue; }
        if(cmd==="promote"){ for(let t of multi) await sock.groupParticipantsUpdate(from,[t],"promote").catch(()=>{}); await sock.sendMessage(from,{text:R.promote(multi[0]),mentions:multi},{quoted:m}); continue; }
        if(cmd==="demote"){ for(let t of multi) await sock.groupParticipantsUpdate(from,[t],"demote").catch(()=>{}); await sock.sendMessage(from,{text:R.demote(multi[0]),mentions:multi},{quoted:m}); continue; }
        if(cmd==="mute"){ try{ await sock.groupSettingUpdate(from,'announcement'); await sock.sendMessage(from,{text:R.mute},{quoted:m}) }catch{} continue; }
        if(cmd==="unmute"){ try{ await sock.groupSettingUpdate(from,'not_announcement'); await sock.sendMessage(from,{text:R.unmute},{quoted:m}) }catch{} continue; }
        if(cmd==="admin"&&meta){ let admins=meta.participants.filter(p=>p.admin).map(p=>p.id); let list=admins.map((a,i)=>`${i+1}. @${a.split('@')[0]}`).join('\n'); await sock.sendMessage(from,{text:`👑 ADMINS (${admins.length})\n\n${list}`,mentions:admins},{quoted:m}); continue; }
        if(cmd==="info"&&meta){ await sock.sendMessage(from,{text:`📛 ${meta.subject}\n\n👥 ${meta.participants.length} membres\n🆔 ${from}`},{quoted:m}); continue; }
        if(cmd==="groupe"){ if(!isRealOwner) continue; let all=await sock.groupFetchAllParticipating().catch(()=>({})); let txtG=""; let c=0,idx=1; for(let gid in all){ if(!amIAdmin(all[gid])) continue; c++; let a=getActiveCommands(gid); txtG+=`${idx}. "${all[gid].subject}" - ${a.length? a.join(','):'0'}\n`; idx++; } await sock.sendMessage(from,{text:c?`📊 ${c} GROUPES ADMIN\n\n${txtG}`:"❌ Aucun groupe admin"},{quoted:m}); continue; }
        if(cmd==="no"){ if(!isRealOwner) continue; let all=await sock.groupFetchAllParticipating().catch(()=>({})); let txtG=""; let c=0,idx=1; for(let gid in all){ if(amIAdmin(all[gid])) continue; c++; let a=getActiveCommands(gid); txtG+=`${idx}. "${all[gid].subject}" - ${a.length? a.join(','):'0'}\n`; idx++; } await sock.sendMessage(from,{text:c?`📊 ${c} NON-ADMIN\n\n${txtG}`:"✅ Admin partout"},{quoted:m}); continue; }
        if(cmd==="stats"){ let h=Math.floor(process.uptime()/3600); await sock.sendMessage(from,{text:R.statsOk(h),mentions:[]},{quoted:m}); continue; }
        if(cmd==="rdm"&&meta){ let pick=meta.participants[Math.floor(Math.random()*meta.participants.length)]; await sock.sendMessage(from,{text:`🎲 @${pick.id.split('@')[0]} choisi!`,mentions:[pick.id]},{quoted:m}); continue; }
        if(cmd==="reini"){ if(!multi.length){ await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } for(let t of multi) if(db.antilinkWarns[from]) db.antilinkWarns[from][t]=0; saveDB(); await sock.sendMessage(from,{text:R.reiniOk(multi[0]),mentions:multi},{quoted:m}); continue; }
        if(cmd==="antibod"){ if(!txt){ await sock.sendMessage(from,{text:`🛡️ ANTIBOD: ${db.antibod[from]?'ON '+db.antibod[from]:'OFF'}\n₩antibod 1\n₩antibod 2\n₩antibod 3\n₩antibod off`},{quoted:m}); continue; } if(txt.includes("off")){ delete db.antibod[from]; saveDB(); await sock.sendMessage(from,{text:R.antibodOff},{quoted:m}); } else { let mde=txt.includes("3")?3:txt.includes("2")?2:1; db.antibod[from]=mde; saveDB(); await sock.sendMessage(from,{text:R.antibodOn(mde)},{quoted:m}); } continue; }
        if(cmd==="antilink"){ if(txt.includes("off")){ db.antilink=db.antilink.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.antilinkoff},{quoted:m}) } else { if(!db.antilink.includes(from)) db.antilink.push(from); saveDB(); await sock.sendMessage(from,{text:R.antilink},{quoted:m}) } continue; }
        if(cmd==="antisticker"){ if(txt.includes("off")){ db.antisticker=db.antisticker.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.antistickeroff},{quoted:m}) } else { if(!db.antisticker.includes(from)) db.antisticker.push(from); saveDB(); await sock.sendMessage(from,{text:R.antisticker},{quoted:m}) } continue; }
        if(cmd==="antistatus"){ if(txt.includes("off")){ db.antistatus=db.antistatus.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.antistatusoff},{quoted:m}) } else { if(!db.antistatus.includes(from)) db.antistatus.push(from); saveDB(); await sock.sendMessage(from,{text:R.antistatus},{quoted:m}) } continue; }
        if(cmd==="welcome"){ if(txt.includes("off")){ db.welcome=db.welcome.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.welcomeoff},{quoted:m}) } else { if(!db.welcome.includes(from)) db.welcome.push(from); saveDB(); await sock.sendMessage(from,{text:R.welcome},{quoted:m}) } continue; }
        if(cmd==="ghost"){ if(txt.toLowerCase().includes("off")){ db.ghost=db.ghost.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.ghostoff},{quoted:m}); continue; } if(txt.toLowerCase().includes("list")){ if(!db.ghostCache[from]?.length){ await sock.sendMessage(from,{text:R.ghostListEmpty},{quoted:m}); continue; } let last=db.ghostCache[from].slice(-15); let list=last.map((g,i)=>`${i+1}. @${g.sender.split('@')[0]}: ${(g.text||'media').slice(0,40)}`).join('\n'); await sock.sendMessage(from,{text:`👻 GHOST ${db.ghostCache[from].length} msgs\n\n${list}`,mentions:last.map(g=>g.sender)},{quoted:m}); continue; } if(!db.ghost.includes(from)) db.ghost.push(from); saveDB(); await sock.sendMessage(from,{text:R.ghost},{quoted:m}); continue; }
        if(cmd==="curse"){ if(!multi.length){ await sock.sendMessage(from,{text:"😈 TAG: ₩curse @m"},{quoted:m}); continue; } if(!db.curse[from]) db.curse[from]=[]; if(!db.curseCount[from]) db.curseCount[from]={}; for(let t of multi) if(!db.curse[from].includes(t)) db.curse[from].push(t); for(let t of multi) db.curseCount[from][t]=0; saveDB(); await sock.sendMessage(from,{text:R.curseOn(multi[0]),mentions:multi},{quoted:m}); continue; }
        if(cmd==="uncurse"){ if(!multi.length){ await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } if(db.curse[from]) for(let t of multi) db.curse[from]=db.curse[from].filter(x=>x!==t); if(db.curseCount[from]) for(let t of multi) delete db.curseCount[from][t]; saveDB(); await sock.sendMessage(from,{text:R.curseOff(multi[0]),mentions:multi},{quoted:m}); continue; }
        if(cmd==="neant"||cmd==="void"){ let count=parseInt(txt)||50; if(count>100) count=100; let msgs=db.ghostCache[from]||[]; let del=0; await sock.sendMessage(from,{text:R.neantStart(count),},{quoted:m}); for(let i=msgs.length-1;i>=0&&del<count;i--){ try{ await sock.sendMessage(from,{delete:{remoteJid:from,fromMe:false,id:msgs[i].id,participant:msgs[i].sender}}); del++; }catch{} await new Promise(r=>setTimeout(r,80)); } await sock.sendMessage(from,{text:R.neantOn(count,del),},{quoted:m}); continue; }
        if(cmd==="save"){ if(!multi.length){ await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } for(let t of multi) if(!db.saved.includes(t)) db.saved.push(t); saveDB(); await sock.sendMessage(from,{text:R.save(multi[0]),mentions:multi},{quoted:m}); continue; }
        if(cmd==="unsave"){ if(!multi.length){ await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } for(let t of multi) db.saved=db.saved.filter(x=>x!==t); saveDB(); await sock.sendMessage(from,{text:R.unsave(multi[0]),mentions:multi},{quoted:m}); continue; }
        if(cmd==="protec"){ if(!multi.length){ await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } for(let t of multi) if(!db.protec.includes(t)) db.protec.push(t); saveDB(); await sock.sendMessage(from,{text:R.protec(multi[0]),mentions:multi},{quoted:m}); continue; }
        if(cmd==="unprotect"){ if(!multi.length){ await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } for(let t of multi) db.protec=db.protec.filter(x=>x!==t); saveDB(); await sock.sendMessage(from,{text:R.unprotec(multi[0]),mentions:multi},{quoted:m}); continue; }
        if(cmd==="zenkai"){ if(!multi.length){ await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } for(let t of multi){ if(!db.zenkai.includes(t)) db.zenkai.push(t); if(!db.protec.includes(t)) db.protec.push(t); if(!db.saved.includes(t)) db.saved.push(t); if(!db.angel.includes(t)) db.angel.push(t); } saveDB(); await sock.sendMessage(from,{text:R.zenkai(multi[0]),mentions:multi},{quoted:m}); continue; }
        if(cmd==="nozenkai"||cmd==="unzenkai"){ if(!multi.length){ await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } for(let t of multi){ db.zenkai=db.zenkai.filter(x=>x!==t); db.protec=db.protec.filter(x=>x!==t); db.saved=db.saved.filter(x=>x!==t); db.angel=db.angel.filter(x=>x!==t); } saveDB(); await sock.sendMessage(from,{text:R.nozenkai(multi[0]),mentions:multi},{quoted:m}); continue; }
        if(cmd==="chut"){ if(!multi.length){ await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } if(!db.chut[from]) db.chut[from]=[]; for(let t of multi) if(!db.chut[from].includes(t)) db.chut[from].push(t); saveDB(); await sock.sendMessage(from,{text:R.chut(multi[0]),mentions:multi},{quoted:m}); continue; }
        if(cmd==="unchut"){ if(!multi.length){ await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } if(db.chut[from]) for(let t of multi) db.chut[from]=db.chut[from].filter(x=>x!==t); saveDB(); await sock.sendMessage(from,{text:R.unchut(multi[0]),mentions:multi},{quoted:m}); continue; }
        if(cmd==="blockadmin"){ if(!multi.length){ await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } for(let t of multi) if(!db.blockadmin.includes(t)) db.blockadmin.push(t); saveDB(); await sock.sendMessage(from,{text:R.blockadmin(multi[0]),mentions:multi},{quoted:m}); continue; }
        if(cmd==="unblockadmin"){ if(!multi.length){ await sock.sendMessage(from,{text:R.needTag},{quoted:m}); continue; } for(let t of multi) db.blockadmin=db.blockadmin.filter(x=>x!==t); saveDB(); await sock.sendMessage(from,{text:R.unblockadmin(multi[0]),mentions:multi},{quoted:m}); continue; }
        if(cmd==="antilock"){ if(txt.includes("off")){ db.antilock=db.antilock.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.antilockoff},{quoted:m}) } else { if(!db.antilock.includes(from)) db.antilock.push(from); saveDB(); await sock.sendMessage(from,{text:R.antilock},{quoted:m}) } continue; }
        if(cmd==="antidemote"){ if(txt.includes("off")){ db.antidemote=db.antidemote.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.antidemoteoff},{quoted:m}) } else { if(!db.antidemote.includes(from)) db.antidemote.push(from); saveDB(); await sock.sendMessage(from,{text:R.antidemote},{quoted:m}) } continue; }
        if(cmd==="boy"){ if(txt.includes("off")){ db.boy=db.boy.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.boyOff},{quoted:m}); continue } if(txt.includes("on")||!multi.length){ if(!db.boy.includes(from)) db.boy.push(from); saveDB(); await sock.sendMessage(from,{text:R.boyOn},{quoted:m}); continue } for(let t of multi){ if(!db.angel.includes(t)) db.angel.push(t); if(!db.protec.includes(t)) db.protec.push(t); if(!db.zenkai.includes(t)) db.zenkai.push(t); if(!db.saved.includes(t)) db.saved.push(t); } saveDB(); await sock.sendMessage(from,{text:R.boyProtect(multi[0]),mentions:multi},{quoted:m}); continue; }
      }
    })
    sock.ev.on('group-participants.update', async(update)=>{
      try{
        const { id, participants, action, author } = update; groupCache.del(id);
        let meta=await sock.groupMetadata(id).catch(()=>null); let gName=meta?.subject||"ce groupe";
        if(action==='demote'){ for(let p of participants){ if(db.zenkai.includes(p)||isProtected(p)){ await sock.groupParticipantsUpdate(id,[p],"promote").catch(()=>{}); await sock.sendMessage(id,{text:`👑 ZENKAI! @${p.split('@')[0]} impossible à destituer!`,mentions:[p]}).catch(()=>{}); } } }
        if(action==='remove'){
          for(let p of participants){ if(db.zenkai.includes(p)){ await new Promise(r=>setTimeout(r,1500)); try{ await sock.groupParticipantsUpdate(id,[p],"add").catch(()=>{}); await sock.sendMessage(id,{text:`👑 ZENKAI! @${p.split('@')[0]} protégé à vie!`,mentions:[p]}).catch(()=>{}); if(author&&!isProtected(author)&&author!==sock.user.id){ await new Promise(r=>setTimeout(r,1000)); await sock.groupParticipantsUpdate(id,[author],"remove").catch(()=>{}); } }catch{} } }
          if(db.welcome.includes(id)){ let p=participants[0]; if(p&&!db.zenkai.includes(p)){ try{ await sock.sendMessage(id,{text:R.byeMsg(p,gName),mentions:[p]}).catch(()=>{}) }catch{} } } return;
        }
        if(action==='add'&&db.welcome.includes(id)){ try{ let p=participants[0]; await sock.sendMessage(id,{text:R.welcomeMsg(p,gName),mentions:[p]}).catch(()=>{}); }catch{} }
      }catch{}
    })
  }catch(e){ console.log("Erreur",e.message); setTimeout(()=>startBot(),5000); }
}
startBot()
app.listen(PORT,'0.0.0.0',()=>console.log("BLACK GOKU V22.6 COMPLET OK - Port "+PORT))
setInterval(()=>{ try{ axios.get(`http://localhost:${PORT}/health`).catch(()=>{}) }catch{} },300000)
