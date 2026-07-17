'use strict';

/**
 * Amanda Estética v1.17.0 — Descartáveis (cadastro, estoque, custo por unidade)
 * e histórico de preços (produtos e descartáveis): tabela ordenável, gráfico
 * de evolução e indicador de aumento/redução.
 * Arquivo modular: edite somente esta área quando a mudança for específica deste módulo.
 */

function openDisposableForm(id='') {
  const existing=data().disposables.find(x=>x.id===id);
  const d=existing||{id:`D${String(data().disposables.length+1).padStart(3,'0')}`,category:'',name:'',unit:'Unidade',packageQty:0,packageCost:0,unitCost:0,stock:0,minStock:0,supplier:'',notes:'',priceHistory:[]};
  openModal({
    title:existing?'Editar descartável':'Novo descartável',
    sub:'Estoque, custo por unidade e uso deste descartável nos protocolos.',
    wide:true,
    content:`<div class="form-grid">
      ${field('Código','code',d.id,'text',{required:true})}
      ${field('Descartável','name',d.name,'text',{required:true,className:'span-2'})}
      ${selectFieldWithAdd('Categoria','category',data().settings.disposableCategories,d.category)}
      ${selectFieldWithAdd('Unidade de medida','unit',data().settings.disposableUnits,d.unit||'Unidade')}
      ${field('Valor pago','packageCost',d.packageCost,'number',{min:0,step:'0.01',help:'Valor pago pela caixa, pacote ou embalagem comprada.'})}
      ${field('Quantidade comprada','packageQty',d.packageQty,'number',{min:0,step:'0.01',help:'Quantidade total da embalagem, na unidade escolhida acima.'})}
      ${field('Custo por unidade (calculado)','unitCost',d.unitCost,'number',{readonly:true,help:'Calculado automaticamente: valor pago ÷ quantidade comprada.'})}
      ${field('Estoque atual','stock',d.stock,'number',{min:0,step:'0.01'})}
      ${field('Estoque mínimo','minStock',d.minStock,'number',{min:0,step:'0.01',help:'Usado para o alerta de "precisa repor".'})}
      ${field('Fornecedor (opcional)','supplier',d.supplier)}
      ${field('Data da compra/atualização','priceDate',d.priceDate||todayIso(),'date',{help:'Usada para organizar o histórico de preços deste descartável.'})}
      ${textarea('Observações','notes',d.notes,{rows:3,className:'span-2'})}
    </div><input type="hidden" name="originalId" value="${eattr(d.id||'')}">`,
    deleteAction:existing?'delete-disposable':'',
    deleteId:existing?.id||'',
    deleteText:'Excluir/arquivar descartável',
    submitText:'Salvar descartável',
    onSubmit:async form=>{
      const o=formObject(form),qty=num(o.packageQty),cost=num(o.packageCost);
      if(o.category==='__new__'||o.unit==='__new__')throw new Error('Termine de cadastrar a categoria/unidade nova (ou cancele) antes de salvar.');
      const unitCost=qty?cost/qty:0;
      const item={...d,id:o.code.trim(),name:o.name.trim(),category:o.category||'',unit:o.unit||'',packageQty:qty,packageCost:cost,unitCost,stock:num(o.stock),minStock:num(o.minStock),supplier:o.supplier||'',priceDate:o.priceDate||todayIso(),notes:o.notes||'',createdAt:d.createdAt||nowIso(),updatedAt:nowIso()};
      if(!item.id)throw new Error('Informe o código do descartável.');
      const duplicate=data().disposables.find(x=>x.id===item.id&&x.id!==o.originalId);
      if(duplicate)throw new Error('Já existe outro descartável com esse código.');
      applyPriceHistoryEntry(item,!!existing,o);
      const idx=data().disposables.findIndex(x=>x.id===o.originalId);
      idx>=0?data().disposables.splice(idx,1,item):data().disposables.push(item);
      syncDisposableReferences(item,o.originalId||item.id);
      await persist(existing?'Descartável editado':'Descartável criado',{detail:item.name});
      closeModal();renderView();toast('Descartável salvo.');
    }
  });
  const form=$('#app-modal-form');
  wireQuickAddSelect(form,'category','disposableCategories',{label:'categoria'});
  wireQuickAddSelect(form,'unit','disposableUnits',{sort:false,label:'unidade'});
}

/* V1.17.0 — histórico de preços: usado tanto pelo cadastro de produtos quanto
   pelo de descartáveis. Só registra uma linha nova quando valor, quantidade
   ou unidade realmente mudaram — evita duplicar histórico ao só reabrir e
   salvar o cadastro sem alterar nada. */
function applyPriceHistoryEntry(item, wasExisting, formValues) {
  if (!Array.isArray(item.priceHistory)) item.priceHistory = [];
  const chosenDate = formValues?.priceDate || todayIso();
  const last = item.priceHistory[item.priceHistory.length - 1];
  const changed = !last
    || num(last.totalValue) !== num(item.packageCost)
    || num(last.packageQuantity) !== num(item.packageQty)
    || String(last.unit || '') !== String(item.unit || '');
  if (!changed) return;
  const time = new Date().toTimeString().slice(0, 8);
  item.priceHistory.push({
    id: uid('PH'),
    date: `${chosenDate}T${time}`,
    totalValue: num(item.packageCost),
    packageQuantity: num(item.packageQty),
    unit: item.unit || '',
    unitCost: num(item.unitCost),
    supplier: item.supplier || '',
    source: wasExisting ? 'manual-update' : 'initial-registration'
  });
}

function priceHistoryChronological(history) {
  return (history || []).slice().sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
}

function priceHistoryTrendMap(history) {
  const chrono = priceHistoryChronological(history);
  const map = new Map();
  chrono.forEach((entry, i) => {
    if (i === 0) { map.set(entry.id, null); return; }
    const prev = chrono[i - 1];
    const diff = num(entry.unitCost) - num(prev.unitCost);
    const pct = num(prev.unitCost) ? (diff / num(prev.unitCost)) * 100 : 0;
    map.set(entry.id, { diff, pct, direction: diff > 0.0001 ? 'up' : diff < -0.0001 ? 'down' : 'flat' });
  });
  return map;
}

function latestPriceTrend(history) {
  const chrono = priceHistoryChronological(history);
  if (chrono.length < 2) return null;
  return priceHistoryTrendMap(history).get(chrono[chrono.length - 1].id);
}

function priceTrendBadge(history) {
  const trend = latestPriceTrend(history);
  if (!trend) return '';
  const iconName = trend.direction === 'up' ? 'trendUp' : trend.direction === 'down' ? 'trendDown' : 'trendFlat';
  const tone = trend.direction === 'up' ? 'up' : trend.direction === 'down' ? 'down' : '';
  const label = trend.direction === 'up' ? 'Aumento' : trend.direction === 'down' ? 'Redução' : 'Sem alteração desde';
  const pctText = Math.abs(trend.pct).toFixed(2).replace('.', ',');
  const title = `${label} de ${currency(Math.abs(trend.diff))} (${pctText}%) desde o registro anterior`;
  return `<span class="price-trend ${tone}" title="${eattr(title)}" aria-label="${eattr(title)}">${icon(iconName, 13)}</span>`;
}

function priceHistoryButton(kind, item) {
  return `<button type="button" class="icon-btn tiny history-icon-btn" data-action="view-price-history" data-kind="${eattr(kind)}" data-id="${eattr(item.id)}" title="Histórico de preços" aria-label="Histórico de preços de ${eattr(item.name)}">${icon('chart', 14)}</button>`;
}

function sortPriceHistory(history, key, dir) {
  const factor = dir === 'asc' ? 1 : -1;
  const valueOf = entry => {
    if (key === 'date') return String(entry.date || '');
    if (key === 'totalValue') return num(entry.totalValue);
    if (key === 'packageQuantity') return num(entry.packageQuantity);
    if (key === 'unitCost') return num(entry.unitCost);
    return '';
  };
  return history.slice().sort((a, b) => {
    const va = valueOf(a), vb = valueOf(b);
    if (va < vb) return -1 * factor;
    if (va > vb) return 1 * factor;
    return 0;
  });
}

function priceHistoryTableHtml(history, sortKey, sortDir) {
  const cols = [
    { key: 'date', label: 'Data' },
    { key: 'totalValue', label: 'Valor' },
    { key: 'packageQuantity', label: 'Quantidade' },
    { key: 'unitCost', label: 'Custo unitário' }
  ];
  const rows = sortPriceHistory(history, sortKey, sortDir);
  const trendMap = priceHistoryTrendMap(history);
  const arrow = sortDir === 'asc' ? '▲' : '▼';
  return `<div class="price-history-table-wrap"><div class="price-history-table"><table>
    <thead><tr>${cols.map(c => `<th data-ph-sort="${c.key}" class="${sortKey === c.key ? 'active-sort' : ''}">${esc(c.label)}${sortKey === c.key ? ` <span class="sort-arrow">${arrow}</span>` : ''}</th>`).join('')}</tr></thead>
    <tbody>${rows.length ? rows.map(entry => {
      const trend = trendMap.get(entry.id);
      const trendHtml = trend
        ? `<span class="price-trend inline ${trend.direction === 'up' ? 'up' : trend.direction === 'down' ? 'down' : ''}">${icon(trend.direction === 'up' ? 'trendUp' : trend.direction === 'down' ? 'trendDown' : 'trendFlat', 12)} ${trend.direction === 'flat' ? 'Igual' : `${trend.diff > 0 ? '+' : '−'}${Math.abs(trend.pct).toFixed(2).replace('.', ',')}%`}</span>`
        : '<span class="muted">—</span>';
      return `<tr>
        <td>${esc(formatDate(String(entry.date).slice(0, 10)))}</td>
        <td>${currency(entry.totalValue)}</td>
        <td>${num(entry.packageQuantity)} ${esc(entry.unit || '')}</td>
        <td>${currency(entry.unitCost)} ${trendHtml}</td>
      </tr>`;
    }).join('') : `<tr><td colspan="4" class="muted">Nenhum registro de preço ainda.</td></tr>`}</tbody>
  </table></div></div>`;
}

function priceHistoryChartSvg(history, mode = 'unitCost') {
  const points = priceHistoryChronological(history);
  if (points.length < 2) return `<p class="muted price-history-chart-empty">Ainda não há pontos suficientes para o gráfico.</p>`;
  const values = points.map(p => mode === 'totalValue' ? num(p.totalValue) : num(p.unitCost));
  const width = 640, height = 180, padX = 30, padY = 22;
  const minV = Math.min(...values), maxV = Math.max(...values);
  const span = (maxV - minV) || Math.max(1, maxV) || 1;
  const stepX = (width - padX * 2) / Math.max(1, points.length - 1);
  const coords = values.map((v, i) => {
    const x = padX + i * stepX;
    const y = padY + (height - padY * 2) * (1 - (v - minV) / span);
    return [x, y];
  });
  const pathD = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const areaD = `${pathD} L${coords[coords.length - 1][0].toFixed(1)},${(height - padY).toFixed(1)} L${coords[0][0].toFixed(1)},${(height - padY).toFixed(1)} Z`;
  const dots = coords.map(([x, y], i) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.6" class="ph-chart-dot"><title>${esc(formatDate(String(points[i].date).slice(0, 10)))} · ${mode === 'totalValue' ? currency(values[i]) : `${currency(values[i])}/${esc(points[i].unit || 'un')}`}</title></circle>`).join('');
  return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" class="price-history-chart-svg" preserveAspectRatio="none" role="img" aria-label="Evolução de preço">
    <path d="${areaD}" class="ph-chart-area"></path>
    <path d="${pathD}" class="ph-chart-line"></path>
    ${dots}
  </svg>`;
}

function openPriceHistoryModal(kind, id) {
  const list = kind === 'disposable' ? data().disposables : data().products;
  const item = list.find(x => x.id === id);
  if (!item) { toast('Item não encontrado.', 'error'); return; }
  const history = Array.isArray(item.priceHistory) ? item.priceHistory : [];
  let sortKey = 'date', sortDir = 'desc', chartMode = 'unitCost';
  openModal({
    title: 'Histórico de preços',
    sub: item.name,
    wide: true,
    cancelText: 'Fechar',
    content: `<div class="price-history-modal">
      <div class="price-history-chart-toggle" role="group" aria-label="Tipo de gráfico">
        <button type="button" class="btn ghost compact is-active" data-ph-mode="unitCost">Custo unitário</button>
        <button type="button" class="btn ghost compact" data-ph-mode="totalValue">Valor total</button>
      </div>
      <div class="price-history-chart" data-ph-chart>${priceHistoryChartSvg(history, chartMode)}</div>
      <div data-ph-table>${priceHistoryTableHtml(history, sortKey, sortDir)}</div>
    </div>`
  });
  const root = $('#app-modal-form');
  const chartBox = root?.querySelector('[data-ph-chart]');
  const tableBox = root?.querySelector('[data-ph-table]');
  const modeButtons = root ? $$('[data-ph-mode]', root) : [];
  modeButtons.forEach(btn => btn.addEventListener('click', () => {
    chartMode = btn.dataset.phMode;
    modeButtons.forEach(b => b.classList.toggle('is-active', b === btn));
    if (chartBox) chartBox.innerHTML = priceHistoryChartSvg(history, chartMode);
  }));
  tableBox?.addEventListener('click', event => {
    const th = event.target.closest('[data-ph-sort]');
    if (!th) return;
    const key = th.dataset.phSort;
    if (sortKey === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    else { sortKey = key; sortDir = 'asc'; }
    tableBox.innerHTML = priceHistoryTableHtml(history, sortKey, sortDir);
  });
}

function costBreakdownHtml(productCost, disposableCost, otherCost, total) {
  return `<div class="cost-breakdown-grid">
    <span><small>Custo de produtos</small><strong>${currency(productCost)}</strong></span>
    <span><small>Custo de descartáveis</small><strong>${currency(disposableCost)}</strong></span>
    <span><small>Outros custos</small><strong>${currency(otherCost)}</strong></span>
    <span class="cost-breakdown-total"><small>Custo total</small><strong>${currency(total)}</strong></span>
  </div>`;
}
