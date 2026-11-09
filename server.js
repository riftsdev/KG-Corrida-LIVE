import express from 'express';
import http from 'node:http';
import { Server } from 'socket.io';
import { TikTokLiveConnection, WebcastEvent } from 'tiktok-live-connector';
const app=express(),server=http.createServer(app),io=new Server(server);
app.use(express.static('public'));
const PORT=process.env.PORT||3000,TOKEN=process.env.ADMIN_TOKEN||'';
let room=(process.env.TIKTOK_USERNAME||'').replace(/^@/,''),connection=null,connected=false,connecting=false;
const rate=new Map();
const clean=(s,n=64)=>String(s??'').slice(0,n).replace(/[<>]/g,'');
const user=d=>({id:clean(d.userId||d.uniqueId||d.nickname),name:clean(d.nickname||d.uniqueId||'Jogador',32),avatar:typeof d.profilePictureUrl==='string'&&d.profilePictureUrl.startsWith('https://')?d.profilePictureUrl:''});
function throttle(key,ms){const now=Date.now(),prev=rate.get(key)||0;if(now-prev<ms)return true;rate.set(key,now);if(rate.size>5000)rate.clear();return false;}
const emit=(type,data)=>io.emit('live-event',{type,...data,at:Date.now()});
app.get('/health',(_,res)=>res.json({ok:true,connected,room:room||null}));
async function connect(name){if(connecting)return;connecting=true;try{if(connection)try{connection.disconnect()}catch{};connected=false;room=name;connection=new TikTokLiveConnection(name,{enableExtendedGiftInfo:true});
connection.on(WebcastEvent.CHAT,d=>{const u=user(d);if(u.id&&!throttle('c'+u.id,500))emit('chat',{user:u,text:clean(d.comment,160)})});
connection.on(WebcastEvent.LIKE,d=>{const u=user(d);if(u.id&&!throttle('l'+u.id,350))emit('like',{user:u,count:Math.max(1,Math.min(Number(d.likeCount)||1,15))})});
connection.on(WebcastEvent.GIFT,d=>{if(d.giftType===1&&!d.repeatEnd)return;const u=user(d);if(u.id)emit('gift',{user:u,gift:clean(d.giftName||'Presente',40),diamonds:Math.max(0,Number(d.diamondCount)||0)})});
connection.on(WebcastEvent.DISCONNECTED,()=>{connected=false;io.emit('status',{connected,room,error:'LIVE desconectada'})});
connection.on(WebcastEvent.ERROR,e=>io.emit('status',{connected,room,error:clean(e?.message||e,180)}));
await connection.connect();connected=true;io.emit('status',{connected,room});
}catch(e){connected=false;io.emit('status',{connected,room,error:clean(e?.message||e,180)})}finally{connecting=false}}
io.on('connection',socket=>{socket.emit('status',{connected,room,requiresToken:!!TOKEN});socket.on('admin-connect',async({username,token}={})=>{if(!TOKEN||token!==TOKEN)return socket.emit('status',{connected,room,error:'Token de administrador inválido'});const name=clean(username,50).replace(/^@/,'');if(!/^[a-zA-Z0-9._]{2,40}$/.test(name))return socket.emit('status',{connected,room,error:'Usuário TikTok inválido'});await connect(name)})});
if(room)connect(room);server.listen(PORT,'0.0.0.0',()=>console.log('KG Corrida LIVE',PORT));