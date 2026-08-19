"use strict";

function tg(){return window.Telegram && Telegram.WebApp ? Telegram.WebApp : null}
function h(s){return String(s ?? "").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function arr(v){if(Array.isArray(v)) return v; if(v==null || v==="") return []; return String(v).split(/\s*[|;,]\s*/).filter(Boolean)}
function num(v,f=0){const n=parseFloat(String(v??"").replace(",","."));return Number.isFinite(n)?n:f}
function escUrl(url){try{return new URL(String(url).trim(), window.location.href).href}catch{return ""}}
function normalizeId(v){return String(v??"").trim().replace(/^0+(?=\d)/,"")}
function storageGet(k,f){try{const v=localStorage.getItem(k);return v===null?f:JSON.parse(v)}catch{return f}}
function storageSet(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}
function toast(t){const el=document.getElementById("toast");el.textContent=t;el.classList.add("show");clearTimeout(window.__toast);window.__toast=setTimeout(()=>el.classList.remove("show"),1800)}
function getFavoriteIds(){return storageGet("favorites",[]).map(String)}
function isFavorite(id){return getFavoriteIds().includes(String(id))}
function getStatus(id){return storageGet("book_status_"+id,"")}
function telegramUserId(){try{const u=tg()?.initDataUnsafe?.user;if(u?.id)return String(u.id)}catch{}let id=storageGet("midnightbooks_guest_id","");if(!id){id="guest_"+Math.random().toString(36).slice(2)+"_"+Date.now();storageSet("midnightbooks_guest_id",id)}return id}
function formatDate(s){const d=new Date(s);if(Number.isNaN(d.getTime()))return s||"";return d.toLocaleDateString("ru-RU",{day:"2-digit",month:"2-digit",year:"numeric"})}
function plural(n,a,b,c){return n%10===1&&n%100!==11?a:(n%10>=2&&n%10<=4&&(n%100<10||n%100>=20)?b:c)}
function statsReady(){return /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec(?:[?#].*)?$/.test(String(STATS_API||"").trim())}
function zeroStats(){return {views:0,downloads:0,rating_sum:0,rating_count:0,rating:0}}
function getBookStats(id){return state.stats[String(id)]||zeroStats()}
function getViews(id){return Number(getBookStats(id).views||0)}
function getDownloads(id){return Number(getBookStats(id).downloads||0)}
function getRatingCount(id){return Number(getBookStats(id).rating_count||0)}
function getBookRating(b){return Number(getBookStats(b.id).rating||0)}
function getUserRating(id){return Number(state.userRatings[String(id)]||0)}
function normalizeCoverUrl(value){
  let raw=String(value ?? "").trim(); if(!raw)return "";
  const imageFormula=raw.match(/=IMAGE\s*\(\s*["']([^"']+)["']/i); if(imageFormula)raw=imageFormula[1];
  const href=raw.match(/href\s*=\s*["']([^"']+)["']/i); if(href)raw=href[1];
  const urlMatch=raw.match(/https?:\/\/[^\s<>"']+/i); if(urlMatch)raw=urlMatch[0];
  raw=raw.replace(/[),.;]+$/g,"");
  let github=raw.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/i);
  if(github){const owner=github[1],repo=github[2],branch=github[3],filePath=github[4].split('#')[0].split('?')[0];return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`}
  let githubRaw=raw.match(/^https?:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/i); if(githubRaw)return raw;
  let m=raw.match(/drive\.google\.com\/file\/d\/([^/]+)/i); if(m)return `https://drive.google.com/thumbnail?id=${encodeURIComponent(m[1])}&sz=w1000`;
  m=raw.match(/drive\.google\.com\/(?:open\?id=|uc\?(?:export=download&)?id=)([^&]+)/i); if(m)return `https://drive.google.com/thumbnail?id=${encodeURIComponent(m[1])}&sz=w1000`;
  return escUrl(raw);
}
function normalizeFileUrl(value){
  let raw=String(value ?? "").trim(); if(!raw)return "";
  const href=raw.match(/href\s*=\s*["']([^"']+)["']/i); if(href)raw=href[1];
  const urlMatch=raw.match(/https?:\/\/[^\s<>"']+/i); if(urlMatch)raw=urlMatch[0];
  raw=raw.replace(/[),.;]+$/g,"");
  const github=raw.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/i);
  if(github){const owner=github[1],repo=github[2],branch=github[3],filePath=github[4].split('#')[0].split('?')[0];return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`}
  return escUrl(raw);
}
function normalizeBook(b,i){
  return {
    ...b,
    id:normalizeId(b.id??i+1),
    title:String(b.title??"Без названия"),
    author:String(b.author??"Неизвестный автор"),
    series:String(b.series??""),
    series_order:String(b.series_order??""),
    trops:typeof b.trops==='string'?b.trops.split(',').map(t=>t.trim()).filter(Boolean):(b.trops||[]),
    triggers:typeof b.triggers==='string'?b.triggers.split(',').map(t=>t.trim()).filter(Boolean):(b.triggers||[]),
    quotes:typeof b.quotes==='string'?b.quotes.split('|').map(q=>q.trim()).filter(Boolean):(b.quotes||[]),
    description:String(b.description??"Описание пока не добавлено."),
    cover_emoji:String(b.cover_emoji??["🌹","🗡️","🎭","🌿"][i%4]),
    rating:0,
    release_date:String(b.release_date??""),
    status:String(b.status??"published")
  };
}
function toggleFavorite(id){const ids=getFavoriteIds(),s=String(id),i=ids.indexOf(s);if(i>=0)ids.splice(i,1);else ids.push(s);storageSet("favorites",ids);render();if(state.currentBook)openBook(state.currentBook.id,false)}
function setStatus(id,status){storageSet("book_status_"+id,status);toast(status==="reading"?"Статус: читаю":"Статус обновлён");render()}
function quoteOfDay(){const d=new Date(),key=d.getFullYear()+"-"+(d.getMonth()+1)+"-"+d.getDate();let hash=0;for(const c of key)hash=(hash*31+c.charCodeAt(0))>>>0;const q=QUOTES[hash%QUOTES.length];const b=state.books.length?state.books[hash%state.books.length]:null;return {text:q,source:b?b.title:"MidnightBooks"}}
