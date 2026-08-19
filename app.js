"use strict";

function render(){
  document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.page===state.page));
  if(state.page==="home")renderHome();
  if(state.page==="catalog")renderCatalog();
  if(state.page==="favorites")renderFavorites();
  if(state.page==="diary")renderDiary();
  updatePlayer();
}
function bookCard(book){
  return `<article class="book-card" data-book="${h(book.id)}">
    ${coverHTML(book)}
    <div class="book-title">${h(book.title)}</div>
    <div class="author">${h(book.author)}</div>
    <div class="rating-line">⭐ ${getBookRating(book).toFixed(1)} (${getRatingCount(book.id)} оценок)</div>
    ${book.series?`<button class="series-link" data-series="${h(book.series)}">📚 Серия: ${h(book.series)}</button>`:""}
  </article>`;
}
function bindBookClicks(root=document){root.querySelectorAll("[data-book]").forEach(el=>el.onclick=e=>{if(e.target.closest("[data-series]")||e.target.closest(".heart")||e.target.closest(".admin-btn"))return;openBook(el.dataset.book,true)});root.querySelectorAll("[data-series]").forEach(el=>el.onclick=e=>{e.stopPropagation();openSeries(el.dataset.series)})}
function renderHome(){
  const q=quoteOfDay();
  const sorted=[...state.books].sort((a,b)=>String(b.release_date).localeCompare(String(a.release_date)));
  const popular=[...state.books].sort((a,b)=>getViews(b.id)-getViews(a.id)).slice(0,3);
  const ann=state.announcements.find(a=>String(a.active).toLowerCase()!=="false")||null;
  document.getElementById("main").innerHTML=`
    <div class="welcome">Добро пожаловать в библиотеку готовых переводов MidnightBooks</div>
    <div class="quote-card"><div class="quote-text">${h(q.text)}</div><div class="quote-source">— ${h(q.source)} · цитата дня</div></div>
    <div class="action-row"><button class="btn primary" id="randomBtn">🎲 Случайная книга</button><button class="btn" id="homeChannel">Перейти в канал</button></div>
    <div class="section-title">Главная</div>
    <div class="book-grid">${sorted.map(bookCard).join("")||'<div class="empty">Книг пока нет.</div>'}</div>
    <div class="action-row"><button class="btn" id="seeAll">Смотреть все →</button></div>
    <div class="section-title">Скоро в библиотеке</div>
    ${announcementHTML(ann)}
    <div class="section-title">Популярное</div>
    <div class="book-grid">${popular.map(bookCard).join("")||'<div class="empty">Пока нет статистики.</div>'}</div>`;
  document.getElementById("randomBtn")?.addEventListener("click",()=>{if(state.books.length)openBook(state.books[Math.floor(Math.random()*state.books.length)].id,true)});
  document.getElementById("homeChannel")?.addEventListener("click",openChannel);
  document.getElementById("seeAll")?.addEventListener("click",()=>{state.page="catalog";render()});
  bindBookClicks();
}
function announcementHTML(a){
  if(!a)return `<div class="announcement"><div><strong>Новые истории уже близко.</strong><div class="teaser">Следите за обновлениями MidnightBooks.</div></div></div>`;
  const date=a.release_date?new Date(a.release_date):null;
  return `<div class="announcement">${coverHTML({cover_emoji:a.cover_emoji||"🌙",title:a.title||"Скоро"})}
    <div><div class="book-title">${h(a.title||"Скоро")}</div><div class="author">${h(a.author||"")}</div>
    <div class="teaser">${h(a.teaser||"Новая книга скоро появится в библиотеке.")}</div>
    <div class="countdown" data-countdown="${date&&!Number.isNaN(date.getTime())?date.toISOString():""}">⏳ ${date&&!Number.isNaN(date.getTime())?countdownText(date):"Следите за обновлениями"}</div></div></div>`;
}
function countdownText(date){const ms=date-new Date();if(ms<=0)return"Уже доступно";const d=Math.floor(ms/86400000),h2=Math.floor(ms%86400000/3600000),m=Math.floor(ms%3600000/60000);return `${d}д ${h2}ч ${m}м`}
setInterval(()=>document.querySelectorAll("[data-countdown]").forEach(el=>{if(el.dataset.countdown)el.textContent="⏳ "+countdownText(new Date(el.dataset.countdown))}),60000);

function filteredBooks(){
  let a=[...state.books];
  const s=state.search.trim().toLowerCase();
  if(s)a=a.filter(b=>(b.title+" "+b.author+" "+b.series).toLowerCase().includes(s));
  if(state.trope!=="all")a=a.filter(b=>arr(b.trops).map(x=>x.toLowerCase()).includes(state.trope.toLowerCase()));
  if(state.sort==="title")a.sort((x,y)=>x.title.localeCompare(y.title,"ru"));
  if(state.sort==="author")a.sort((x,y)=>x.author.localeCompare(y.author,"ru"));
  if(state.sort==="rating")a.sort((x,y)=>getBookRating(y)-getBookRating(x));
  if(state.sort==="date")a.sort((x,y)=>String(y.release_date).localeCompare(String(x.release_date)));
  return a;
}
function allTropes(){const set=new Set();state.books.forEach(b=>arr(b.trops).forEach(t=>set.add(t.trim())));return [...set].filter(Boolean).sort((a,b)=>a.localeCompare(b))}
function renderCatalog(){
  const books=filteredBooks(), tropes=allTropes();
  document.getElementById("main").innerHTML=`
    <div class="section-title">Каталог</div>
    <div class="search-wrap"><input id="catalogSearch" class="search" placeholder="${state.catalogMode==="authors"?"Поиск по автору…":"Поиск по названию или автору…"}" value="${h(state.search)}"></div>
    <div class="seg"><button class="${state.catalogMode==="books"?"active":""}" data-mode="books">📚 Все книги</button><button class="${state.catalogMode==="series"?"active":""}" data-mode="series">📚 По сериям</button><button class="${state.catalogMode==="authors"?"active":""}" data-mode="authors">✒️ По авторам</button></div>
    ${state.catalogMode==="books"?`
      <div class="catalog-tools"><div class="tags"><button class="tag ${state.trope==="all"?"active":""}" data-trope="all">Все тропы</button>${tropes.map(t=>`<button class="tag ${state.trope===t?"active":""}" data-trope="${h(t)}">${h(t)}</button>`).join("")}</div>
      <div class="sort"><select id="sort"><option value="date" ${state.sort==="date"?"selected":""}>По дате</option><option value="title" ${state.sort==="title"?"selected":""}>По названию</option><option value="author" ${state.sort==="author"?"selected":""}>По автору</option><option value="rating" ${state.sort==="rating"?"selected":""}>По рейтингу</option></select></div></div>
      <div class="book-grid catalog-book-grid" style="margin-top:12px">${books.map(bookCard).join("")||'<div class="empty">Ничего не найдено.</div>'}</div>
    `:state.catalogMode==="series"?seriesHTML():authorsHTML()}`;
  document.getElementById("catalogSearch").addEventListener("input",e=>{state.search=e.target.value;renderCatalog()});
  document.querySelectorAll("[data-mode]").forEach(b=>b.onclick=()=>{state.catalogMode=b.dataset.mode;state.seriesView=null;renderCatalog()});
  document.querySelectorAll("[data-trope]").forEach(b=>b.onclick=()=>{state.trope=b.dataset.trope;renderCatalog()});
  document.getElementById("sort")?.addEventListener("change",e=>{state.sort=e.target.value;renderCatalog()});
  bindBookClicks();
}
function horizontalBook(book){
  return `<article class="book-card horizontal-book" data-book="${h(book.id)}">${coverHTML(book)}
    <div class="h-info"><div class="book-title">${h(book.title)}</div><div class="author">${h(book.author)}</div>
    <div class="rating-line">⭐ ${getBookRating(book).toFixed(1)} (${getRatingCount(book.id)})</div>
    ${book.series?`<button class="series-link" data-series="${h(book.series)}">📚 Серия: ${h(book.series)}</button>`:""}
    <div class="h-bottom"><span style="font:10px Arial;color:var(--muted)">${h(formatDate(book.release_date))}</span><button class="heart ${isFavorite(book.id)?"active":""}" data-fav="${h(book.id)}">${isFavorite(book.id)?"♥":"♡"}</button></div></div></article>`;
}
function seriesHTML(){const groups={};state.books.forEach(b=>{if(!b.series)return;(groups[b.series]??=[]).push(b)});if(state.seriesView){const list=(groups[state.seriesView]||[]).sort((a,b)=>num(a.series_order)-num(b.series_order));return `<div class="action-row"><button class="btn" id="backSeries">← Вернуться к каталогу</button></div><div class="section-title">${h(state.seriesView)}</div><div class="series-card book-card">${list.map((b,i)=>`<div class="series-book" data-book="${h(b.id)}"><span><b>${h(b.title)}</b><br><small style="color:var(--muted)">${h(b.author)}</small></span><span class="series-order">#${h(b.series_order||i+1)}</span></div>`).join("")}</div>`}return Object.entries(groups).sort((a,b)=>a[0].localeCompare(b[0],"ru")).map(([name,list])=>`<div class="series-card book-card" data-series-card="${h(name)}"><div class="series-name">📚 ${h(name)}</div><div class="series-count">${list.length} ${plural(list.length,"книга","книги","книг")}</div><div style="margin-top:12px">${list.sort((a,b)=>num(a.series_order)-num(b.series_order)).map((b,i)=>`<div class="series-book" data-book="${h(b.id)}"><span>${h(b.title)}</span><span class="series-order">#${h(b.series_order||i+1)}</span></div>`).join("")}</div></div>`).join("")||'<div class="empty">Серий пока нет.</div>'}
function authorsHTML(){const groups={};state.books.forEach(b=>{const author=(b.author||"Неизвестный автор").trim();if(!groups[author])groups[author]=[];groups[author].push(b)});const entries=Object.entries(groups).filter(([author])=>!state.search||author.toLowerCase().includes(state.search.trim().toLowerCase())).sort((a,b)=>a[0].localeCompare(b[0],"ru"));if(!entries.length)return '<div class="empty">Авторов не найдено.</div>';return entries.map(([author,list])=>`<div class="series-card book-card author-card"><div class="series-name">✒️ ${h(author)}</div><div class="series-count">${list.length} ${plural(list.length,"книга","книги","книг")}</div><div style="margin-top:12px">${list.sort((a,b)=>String(b.release_date).localeCompare(String(a.release_date))).map(b=>`<div class="series-book" data-book="${h(b.id)}"><span><b>${h(b.title)}</b>${b.series?`<br><small style="color:var(--muted)">📚 ${h(b.series)}</small>`:""}</span><span class="series-order">⭐ ${getBookRating(b).toFixed(1)}</span></div>`).join("")}</div></div>`).join("")}
function openSeries(name){state.page="catalog";state.catalogMode="series";state.seriesView=name;render()}
function renderFavorites(){const ids=getFavoriteIds(),books=state.books.filter(b=>ids.includes(String(b.id)));document.getElementById("main").innerHTML=`<div class="section-title">Избранное</div>${books.length?`<div class="book-grid">${books.map(bookCard).join("")}</div>`:`<div class="empty">🕯️<br><br>Здесь пока ничего нет...</div>`}`;bindBookClicks()}
function renderDiary(){
  const read=state.books.filter(b=>getStatus(b.id)==="read"),reading=state.books.filter(b=>getStatus(b.id)==="reading"),planned=state.books.filter(b=>getStatus(b.id)==="planned");
  const total=state.books.length,pct=total?Math.round(read.length/total*100):0;
  document.getElementById("main").innerHTML=`<div class="section-title">Дневник</div>
    <div class="stats"><div class="stat-row"><div><strong>${read.length}</strong><span>Прочитано</span></div><div><strong>${reading.length}</strong><span>Читаю</span></div><div><strong>${planned.length}</strong><span>В планах</span></div><div><strong>${total}</strong><span>Всего</span></div></div>
    <div class="progress"><i style="width:${pct}%"></i></div><div style="font:11px Arial;color:var(--muted)">Прочитано ${read.length} из ${total} книг (${pct}%)</div></div>
    ${statusSection("Читаю сейчас",reading)}
    ${statusSection("В планах",planned)}
    ${statusSection("Прочитано",read)}`;bindBookClicks()
}
function statusSection(title,books){return `<div class="status-group"><div class="status-title">${title}</div>${books.length?books.map(horizontalBook).join(""):'<div style="font:12px Arial;color:var(--muted);padding:7px 0">Пусто</div>'}</div>`}

// =========================
// МОДАЛЬНОЕ ОКНО
// =========================
function openBook(id,count=true){const b=state.books.find(x=>String(x.id)===String(id));if(!b)return;state.currentBook=b;state.modalTab="description";showBookModal();if(count)recordView(b.id)}
function showBookModal(){const b=state.currentBook;if(!b)return;const tracks=tracksFor(b.id),file=fileFor(b.id);const quotes=Array.isArray(b.quotes)?b.quotes:arr(b.quotes);document.getElementById("modal").classList.remove("hidden");document.getElementById("modalBox").innerHTML=`<button class="close" id="closeModal">×</button><div class="modal-head">${coverHTML(b,"cover modal-cover")}<div class="modal-meta"><div class="modal-title">${h(b.title)}</div><div class="author" style="margin-top:7px">${h(b.author)}</div><div class="rating-line">⭐ ${getBookRating(b).toFixed(1)} (${getRatingCount(b.id)} оценок)</div>${b.series?`<button class="series-link" id="modalSeries">📚 Серия: ${h(b.series)}</button>`:""}</div></div><div class="modal-tabs"><button class="${state.modalTab==="description"?"active":""}" data-mtab="description">📖 Описание</button><button class="${state.modalTab==="playlist"?"active":""}" data-mtab="playlist">🎵 Плейлист</button><button class="${state.modalTab==="quotes"?"active":""}" data-mtab="quotes">💬 Цитаты</button></div><div id="modalContent">${modalContent(b,tracks,quotes)}</div><div class="modal-actions"><button class="btn primary" id="downloadBtn">📥 Скачать EPUB</button><button class="btn" id="favBtn">${isFavorite(b.id)?"♥ Убрать":"❤️ В избранное"}</button><button class="btn" id="statusBtn">📖 ${statusLabel(getStatus(b.id)||"planned")}</button></div>`;document.getElementById("closeModal").onclick=closeModal;document.querySelectorAll("[data-mtab]").forEach(x=>x.onclick=()=>{state.modalTab=x.dataset.mtab;showBookModal()});document.getElementById("modalSeries")?.addEventListener("click",()=>{closeModal();openSeries(b.series)});document.getElementById("favBtn").onclick=()=>toggleFavorite(b.id);document.getElementById("downloadBtn").onclick=()=>downloadBook(b);document.getElementById("statusBtn").onclick=()=>cycleStatus(b.id);document.querySelectorAll("[data-rate]").forEach(x=>x.onclick=()=>setUserRating(b.id,Number(x.dataset.rate)));document.querySelectorAll("[data-track]").forEach(x=>x.onclick=()=>playTracks(tracks,Number(x.dataset.track)))}
function modalContent(b,tracks,quotes){if(state.modalTab==="playlist")return tracks.length?tracks.map((t,i)=>`<div class="track ${state.player.tracks===tracks&&state.player.index===i?"active":""}" data-track="${i}"><div class="track-play">▶</div><div class="track-info"><strong>${h(t.name)}</strong><span>${h(t.artist)}</span></div></div>`).join(""):'<div class="empty">Плейлист пока не добавлен.</div>';if(state.modalTab==="quotes")return quotes.length?quotes.map(q=>`<div class="quote-item">«${h(q)}»</div>`).join(""):'<div class="empty">Цитаты пока не добавлены.</div>';const triggers=Array.isArray(b.triggers)?b.triggers:arr(b.triggers);return `<div class="annotation">${h(b.description)}</div><div class="tags" style="margin-top:13px">${(Array.isArray(b.trops)?b.trops:arr(b.trops)).map(t=>`<span class="tag">${h(t)}</span>`).join("")}</div>${triggers.length?`<ul class="trigger-list">${triggers.map(t=>`<li>🩸 ${h(t)}</li>`).join("")}</ul>`:""}<div style="margin-top:12px;color:var(--muted);font:12px Arial,sans-serif">Ваша оценка</div><div class="star-rating">${[1,2,3,4,5].map(n=>`<button class="star ${n<=getUserRating(b.id)?"active":""}" data-rate="${n}">★</button>`).join("")}</div><div style="font:11px Arial;color:var(--muted)">⭐ ${getBookRating(b).toFixed(1)} · ${getRatingCount(b.id)} оценок · ${getViews(b.id)} просмотров · ${getDownloads(b.id)} скачиваний</div>${b.series?`<div style="margin-top:14px"><b style="color:var(--silver2)">Другие книги серии</b>${state.books.filter(x=>x.series===b.series&&x.id!==b.id).sort((x,y)=>num(x.series_order)-num(y.series_order)).map(x=>`<div class="series-book" data-other-book="${h(x.id)}">${h(x.title)}</div>`).join("")||'<div style="font:12px Arial;color:var(--muted);margin-top:7px">Других книг нет.</div>'}</div>`:""}`}
function statusLabel(s){return {reading:"Читаю",planned:"В планах",read:"Прочитано"}[s]||"В планах"}
function cycleStatus(id){const seq=["planned","reading","read"],cur=getStatus(id)||"planned",next=seq[(seq.indexOf(cur)+1)%seq.length];setStatus(id,next);showBookModal()}
function closeModal(){document.getElementById("modal").classList.add("hidden");state.currentBook=null}
document.getElementById("modal").addEventListener("click",e=>{if(e.target.id==="modal")closeModal()});

// =========================
// СКАЧИВАНИЕ
// =========================
async function downloadBook(book){const f=fileFor(book.id);const source=f?.file_url??f?.fileUrl??f?.url??"";if(!source){toast("EPUB ещё не добавлен");return}const url=normalizeFileUrl(source);if(!url){toast("Некорректная ссылка EPUB");return}const filename=(String(source).match(/\/([^/?#]+?)(?:\?.*)?$/)?.[1]||`${book.title||"book"}.epub`).replace(/%20/g," ");try{const response=await fetch(url,{mode:"cors",cache:"no-store"});if(!response.ok)throw new Error("HTTP "+response.status);const blob=await response.blob();const blobUrl=URL.createObjectURL(blob);const a=document.createElement("a");a.href=blobUrl;a.download=decodeURIComponent(filename);a.style.display="none";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(blobUrl),1000);if(state.statisticsEnabled){try{await statsRequest("download",book.id);render();if(state.currentBook?.id===book.id)showBookModal()}catch{}}toast("EPUB скачивается");return}catch(e){const t=tg();try{if(t?.openLink)t.openLink(url);else window.open(url,"_blank")}catch{window.open(url,"_blank")}}}

// =========================
// TELEGRAM
// =========================
function openChannel(){const t=tg(),url="https://t.me/MidnightBooks_1";try{if(t?.openTelegramLink)t.openTelegramLink(url);else if(t?.openLink)t.openLink(url);else window.open(url,"_blank")}catch{window.open(url,"_blank")}}
function openAbout(){document.getElementById("modal").classList.remove("hidden");document.getElementById("modalBox").innerHTML=`<button class="close" id="closeModal">×</button><div class="section-title" style="margin-top:3px">О нас</div><div class="about"><p><b>MidnightBooks</b> — библиотека готовых переводов, собранная в удобном формате мини-приложения.</p><p>Здесь можно искать книги, сохранять их в избранное, отмечать прогресс чтения, ставить оценки и слушать добавленные плейлисты.</p><p style="color:var(--muted);font:12px Arial">Данные библиотеки загружаются из таблиц, а пользовательские оценки, статусы, избранное и локальная статистика сохраняются на устройстве.</p></div><div class="action-row"><button class="btn primary" id="aboutChannel">Перейти в канал</button></div>`;document.getElementById("closeModal").onclick=closeModal;document.getElementById("aboutChannel").onclick=openChannel}
document.getElementById("channelBtn").onclick=openChannel;
document.getElementById("aboutBtn").onclick=openAbout;
document.getElementById("refreshBtn").onclick=()=>fetchRemote(false);
document.querySelectorAll(".nav-btn").forEach(b=>b.onclick=()=>{state.page=b.dataset.page;state.search="";state.trope="all";state.seriesView=null;render()});

document.getElementById("playPause").onclick=()=>{const a=state.player.audio;if(!a){if(state.player.tracks.length)playTracks(state.player.tracks,state.player.index);return}if(a.paused){a.play().then(()=>{state.player.playing=true;updatePlayer()}).catch(()=>{})}else{a.pause();state.player.playing=false;updatePlayer()}};
document.getElementById("nextTrack").onclick=nextTrack;
document.getElementById("prevTrack").onclick=prevTrack;
document.getElementById("playerProgress").onclick=e=>{const a=state.player.audio;if(!a?.duration)return;const r=e.currentTarget.getBoundingClientRect();a.currentTime=((e.clientX-r.left)/r.width)*a.duration};

document.getElementById("modalBox").addEventListener("click",e=>{const other=e.target.closest("[data-other-book]");if(other){openBook(other.dataset.otherBook,true)}});

// =========================
// ИНИЦИАЛИЗАЦИЯ
// =========================
(function initTelegram(){const t=tg();if(!t)return;try{t.ready();t.expand();t.setBackgroundColor?.("#160D11");t.setHeaderColor?.("#160D11");if(t.enableClosingConfirmation)t.disableClosingConfirmation()}catch{}})();
loadData(false).then(()=>loadStats());
