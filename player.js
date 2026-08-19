"use strict";

function playTracks(tracks,index=0){
  if(!tracks.length)return;
  state.player.tracks=tracks;state.player.index=index;
  if(state.player.audio){state.player.audio.pause();state.player.audio=null}
  const track=tracks[index];if(!track.url){toast("У этого трека нет аудиофайла");updatePlayer();return}
  const a=new Audio(track.url);a.preload="metadata";a.loop=false;
  a.addEventListener("ended",()=>nextTrack());
  a.addEventListener("timeupdate",updatePlayer);
  a.addEventListener("loadedmetadata",updatePlayer);
  state.player.audio=a;state.player.playing=true;a.play().catch(()=>{state.player.playing=false;toast("Нажмите ▶ для запуска аудио")});
  updatePlayer();
}
function nextTrack(){const p=state.player;if(!p.tracks.length)return;p.index=(p.index+1)%p.tracks.length;playTracks(p.tracks,p.index)}
function prevTrack(){const p=state.player;if(!p.tracks.length)return;if(p.audio&&p.audio.currentTime>4){p.audio.currentTime=0;return}p.index=(p.index-1+p.tracks.length)%p.tracks.length;playTracks(p.tracks,p.index)}
function updatePlayer(){const p=state.player,el=document.getElementById("player");if(!p.tracks.length){el.classList.add("hidden");return}el.classList.remove("hidden");const t=p.tracks[p.index]||{};document.getElementById("playerTitle").textContent=t.name||"Нет трека";document.getElementById("playerArtist").textContent=t.artist||"—";document.getElementById("playPause").textContent=p.playing?"⏸":"▶";const a=p.audio,d=a?.duration||0,c=a?.currentTime||0;document.querySelector("#playerProgress i").style.width=d?`${c/d*100}%`:"0%";document.getElementById("playerTime").textContent=`${fmtTime(c)} / ${fmtTime(d)}`}
function fmtTime(s){if(!Number.isFinite(s))return"0:00";return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,"0")}`}
