"use strict";

const SHEETS = {
  books: "https://opensheet.elk.sh/1-sr4yfsUXDc4m_5jl1ugVy3XLH4refVGwV2RTSDKUg8/КНИГИ",
  playlists: "https://opensheet.elk.sh/1-sr4yfsUXDc4m_5jl1ugVy3XLH4refVGwV2RTSDKUg8/ПЛЕЙЛИСТЫ",
  files: "https://opensheet.elk.sh/1-sr4yfsUXDc4m_5jl1ugVy3XLH4refVGwV2RTSDKUg8/ФАЙЛЫ",
  covers: "https://opensheet.elk.sh/1-sr4yfsUXDc4m_5jl1ugVy3XLH4refVGwV2RTSDKUg8/ОБЛОЖКИ",
  announcements: "https://opensheet.elk.sh/1-sr4yfsUXDc4m_5jl1ugVy3XLH4refVGwV2RTSDKUg8/АНОНСЫ"
};

const CACHE_KEY = "midnightbooks_cache_v2";
const QUOTES = [
  "Некоторые тайны расцветают только в полночь.",
  "В каждой библиотеке есть книга, которую лучше не открывать.",
  "Тишина иногда говорит громче признаний.",
  "У каждой истории есть ночь, с которой всё начинается.",
  "Некоторые двери открываются только тем, кто перестал бояться."
];

const state = {
  page:"home", catalogMode:"books", search:"", sort:"date", trope:"all",
  books:[], playlists:[], files:[], covers:[], announcements:[],
  stats:{}, statisticsEnabled:false, userRatings:{},
  currentBook:null, modalTab:"description", seriesView:null,
  player:{audio:null,tracks:[],index:0,playing:false}
};

async function fetchJSON(url){if(!url)throw new Error("missing URL");const r=await fetch(url,{cache:"no-store"});if(!r.ok)throw new Error("HTTP "+r.status);return await r.json()}
function unwrap(data){if(Array.isArray(data))return data;if(data && Array.isArray(data.data))return data.data;if(data && Array.isArray(data.rows))return data.rows;if(data && Array.isArray(data.values))return data.values;if(data && typeof data==="object"){const keys=Object.keys(data);for(const k of keys)if(Array.isArray(data[k]))return data[k]}return []}

function getCoverLink(row){
  if(!row || typeof row!=="object")return "";
  const preferred=[row.cover_url,row.coverUrl,row.cover,row.url,row.image_url,row.imageUrl,row.thumbnail_url,row.thumbnailUrl,row.link,row.href,row.ссылка,row.обложка];
  for(const v of preferred){const url=normalizeCoverUrl(v);if(url)return url}
  for(const v of Object.values(row)){const url=normalizeCoverUrl(v);if(url)return url}
  return "";
}
function mergeCoversIntoBooks(){
  const coverMap=new Map();
  state.covers.forEach(c=>{const id=normalizeId(c.book_id??c.bookId??c.book??c.id);if(!id)return;const url=getCoverLink(c);if(url)coverMap.set(id,url)});
  state.books=state.books.map(book=>({...book,cover_url:coverMap.get(normalizeId(book.id))||""}));
}
function applyData(data){
  state.books=unwrap(data.books||[]).map(normalizeBook);
  state.playlists=unwrap(data.playlists||[]);
  state.files=unwrap(data.files||[]);
  state.covers=unwrap(data.covers||[]);
  state.announcements=unwrap(data.announcements||[]);
  mergeCoversIntoBooks();
}
function getCover(book){if(!book)return null;const bookId=normalizeId(book.id);if(book.cover_url)return {cover_url:book.cover_url};const row=state.covers.find(c=>normalizeId(c.book_id??c.bookId??c.book??c.id)===bookId);const url=getCoverLink(row);return url?{cover_url:url}:null}
function coverHTML(book,cls="cover"){const c=getCover(book);const imageUrl=normalizeCoverUrl(c?.cover_url||c?.thumbnail_url||"");if(imageUrl){return `<div class="${cls}"><img src="${h(imageUrl)}" alt="${h(book.title||"Обложка")}" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='';this.style.display='none';this.nextElementSibling.classList.remove('hidden')"><span class="cover-fallback cover-emoji hidden">${h(book.cover_emoji||"📖")}</span></div>`}return `<div class="${cls}"><span class="cover-emoji">${h(book.cover_emoji||"📖")}</span></div>`}
function tracksFor(bookId){return state.playlists.filter(x=>String(x.book_id??x.bookId)===String(bookId)).map(x=>({name:String(x.track_name??x.name??"Без названия"),artist:String(x.artist??"—"),url:String(x.file_url??x.url??"")}))}
function fileFor(bookId){return state.files.find(x=>String(x.book_id??x.bookId)===String(bookId))}

async function fetchRemote(silent=false){
  if(!silent)showLoading();
  const keys=["books","playlists","files","covers","announcements"];
  const results=await Promise.all(keys.map(k=>fetchJSON(SHEETS[k])));
  const data={books:unwrap(results[0]),playlists:unwrap(results[1]),files:unwrap(results[2]),covers:unwrap(results[3]),announcements:unwrap(results[4])};
  if(!data.books.length)throw new Error("empty");
  applyData(data);
  storageSet(CACHE_KEY,{books:state.books,playlists:state.playlists,files:state.files,covers:state.covers,announcements:state.announcements,updatedAt:Date.now()});
  render();if(!silent)toast("Библиотека обновлена");
}
function showLoading(){document.getElementById("main").innerHTML='<div class="loading">Загружаем библиотеку…</div>'}

async function loadData(force=false){
  const cached=storageGet(CACHE_KEY,null);
  if(force){await fetchRemote(false);await loadStats();return}
  try{await fetchRemote(true);await loadStats()}catch{
    if(cached && cached.books?.length){applyData(cached);render();toast("Показан сохранённый кэш")}
    else{state.books=[];state.playlists=[];state.files=[];state.covers=[];state.announcements=[];render();toast("В таблице КНИГИ пока нет данных")}
  }
}
