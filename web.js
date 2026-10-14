const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, downloadMediaMessage } = require('@whiskeysockets/baileys')
const P = require('pino')
const fs = require('fs')
const express = require('express')
const NodeCache = require('node-cache')
const app = express()
const PORT = process.env.PORT || 3000

const OWNER_NUMBER = "555182215198"
const PREFIX = "₩"
const DB_FILE = './black_db.json'
const msgRetryCounterCache = new NodeCache()

let db = { amis:{}, saved:[], pro:[], protec:[], chut:{}, blockadmin:[], godmode:[], kaio:[], antilink:[], antisticker:[], antistatus:[], welcome:[], pt:[], ghost:[], muted:[] }
if(fs.existsSync(DB_FILE)){ try{ db={...db,...JSON.parse(fs.readFileSync(DB_FILE))} }catch{} }
const saveDB = ()=>fs.writeFileSync(DB_FILE, JSON.stringify(db))

let sock, status="Demarrage...", lastCode="pas encore"
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
  noPerm: "😈 Tu oses invoquer BLACK GOKU sans ma permission? Agenouille-toi, mortel. Seuls mes AMIS peuvent utiliser mon pouvoir. Tu n'es que poussière devant un Dieu.",
  onlyOwner: "👑🔥 SEUL LE DIEU SUPRÊME 555182215198 PEUT FAIRE ÇA. Tu n'es pas digne de prononcer mon nom, insecte.",
  ban:(j)=>`💀 HAKAI! @${j.split('@')[0]} effacé de l'existence par BLACK GOKU. Son âme m'appartient désormais. Il n'a jamais existé.`,
  kick:(j)=>`💀 @${j.split('@')[0]} expulsé du royaume divin. BLACK GOKU l'a jugé indigne. Qu'il rampe ailleurs.`,
  promote:(j)=>`👑 @${j.split('@')[0]} élevé au rang de Dieu de la Destruction par BLACK GOKU lui-même. Ne me déçois pas, ou tu subiras le même sort qu'eux.`,
  promoteMin:(j)=>`⏳ @${j.split('@')[0]} reçoit un fragment de mon pouvoir. Admin pour quelques minutes seulement. Profites-en avant que je ne te le reprenne.`,
  demote:(j)=>`💔 @${j.split('@')[0]} déchu. BLACK GOKU t'a arraché ta divinité. Tu redeviens ce que tu as toujours été: un insecte.`,
  mute:"🤫 SILENCE ABSOLU! BLACK GOKU ordonne le silence! Que les mortels ferment leur bouche! Seuls les Dieux parleront désormais!",
  unmute:"🔊 BLACK GOKU vous autorise à ramper à nouveau. Parlez, mais chaque mot sera jugé par votre Dieu.",
  admin:(list)=>`👑 *LES DIEUX DE CE ROYAUME - DÉCRÉTÉ PAR BLACK GOKU* 👑\n\n${list}\n\nAgenouillez-vous devant eux.`,
  info:(n,c)=>`📜 *JUGEMENT DE BLACK GOKU*\n\nRoyaume: ${n}\nÂmes piégées: ${c}\nDieu régnant: BLACK GOKU H24\nStatut: Éternel, Intouchable.`,
  stats:(m,a)=>`📊 *BILAN DE VOTRE DIEU*\nMortels: ${m}\nDieux mineurs: ${a}\nAmis du Dieu: ${Object.keys(db.amis).length}\nProtégés: ${db.protec.length}\nMaudits: ${Object.keys(db.chut).length}`,
  time:()=>`⏰ Le temps n'a aucun pouvoir sur BLACK GOKU. Mais pour vous: ${new Date().toLocaleString('pt-BR')}. Votre heure approche.`,
  tagall:(t)=>`🔥🔥 *BLACK GOKU VOUS INVOQUE, VERMINE!* 🔥🔥\n\n${t||"Agenouillez-vous TOUS devant votre Dieu suprême!"}`,
  hidetag:(t)=>`👻 Invocation silencieuse de BLACK GOKU...\n${t||"Vous êtes tous marqués."}`,
  chut:(j)=>`🔇 @${j.split('@')[0]} condamné au Néant par BLACK GOKU. Chaque message que tu enverras sera effacé de l'existence.`,
  unchut:(j)=>`🔓 @${j.split('@')[0]} BLACK GOKU te donne une seconde chance. Une seule.`,
  blockadmin:(j)=>`⛓️ @${j.split('@')[0]} TES POUVOIRS SONT SCELLÉS! Tu portes la couronne mais tu n'es qu'un pantin impuissant!`,
  unblockadmin:(j)=>`🔓 @${j.split('@')[0]} tes chaînes sont brisées. Ne me trahis plus.`,
  save:(j)=>`🛡️ @${j.split('@')[0]} marqué par BLACK GOKU. Intouchable. Sous mon aile divine.`,
  unsave:(j)=>`🛡️ Marque retirée @${j.split('@')[0]}. BLACK GOKU l'abandonne.`,
  pro:(j)=>`✨ @${j.split('@')[0]} béni par la protection PRO de BLACK GOKU. Au-dessus des lois.`,
  protec:(j)=>`👑🔥🔥 *PROTEC ABSOLUE DE BLACK GOKU* 🔥🔥👑\n\n@${j.split('@')[0]} est l'ÉLU! Même s'il n'est pas admin, BLACK GOKU le protégera! Si tu oses le bannir, C'EST TOI QUI SERAS BANNI!`,
  unprotec:(j)=>`💀 PROTEC retirée! @${j.split('@')[0]} n'est plus sous ma protection. Il est de nouveau une proie.`,
  protecTriggered:(prot, att)=>`☯️🔥 *PROTEC DE BLACK GOKU ACTIVÉE!* 🔥☯️\n\n💀 @${att.split('@')[0]} a osé bannir @${prot.split('@')[0]} l'élu!\n\n⚡ BLACK GOKU INTERVIENT!\n✅ Élu remis\n💀 Attaquant banni!`,
  protecDemote:(prot, att)=>`☯️🔥 *PROTEC ANTI-DEMOTE ACTIVÉE!* 🔥☯️\n\n💀 @${att.split('@')[0]} a osé révoquer l'admin de @${prot.split('@')[0]}!\n\n⚡ BLACK GOKU INTERVIENT!\n✅ Admin rendu à l'élu\n💀 Attaquant déchu!`,
  protecFail: "⚠️ PROTEC détecté mais je ne suis pas admin! METTEZ BLACK GOKU ADMIN!",
  godmode:"☯️ *GODMODE ACTIVÉ* ☯️ JE SUIS BLACK GOKU, DIEU ABSOLU. INTANGIBLE. IMMORTEL.",
  godmodeoff:"GODMODE OFF. Je dors d'un seul œil.",
  kaio:"🔥 *KAIO-KEN x1000 ACTIVÉ!* BLACK GOKU VOIT TOUT! Même vos messages supprimés seront dévoilés!",
  kaiooff:"KAIO OFF. Je ferme les yeux... pour l'instant.",
  antilink:"🔗 *ANTILINK DÉCRÉTÉ PAR BLACK GOKU!* Les liens sont interdits!",
  antilinkoff:"ANTILINK OFF.",
  antisticker:"🖼️ *ANTISTICKER!* Pas de stickers dans mon royaume!",
  antistickeroff:"ANTISTICKER OFF.",
  antistatus:"👁️ *ANTISTATUS!* OSE ME MENTIONNER ET JE T'EFFACE!",
  antistatusoff:"ANTISTATUS OFF.",
  welcome:"👋 *WELCOME ON* - BLACK GOKU accueillera chaque nouvelle âme.",
  welcomeoff:"WELCOME OFF.",
  welcomeMsg:(j, g)=>`꧁༒☬ BIENVENUE DANS MON ROYAUME ☬༒꧂\n\n👑 @${j.split('@')[0]} vient de pénétrer dans *${g}*.\n\nJe suis BLACK GOKU, ton Dieu.\n1️⃣ Plie le genou et sers-moi\n2️⃣ Défie-moi et sois effacé\n\nChoisis bien... mortel.\n\n*BLACK GOKU H24* 💀🔥`,
  byeMsg:(j)=>`💀 @${j.split('@')[0]} a fui mon royaume comme un lâche.`,
  vqOk: "👁️🔥 *VUE UNIQUE Dévoilée PAR BLACK GOKU* 🔥👁️\n\n💀 BLACK GOKU a brisé la vue unique! Elle voulait disparaître, mais un Dieu ne laisse rien disparaître! Elle est maintenant éternelle!",
  vqNeed: "😈 Réponds à une photo/vidéo à vue unique avec ₩vq! BLACK GOKU voit tout!",
  sticker:"✨ Sticker forgé par BLACK GOKU.",
  rdm:(n)=>`🎲 BLACK GOKU a parlé! Le destin a choisi: *${n}*!`,
  boy:"💀 Un garçon? JE SUIS UN DIEU, INSECTE!",
  ghost:"👻 *GHOST MODE* - BLACK GOKU devient invisible. Je vous vois TOUJOURS.",
  ghostoff:"GHOST OFF.",
  pt:"🗣️ Modo BLACK GOKU PT ativado. Ajoelhem-se.",
  ptoff:"Modo PT OFF.",
  boton:"🤖🔥 *BLACK GOKU SE RÉVEILLE!* TREMBLEZ, MORTELS!",
  botoff:"💤 BLACK GOKU S'ENDORT...",
  amis:(j)=>`✅✅✅ *AMITIÉ DIVINE!* @${j.split('@')[0]} DÉSORMAIS AMI DE BLACK GOKU! Il peut manier mon pouvoir!`,
  noami:(j)=>`❌💀 *BANNISSEMENT DIVIN!* @${j.split('@')[0]} BANI! Tu redeviens un insecte!`,
  needTag:"😈 TAG UN MORTEL, IDIOT! @m"
}

app.get('/', (req,res)=> res.send(`<h1>${status}</h1><p>CODE: ${lastCode}</p><a href="/pair?num=${OWNER_NUMBER}">PAIR</a> | <a href="/clear">CLEAR</a>`))
app.get('/clear', (req,res)=>{ try{ if(fs.existsSync('auth2')) fs.rmSync('auth2',{recursive:true,force:true}); res.send('✅ CLEAR OK') }catch(e){ res.send(e.message) } })
app.get('/pair', async(req,res)=>{
  let num=(req.query.num||'').replace(/[^0-9]/g,'')||OWNER_NUMBER
  try{ let code=await sock.requestPairingCode(num); lastCode=code; res.send(`<h1 style="font-size:60px">${code}</h1>`) }catch(e){ res.send('Erreur: '+e.message) }
})

async function startBot(){
  const { version } = await fetchLatestBaileysVersion()
  const { state, saveCreds } = await useMultiFileAuthState('auth2')
  sock = makeWASocket({ version, auth:{creds:state.creds, keys:makeCacheableSignalKeyStore(state.keys, P({level:'silent'}))}, logger:P({level:'silent'}), browser:["Chrome","Ubuntu","22.04"], msgRetryCounterCache, markOnlineOnConnect:false, syncFullHistory:false })
  sock.ev.on('creds.update', saveCreds)
  sock.ev.on('connection.update', u=>{ if(u.connection==='open') status="BLACK GOKU ACTIF ✅"; if(u.connection==='close') setTimeout(startBot,3000) })

  sock.ev.on('messages.upsert', async({messages, type})=>{
    if(type!=='notify') return
    const m=messages[0]; if(!m?.message) return
    const from=m.key.remoteJid
    if(from.endsWith('@g.us') && db.kaio.includes(from)){
      messageStore[m.key.id] = { text: m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || "[media]", sender: m.key.participant || from, from }
    }
  })

  sock.ev.on('messages.update', async(updates)=>{
    for(let update of updates){
      if(update.update.message === null && messageStore[update.key.id]){
        let stored = messageStore[update.key.id]
        if(db.kaio.includes(stored.from)){
          let sender = stored.sender
          await sock.sendMessage(stored.from, {text: `🔥 *KAIO-KEN! MESSAGE SUPPRIMÉ DÉTECTÉ!* 🔥\n\n@${sender.split('@')[0]} a supprimé: \n\n"${stored.text}"\n\n💀 BLACK GOKU VOIT TOUT!`, mentions:[sender]})
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

  sock.ev.on('messages.upsert', async({messages, type})=>{
    if(type!=='notify') return
    const m=messages[0]; if(!m?.message) return
    const from=m.key.remoteJid
    const sender = m.key.participant || from
    const senderNum = sender.replace(/[^0-9]/g,'')
    const isMe = m.key.fromMe
    const isOwner = isMe || senderNum.includes(OWNER_NUMBER) || db.amis[senderNum] || db.amis[sender]
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
        if(vType==='imageMessage'){
          await sock.sendMessage(from, {image: buffer, caption: R.vqOk+"\n\n"+cap}, {quoted:m})
        } else if(vType==='videoMessage'){
          await sock.sendMessage(from, {video: buffer, caption: R.vqOk+"\n\n"+cap}, {quoted:m})
        } else {
          await sock.sendMessage(from, {text: "❌ Pas une vue unique"}, {quoted:m})
        }
      }catch(e){
        await sock.sendMessage(from, {text: "❌ Erreur VQ: "+e.message}, {quoted:m})
      }
      return
    }

    if(isGroup && (cmd==="tagall" || cmd==="hidetag")){
      if(!meta) return
      let mentions=meta.participants.map(p=>p.id)
      let tagText = (cmd==="tagall"?R.tagall(txt):"👻 Invocation silencieuse de BLACK GOKU...\n\n"+txt) + "\n\n" + meta.participants.map(p=>`@${p.id.split('@')[0]}`).join(' ')
      await sock.sendMessage(from,{text:tagText, mentions})
    }

    if((cmd==="ban" || cmd==="kick")){
      if(!target) return await sock.sendMessage(from,{text:R.needTag})
      let isProtected = db.protec.includes(target) || db.pro.includes(target) || db.saved.includes(target)
      if(isProtected){ await sock.sendMessage(from,{text:`😈 IMPOSSIBLE! @${target.split('@')[0]} est sous PROTEC de BLACK GOKU!`, mentions:[target]}); return }
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

    if(cmd==="godmode"){
      if(txt.includes("off")){ db.godmode=db.godmode.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.godmodeoff})
      } else { if(!db.godmode.includes(from)) db.godmode.push(from); saveDB(); await sock.sendMessage(from,{text:R.godmode}) }
    }
    if(cmd==="kaio"){
      if(txt.includes("off")){ db.kaio=db.kaio.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.kaiooff})
      } else { if(!db.kaio.includes(from)) db.kaio.push(from); saveDB(); await sock.sendMessage(from,{text:R.kaio}) }
    }
    if(cmd==="antilink") await sock.sendMessage(from,{text:txt.includes("off")?R.antilinkoff:R.antilink})
    if(cmd==="antisticker") await sock.sendMessage(from,{text:txt.includes("off")?R.antistickeroff:R.antisticker})
    if(cmd==="antistatus") await sock.sendMessage(from,{text:txt.includes("off")?R.antistatusoff:R.antistatus})
    if(cmd==="welcome"){
      if(txt.includes("off")){ db.welcome=db.welcome.filter(x=>x!==from); saveDB(); await sock.sendMessage(from,{text:R.welcomeoff})
      } else { if(!db.welcome.includes(from)) db.welcome.push(from); saveDB(); await sock.sendMessage(from,{text:R.welcome}) }
    }
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
}
startBot()
app.listen(PORT, '0.0.0.0', ()=>console.log("BLACK GOKU LIVE "+PORT))
