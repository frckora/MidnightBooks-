"use strict";

const STATS_API = "https://script.google.com/macros/s/AKfycbwefIzQhdYwfIXTFKHdHUMC0Xj6C_lolyQ-w0qbx5S97XioQEykXNMfw2rsgN6JcPhO7g/exec";

function applyStatsPayload(data){state.statisticsEnabled=!!data?.enabled;const incoming=data?.stats||{};state.stats={};state.books.forEach(b=>state.stats[String(b.id)]=incoming[String(b.id)]||zeroStats());state.userRatings=data?.my_ratings||{}}
function statsRequest(action,bookId="",rating=0){
  if(!statsReady())return Promise.resolve({ok:true,enabled:false,stats:{},my_ratings:{}});
  return new Promise((resolve,reject)=>{
    const cb="mbStatsCb_"+Date.now()+"_"+Math.random().toString(36).slice(2);
    const script=document.createElement("script");
    const timer=setTimeout(()=>{cleanup();reject(new Error("stats timeout"))},15000);
    function cleanup(){clearTimeout(timer);try{delete window[cb]}catch{}script.remove()}
    window[cb]=(data)=>{cleanup();applyStatsPayload(data);resolve(data)};
    const q=new URLSearchParams({callback:cb,action:String(action),book_id:String(bookId||""),rating:String(rating||0),user_id:telegramUserId(),t:String(Date.now())});
    script.src=STATS_API+"?"+q.toString();
    script.onerror=()=>{cleanup();reject(new Error("stats network error"))};
    document.head.appendChild(script);
  });
}
async function loadStats(){
  if(!statsReady()){state.statisticsEnabled=false;state.stats={};state.userRatings={};state.books.forEach(b=>state.stats[String(b.id)]=zeroStats());render();return}
  try{await statsRequest("stats");render()}catch{state.statisticsEnabled=false;state.stats={};state.userRatings={};state.books.forEach(b=>state.stats[String(b.id)]=zeroStats())}
}
async function recordView(id){if(!state.statisticsEnabled)return;try{await statsRequest("view",id);render();if(state.currentBook?.id===id)showBookModal()}catch{}}
async function setUserRating(id,rating){if(!state.statisticsEnabled){toast("Статистика ещё не запущена");return}const r=Math.max(1,Math.min(5,Number(rating)||0));try{await statsRequest("rating",id,r);toast("Оценка сохранена");render();if(state.currentBook?.id===id)showBookModal()}catch{toast("Не удалось сохранить оценку")}}
