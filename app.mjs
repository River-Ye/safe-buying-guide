import { assess } from './eligibility.mjs';

const $ = selector => document.querySelector(selector);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const money = amount => `NT$ ${new Intl.NumberFormat('zh-TW').format(amount)}`;
const size = dimensions => [dimensions.width, dimensions.depth, dimensions.height].map(value => Number.isFinite(value) ? value : '?').join(' × ');
const statusLabel = status => status === 'recommended' ? '確認符合' : '待確認';
const badge = status => `<span class="badge ${status}"><span class="status-dot" aria-hidden="true"></span>${statusLabel(status)}</span>`;

function externalLink(url, label, className = '') {
  if (new URL(url).protocol !== 'https:') throw new Error('來源必須使用 HTTPS');
  return `<a href="${escapeHtml(url)}" class="${className}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}<span class="sr-only">（在新分頁開啟）</span></a>`;
}

function proofLinks(product, ids = []) {
  return ids.map(id => product.sources.find(source => source.id === id)).filter(Boolean)
    .map(source => externalLink(source.url, source.shortLabel ?? source.label)).join(' ');
}

function productCard(product, index) {
  const { status, checks } = assess(product);
  const fitCaption = checks.find(check => check.key === 'fit').value === true ? '含突出物與必要餘量已核對' : '最大外廓待確認';
  const decisionHeading = status === 'recommended' ? '為什麼符合你的條件？' : '為什麼還不能直接推薦？';
  const decisionNote = status === 'recommended' ? '本次查核的硬性條件皆有對應證據；請依實際購買通路確認售價、交期與保固。' : product.pendingSummary;
  const checkItems = checks.map(check => {
    const proof = check.key === 'fit' ? { note: product.fitNote, sources: [product.dimensions.source] }
      : check.key === 'reviews' ? { note: product.review.note, sources: [] } : product.requirements[check.key];
    const label = check.key === 'reviews' ? product.review.status === 'limited' ? '已查核／樣本有限' : '已查核' : check.value === true ? '已確認' : '待確認';
    return `<li><div class="check-line"><span class="check-label">${escapeHtml(check.label)}</span><span class="check-value ${check.value === true ? 'verified' : 'pending'}">${label}</span></div><p class="check-note">${escapeHtml(proof.note)}</p><div class="proof-links">${proofLinks(product, proof.sources)}</div></li>`;
  }).join('');
  return `<article class="product-card" id="product-${escapeHtml(product.id)}" aria-labelledby="title-${escapeHtml(product.id)}">
    <header><div class="product-topline"><span class="product-number">${status === 'recommended' ? 'VERIFIED' : 'CANDIDATE'} / ${String(index + 1).padStart(2, '0')}</span>${badge(status)}</div><p class="product-brand">${escapeHtml(product.brand)}</p><h3 id="title-${escapeHtml(product.id)}">${escapeHtml(product.model)}</h3><p class="product-summary">${escapeHtml(product.summary)}</p></header>
    <div class="card-content"><dl class="product-facts"><div><dt>標示外部尺寸（寬 × 深 × 高）</dt><dd>${size(product.dimensions)}<small>cm · ${fitCaption}</small></dd></div><div><dt>重量 / 內部收納</dt><dd>${escapeHtml(product.weightLabel ?? `${product.weightKg} kg`)}<small>${escapeHtml(product.storage)}</small></dd></div><div><dt>${escapeHtml(product.price.label)}</dt><dd class="fact-price">${money(product.price.amount)}<small>運送等費用另列</small></dd></div><div><dt>此購買通路的保固</dt><dd>${escapeHtml(product.warrantyLabel)}<small>${escapeHtml(product.warrantyNote)}</small></dd></div></dl>
    <div class="gap-box"><strong>${decisionHeading}</strong><p>${escapeHtml(decisionNote)}</p></div>
    <p class="stock-note"><strong>庫存：</strong>${escapeHtml(product.price.stock)}<br><strong>運送：</strong>${escapeHtml(product.price.shipping)}</p>
    <div class="product-action">${externalLink(product.purchaseUrl, '查看購買／商品頁 ↗', 'button purchase-link')}<a href="#diagram-select" data-diagram="${escapeHtml(product.id)}">在尺寸圖中比較 ↑</a></div>
    <details class="evidence-details"><summary>逐項查核、負評搜尋與資料來源</summary><ul class="check-list">${checkItems}</ul>
      <p class="review-note"><strong>評價資料有限</strong><br>${escapeHtml(product.review.limitations)}</p>
      <details class="review-scope"><summary>查看本次搜尋範圍與關鍵字</summary><ul>${product.review.coverage.map(note => `<li>${escapeHtml(note)}</li>`).join('')}</ul><p>${product.review.queries.map(query => `<code>${escapeHtml(query)}</code>`).join('<br>')}</p></details>
      <strong class="check-label">來源與對應證據</strong><ul class="source-list">${product.sources.map(source => `<li>${externalLink(source.url, `${source.label} ↗`)}<p>${escapeHtml(source.note)}</p></li>`).join('')}</ul>
    </details></div></article>`;
}

function comparisonRow(product) {
  const { status, checks } = assess(product);
  const fitCaption = checks.find(check => check.key === 'fit').value === true ? '含突出物／必要餘量已核對' : '含突出物／必要餘量待確認';
  return `<tr><td><small>${escapeHtml(product.brand)}</small><strong>${escapeHtml(product.model)}</strong></td><td>${size(product.dimensions)}<small>${fitCaption}</small></td><td>${escapeHtml(product.weightLabel ?? `${product.weightKg} kg`)}<small>${escapeHtml(product.storage)}</small></td><td class="price-cell">${money(product.price.amount)}<small>${escapeHtml(product.price.label)}</small></td><td>${badge(status)}<small>${escapeHtml(product.shortGap)}</small></td><td>${externalLink(product.purchaseUrl, '查看商品 ↗', 'table-link purchase-link')}<small>${escapeHtml(product.price.shortStock)}</small></td></tr>`;
}

function updateDiagram(product) {
  const { width, depth, height } = product.dimensions;
  const fitNote = assess(product).checks.find(check => check.key === 'fit').value === true ? '已依來源核對最大外廓與必要餘量，開門路徑仍需現場確認。' : '最大外廓及安裝餘量未確認，不能據此保證可安裝。';
  const scale = 4.2;
  const boxWidth = width * scale;
  const boxHeight = height * scale;
  const front = $('#safe-front');
  front.setAttribute('transform', `translate(${33 + (252 - boxWidth) / 2} ${259 - boxHeight})`);
  $('#front-body').setAttribute('width', boxWidth);
  $('#front-body').setAttribute('height', boxHeight);
  $('#front-door').setAttribute('width', boxWidth - 16);
  $('#front-door').setAttribute('height', boxHeight - 16);
  $('#safe-lock').setAttribute('transform', `translate(${boxWidth * .64} ${boxHeight * .46})`);
  const side = $('#safe-side');
  side.setAttribute('width', depth * scale);
  side.setAttribute('height', boxHeight);
  side.setAttribute('x', 316 + (189 - depth * scale) / 2);
  side.setAttribute('y', 259 - boxHeight);
  $('#diagram-size').textContent = `${product.brand} ${product.model}｜${size(product.dimensions)} cm（標示箱體）`;
  $('#diagram-desc').textContent = `${product.brand} ${product.model} 標示寬${width}、深${depth}、高${height}公分，相對櫃內寬60、深45、高45公分。${fitNote}`;
}

async function loadCatalog() {
  const status = $('#load-status');
  try {
    const response = await fetch('./products.json');
    if (!response.ok) throw new Error('商品資料載入失敗');
    const catalog = await response.json();
    const products = catalog.products.filter(product => assess(product).status !== 'excluded');
    const recommended = products.filter(product => assess(product).status === 'recommended');
    const pending = products.filter(product => assess(product).status === 'pending');
    $('#checked-at').textContent = catalog.checkedAt;
    $('#checked-at').dateTime = catalog.checkedAt;
    $('#recommended-count').textContent = recommended.length;
    $('#pending-count').textContent = pending.length;
    $('#pending-summary-count').textContent = `（${pending.length} 款）`;
    $('#comparison-body').innerHTML = products.map(comparisonRow).join('');
    $('#recommendation-content').innerHTML = recommended.length
      ? `<div class="product-grid recommended-grid">${recommended.map(productCard).join('')}</div>`
      : '<div class="empty-state"><span class="empty-icon" aria-hidden="true">⌕</span><div><h3>目前沒有全部查證通過的推薦款。</h3><p>本次查核的候選仍缺少「型號確定無 Wi-Fi」、最大外廓或部分開鎖規格的證據，因此暫不列入正式推薦。下方保留可追查的候選與缺口，作為後續確認的起點。</p><a href="#candidates" id="open-pending">查看待確認候選與缺口 ↓</a></div></div>';
    $('#pending-products').innerHTML = pending.map(productCard).join('');
    const select = $('#diagram-select');
    select.replaceChildren(...products.map(product => new Option(`${product.brand} ${product.model}`, product.id)));
    select.disabled = products.length === 0;
    const showSelected = () => updateDiagram(products.find(product => product.id === select.value));
    select.onchange = showSelected;
    if (products.length) showSelected();
    $('#open-pending')?.addEventListener('click', () => { $('#pending-details').open = true; });
    document.querySelectorAll('[data-diagram]').forEach(link => link.addEventListener('click', () => {
      select.value = link.dataset.diagram;
      showSelected();
    }));
    status.hidden = true;
  } catch {
    status.hidden = false;
    status.className = 'error-message';
    status.setAttribute('role', 'alert');
    status.textContent = '商品資料暫時無法載入，請重試，或從頁尾查看原始資料。';
    const retry = document.createElement('button');
    retry.textContent = '重新載入';
    retry.onclick = loadCatalog;
    status.append(retry);
  }
}

loadCatalog();
