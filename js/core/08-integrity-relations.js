'use strict';

/**
 * Amanda Estética v1.8.0 — Integridade relacional, estoque, sessões e financeiro.
 * Este módulo centraliza vínculos entre cliente, protocolo, pacote, atendimento,
 * estoque e lançamentos automáticos. Não renderiza páginas por conta própria.
 */

function statusIsRealized(status) {
  return normalize(status) === 'realizado';
}

function findClientLocal(id, name = '') {
  return data().clients.find(item => item.id === id)
    || data().clients.find(item => normalize(item.name) === normalize(name));
}

function findProtocolLocal(id, name = '') {
  return data().protocols.find(item => item.id === id)
    || data().protocols.find(item => normalize(item.name) === normalize(name));
}

function findProductLocal(id, name = '') {
  return data().products.find(item => item.id === id)
    || data().products.find(item => normalize(item.name) === normalize(name));
}

function findDisposableLocal(id, name = '') {
  return data().disposables.find(item => item.id === id)
    || data().disposables.find(item => normalize(item.name) === normalize(name));
}

function linkedProtocolProducts(protocol) {
  if (!protocol || !Array.isArray(protocol.products)) return [];
  return protocol.products.map(link => {
    const product = findProductLocal(link.productId, link.productName);
    const qty = Math.max(0, num(link.qty));
    const unitCost = product ? num(product.unitCost) : num(link.unitCost);
    return {
      productId: product?.id || link.productId || '',
      productName: product?.name || link.productName || '',
      unit: product?.unit || link.unit || '',
      qty,
      unitCost,
      cost: num(link.cost) || (qty * unitCost),
      linked: !!product
    };
  }).filter(link => link.productName);
}

function linkedProtocolDisposables(protocol) {
  if (!protocol || !Array.isArray(protocol.disposables)) return [];
  return protocol.disposables.map(link => {
    const disposable = findDisposableLocal(link.disposableId, link.disposableName);
    const qty = Math.max(0, num(link.qty));
    const unitCost = disposable ? num(disposable.unitCost) : num(link.unitCost);
    return {
      disposableId: disposable?.id || link.disposableId || '',
      disposableName: disposable?.name || link.disposableName || '',
      unit: disposable?.unit || link.unit || '',
      qty,
      unitCost,
      cost: num(link.cost) || (qty * unitCost),
      linked: !!disposable
    };
  }).filter(link => link.disposableName);
}

function packageRealizedAttendances(packageId) {
  return data().attendances
    .filter(att => att.packageId === packageId && statusIsRealized(att.status))
    .sort((a,b) => String(a.date || '').localeCompare(String(b.date || '')));
}

function recalculatePackage(packageIdOrObject, realizedOverride = null) {
  const pkg = typeof packageIdOrObject === 'object'
    ? packageIdOrObject
    : data().packages.find(item => item.id === packageIdOrObject);
  if (!pkg) return null;
  const realized = Array.isArray(realizedOverride) ? realizedOverride : packageRealizedAttendances(pkg.id);
  pkg.sessionsPurchased = Math.max(1, num(pkg.sessionsPurchased));
  const legacyBaselineRaw = pkg.sessionsBaseline !== undefined
    ? Math.max(0, num(pkg.sessionsBaseline))
    : Math.max(0, num(pkg.sessionsDone) - realized.length);
  const legacyBaseline = Math.min(pkg.sessionsPurchased, legacyBaselineRaw);
  pkg.sessionsBaseline = legacyBaseline;
  pkg.sessionsDone = Math.min(pkg.sessionsPurchased, legacyBaseline + realized.length);
  pkg.valuePerSession = num(pkg.packageValue) / pkg.sessionsPurchased;
  if (realized.length) {
    pkg.lastSession = realized[realized.length - 1].date || pkg.lastSession || '';
    const latestReturn = realized.map(item => item.nextReturn).filter(Boolean).sort().pop();
    if (latestReturn) pkg.nextReturn = latestReturn;
  }
  if (normalize(pkg.status) !== 'cancelado') {
    pkg.status = pkg.sessionsDone >= pkg.sessionsPurchased
      ? 'Concluído'
      : pkg.sessionsDone > 0 ? 'Em andamento' : 'Não iniciado';
  }
  return pkg;
}

function reconcileAllPackages() {
  const realizedByPackage=new Map();
  data().attendances.forEach(att=>{
    if(!att.packageId||!statusIsRealized(att.status))return;
    if(!realizedByPackage.has(att.packageId))realizedByPackage.set(att.packageId,[]);
    realizedByPackage.get(att.packageId).push(att);
  });
  realizedByPackage.forEach(list=>list.sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))));
  data().packages.forEach(pkg=>recalculatePackage(pkg,realizedByPackage.get(pkg.id)||[]));
}

function inventoryTotals(movements = []) {
  const totals = new Map();
  movements.forEach(move => {
    if (!move?.productId || num(move.qty) <= 0) return;
    totals.set(move.productId, (totals.get(move.productId) || 0) + num(move.qty));
  });
  return totals;
}

function attendanceInventoryPlan(attendance) {
  if (!attendance || !statusIsRealized(attendance.status)) return [];
  const protocol = findProtocolLocal(attendance.protocolId, attendance.protocolName);
  return linkedProtocolProducts(protocol)
    .filter(link => link.linked && link.qty > 0)
    .map(link => ({
      productId: link.productId,
      productName: link.productName,
      unit: link.unit,
      qty: link.qty,
      unitCost: link.unitCost,
      cost: link.cost
    }));
}

function attendanceDisposablesPlan(attendance) {
  if (!attendance || !statusIsRealized(attendance.status)) return [];
  const protocol = findProtocolLocal(attendance.protocolId, attendance.protocolName);
  return linkedProtocolDisposables(protocol)
    .filter(link => link.linked && link.qty > 0)
    .map(link => ({
      disposableId: link.disposableId,
      disposableName: link.disposableName,
      unit: link.unit,
      qty: link.qty,
      unitCost: link.unitCost,
      cost: link.cost
    }));
}

/* V1.17.0 — mesma mecânica de sempre (restaura o movimento anterior, calcula
   o novo plano, confere se sobra saldo em ambos antes de mexer em qualquer
   estoque) só que agora cobrindo produtos e descartáveis juntos, sem
   descontar duas vezes pelo mesmo atendimento. */
function applyAttendanceInventory(previous, next) {
  const restore = inventoryTotals(previous?.inventoryMovements || []);
  const planned = attendanceInventoryPlan(next);
  const deduct = inventoryTotals(planned);
  const restoreDisposables = inventoryTotals((previous?.disposableMovements || []).map(m => ({ productId: m.disposableId, qty: m.qty })));
  const plannedDisposables = attendanceDisposablesPlan(next);
  const deductDisposables = inventoryTotals(plannedDisposables.map(m => ({ productId: m.disposableId, qty: m.qty })));

  const ids = new Set([...restore.keys(), ...deduct.keys()]);
  const projections = [];
  ids.forEach(productId => {
    const product = data().products.find(item => item.id === productId);
    if (!product) return;
    const projected = num(product.stock) + (restore.get(productId) || 0) - (deduct.get(productId) || 0);
    projections.push({ product, projected });
  });

  const disposableIds = new Set([...restoreDisposables.keys(), ...deductDisposables.keys()]);
  const disposableProjections = [];
  disposableIds.forEach(disposableId => {
    const disposable = data().disposables.find(item => item.id === disposableId);
    if (!disposable) return;
    const projected = num(disposable.stock) + (restoreDisposables.get(disposableId) || 0) - (deductDisposables.get(disposableId) || 0);
    disposableProjections.push({ disposable, projected });
  });

  const shortage = projections.find(item => item.projected < -0.000001);
  if (shortage) {
    throw new Error(`Estoque insuficiente de ${shortage.product.name}. Disponível: ${num(shortage.product.stock)} ${shortage.product.unit || ''}.`);
  }
  const disposableShortage = disposableProjections.find(item => item.projected < -0.000001);
  if (disposableShortage) {
    throw new Error(`Estoque insuficiente de ${disposableShortage.disposable.name}. Disponível: ${num(disposableShortage.disposable.stock)} ${disposableShortage.disposable.unit || ''}.`);
  }

  projections.forEach(item => { item.product.stock = Math.max(0, item.projected); });
  disposableProjections.forEach(item => { item.disposable.stock = Math.max(0, item.projected); });

  next.inventoryMovements = planned;
  next.inventoryCost = planned.reduce((sum, move) => sum + num(move.cost), 0);
  next.disposableMovements = plannedDisposables;
  next.disposableInventoryCost = plannedDisposables.reduce((sum, move) => sum + num(move.cost), 0);
  return { planned, plannedDisposables };
}

function restoreAttendanceInventory(attendance) {
  (attendance?.inventoryMovements || []).forEach(move => {
    const product = data().products.find(item => item.id === move.productId);
    if (product) product.stock = num(product.stock) + num(move.qty);
  });
  (attendance?.disposableMovements || []).forEach(move => {
    const disposable = data().disposables.find(item => item.id === move.disposableId);
    if (disposable) disposable.stock = num(disposable.stock) + num(move.qty);
  });
}

/* Gera um ID fixo e permanente para um lançamento automático, ancorado na
   entidade de origem (atendimento ou pacote). Diferente de uid('FN') — que
   sorteia um valor novo a cada chamada — este ID é sempre o mesmo para o
   mesmo atendimento/pacote, mesmo que o lançamento seja removido e
   regerado (ex.: status desfeito e refeito). Isso é o que garante que a
   integração com o Borion nunca veja o "mesmo" lançamento como um
   registro novo, evitando duplicidade lá do outro lado. */
function anchoredFinanceId(kind, ...parts) {
  return `FN-${kind}-${parts.map(p => String(p)).join('-')}`;
}

function upsertAutoFinance(match, payload, anchorId) {
  const d = data();
  const matches = d.finance.filter(match);
  let entry = matches[0];
  if (!entry) {
    entry = { id: anchorId || uid('FN') };
    d.finance.push(entry);
  }
  const next={...payload,sourceLocked:true};
  const changed=Object.entries(next).some(([key,value])=>entry[key]!==value);
  if(changed)Object.assign(entry,next,{updatedAt:nowIso()});
  matches.slice(1).forEach(extra => {
    d.finance = d.finance.filter(item => item.id !== extra.id);
  });
  return entry;
}

function removeAutoFinance(match) {
  data().finance = data().finance.filter(item => !match(item));
}

function syncFinanceForAttendance(attendance) {
  const match = item => item.attendanceId === attendance.id && normalize(item.origin) === 'atendimento';
  const valid = statusIsRealized(attendance.status) && num(attendance.chargedValue) > 0;
  if (!valid) {
    removeAutoFinance(match);
    return null;
  }
  return upsertAutoFinance(match, {
    attendanceId: attendance.id,
    packageId: attendance.packageId || '',
    date: attendance.date,
    type: 'income',
    category: 'Atendimento',
    description: attendance.protocolName || 'Atendimento',
    clientId: attendance.clientId,
    clientName: attendance.clientName,
    protocolId: attendance.protocolId,
    protocolName: attendance.protocolName,
    paymentMethod: attendance.paymentMethod || '',
    value: num(attendance.chargedValue),
    status: attendance.paid ? 'Pago' : 'Pendente',
    costCenter: 'Atendimento',
    origin: 'Atendimento',
    notes: 'Gerado automaticamente pelo atendimento.'
  }, anchoredFinanceId('ATT', attendance.id));
}

function syncFinanceForPackage(pkg) {
  if (!pkg) return;
  const alreadyManaged = data().finance.some(item => item.packageId === pkg.id && item.packageFinanceKind);
  if (pkg.financeManaged !== true && !alreadyManaged) return;
  const canceled = normalize(pkg.status) === 'cancelado';
  const received = Math.max(0, num(pkg.receivedValue));
  const total = Math.max(0, num(pkg.packageValue));
  const pending = canceled ? 0 : Math.max(0, total - received);
  const paidMatch = item => item.packageId === pkg.id && item.packageFinanceKind === 'received';
  const pendingMatch = item => item.packageId === pkg.id && item.packageFinanceKind === 'pending';
  if (received > 0) {
    upsertAutoFinance(paidMatch, {
      packageId: pkg.id,
      packageFinanceKind: 'received',
      date: pkg.startDate || todayIso(),
      type: 'income',
      category: 'Pacote',
      description: `${pkg.protocolName || 'Pacote'} · valor recebido`,
      clientId: pkg.clientId,
      clientName: pkg.clientName,
      protocolId: pkg.protocolId,
      protocolName: pkg.protocolName,
      paymentMethod: pkg.paymentMethod || 'A definir',
      value: received,
      status: 'Pago',
      costCenter: 'Pacotes',
      origin: 'Pacote',
      notes: 'Gerado automaticamente pelo pacote.'
    }, anchoredFinanceId('PKG', pkg.id, 'RECEIVED'));
  } else removeAutoFinance(paidMatch);
  if (pending > 0) {
    upsertAutoFinance(pendingMatch, {
      packageId: pkg.id,
      packageFinanceKind: 'pending',
      date: pkg.startDate || todayIso(),
      type: 'income',
      category: 'Pacote',
      description: `${pkg.protocolName || 'Pacote'} · saldo a receber`,
      clientId: pkg.clientId,
      clientName: pkg.clientName,
      protocolId: pkg.protocolId,
      protocolName: pkg.protocolName,
      paymentMethod: 'A definir',
      value: pending,
      status: 'Pendente',
      costCenter: 'Pacotes',
      origin: 'Pacote',
      notes: 'Gerado automaticamente pelo saldo do pacote.'
    }, anchoredFinanceId('PKG', pkg.id, 'PENDING'));
  } else removeAutoFinance(pendingMatch);
}

function syncAllAutoFinance() {
  const d=data();
  const attendanceExisting=new Map();
  const packageExisting=new Map();
  const manual=[];
  d.finance.forEach(entry=>{
    if(entry.attendanceId&&normalize(entry.origin)==='atendimento'){
      if(!attendanceExisting.has(entry.attendanceId))attendanceExisting.set(entry.attendanceId,entry);
      return;
    }
    if(entry.packageId&&entry.packageFinanceKind){
      const key=`${entry.packageId}:${entry.packageFinanceKind}`;
      if(!packageExisting.has(key))packageExisting.set(key,entry);
      return;
    }
    manual.push(entry);
  });
  const generated=[];
  const materialize=(existing,payload,anchorId)=>{
    const entry=existing||{id:anchorId||uid('FN')};
    const next={...payload,sourceLocked:true};
    const changed=Object.entries(next).some(([key,value])=>entry[key]!==value);
    if(changed)Object.assign(entry,next,{updatedAt:nowIso()});
    generated.push(entry);
  };
  d.attendances.forEach(attendance=>{
    if(!statusIsRealized(attendance.status)||num(attendance.chargedValue)<=0)return;
    materialize(attendanceExisting.get(attendance.id),{
      attendanceId:attendance.id,packageId:attendance.packageId||'',date:attendance.date,type:'income',category:'Atendimento',
      description:attendance.protocolName||'Atendimento',clientId:attendance.clientId,clientName:attendance.clientName,
      protocolId:attendance.protocolId,protocolName:attendance.protocolName,paymentMethod:attendance.paymentMethod||'',
      value:num(attendance.chargedValue),status:attendance.paid?'Pago':'Pendente',costCenter:'Atendimento',origin:'Atendimento',
      notes:'Gerado automaticamente pelo atendimento.'
    }, anchoredFinanceId('ATT', attendance.id));
  });
  d.packages.forEach(pkg=>{
    const hasExisting=packageExisting.has(`${pkg.id}:received`)||packageExisting.has(`${pkg.id}:pending`);
    if(pkg.financeManaged!==true&&!hasExisting)return;
    const canceled=normalize(pkg.status)==='cancelado';
    const received=Math.max(0,num(pkg.receivedValue));
    const total=Math.max(0,num(pkg.packageValue));
    const pending=canceled?0:Math.max(0,total-received);
    if(received>0)materialize(packageExisting.get(`${pkg.id}:received`),{
      packageId:pkg.id,packageFinanceKind:'received',date:pkg.startDate||todayIso(),type:'income',category:'Pacote',
      description:`${pkg.protocolName||'Pacote'} · valor recebido`,clientId:pkg.clientId,clientName:pkg.clientName,
      protocolId:pkg.protocolId,protocolName:pkg.protocolName,paymentMethod:pkg.paymentMethod||'A definir',value:received,
      status:'Pago',costCenter:'Pacotes',origin:'Pacote',notes:'Gerado automaticamente pelo pacote.'
    }, anchoredFinanceId('PKG', pkg.id, 'RECEIVED'));
    if(pending>0)materialize(packageExisting.get(`${pkg.id}:pending`),{
      packageId:pkg.id,packageFinanceKind:'pending',date:pkg.startDate||todayIso(),type:'income',category:'Pacote',
      description:`${pkg.protocolName||'Pacote'} · saldo a receber`,clientId:pkg.clientId,clientName:pkg.clientName,
      protocolId:pkg.protocolId,protocolName:pkg.protocolName,paymentMethod:'A definir',value:pending,
      status:'Pendente',costCenter:'Pacotes',origin:'Pacote',notes:'Gerado automaticamente pelo saldo do pacote.'
    }, anchoredFinanceId('PKG', pkg.id, 'PENDING'));
  });
  d.finance=[...manual,...generated];
}

function syncClientReferences(client, previousId = '') {
  const oldId = previousId || client.id;
  ['appointments','packages','attendances','anamneses','consents','photos','finance'].forEach(key => {
    data()[key].forEach(record => {
      if (record.clientId === oldId || (!record.clientId && normalize(record.clientName) === normalize(client.name))) {
        record.clientId = client.id;
        record.clientName = client.name;
        if ('phone' in record || key !== 'finance') record.phone = client.phone || record.phone || '';
      }
    });
  });
}

function syncProtocolReferences(protocol, previousId = '') {
  const oldId = previousId || protocol.id;
  ['appointments','packages','attendances','consents','photos','finance'].forEach(key => {
    data()[key].forEach(record => {
      if (record.protocolId === oldId || (!record.protocolId && normalize(record.protocolName) === normalize(protocol.name))) {
        record.protocolId = protocol.id;
        record.protocolName = protocol.name;
      }
    });
  });
}

function syncProductReferences(product, previousId = '') {
  const oldId = previousId || product.id;
  data().protocols.forEach(protocol => {
    (protocol.products || []).forEach(link => {
      if (link.productId === oldId || (!link.productId && normalize(link.productName) === normalize(product.name))) {
        link.productId = product.id;
        link.productName = product.name;
        link.unit = product.unit || '';
        link.unitCost = num(product.unitCost);
        if (num(link.qty) > 0) link.cost = num(link.qty) * num(product.unitCost);
      }
    });
  });
  data().attendances.forEach(att => {
    (att.inventoryMovements || []).forEach(move => {
      if (move.productId === oldId) {
        move.productId = product.id;
        move.productName = product.name;
        move.unit = product.unit || move.unit || '';
      }
    });
  });
}

function syncDisposableReferences(disposable, previousId = '') {
  const oldId = previousId || disposable.id;
  data().protocols.forEach(protocol => {
    (protocol.disposables || []).forEach(link => {
      if (link.disposableId === oldId || (!link.disposableId && normalize(link.disposableName) === normalize(disposable.name))) {
        link.disposableId = disposable.id;
        link.disposableName = disposable.name;
        link.unit = disposable.unit || '';
        link.unitCost = num(disposable.unitCost);
        if (num(link.qty) > 0) link.cost = num(link.qty) * num(disposable.unitCost);
      }
    });
  });
  data().attendances.forEach(att => {
    (att.disposableMovements || []).forEach(move => {
      if (move.disposableId === oldId) {
        move.disposableId = disposable.id;
        move.disposableName = disposable.name;
        move.unit = disposable.unit || move.unit || '';
      }
    });
  });
}

function collectIntegrityReport({ repair = false } = {}) {
  const d = data();
  const clientById=new Map(d.clients.map(item=>[item.id,item]));
  const clientByName=new Map(d.clients.map(item=>[normalize(item.name),item]));
  const protocolById=new Map(d.protocols.map(item=>[item.id,item]));
  const protocolByName=new Map(d.protocols.map(item=>[normalize(item.name),item]));
  const productById=new Map(d.products.map(item=>[item.id,item]));
  const productByName=new Map(d.products.map(item=>[normalize(item.name),item]));
  const disposableById=new Map(d.disposables.map(item=>[item.id,item]));
  const disposableByName=new Map(d.disposables.map(item=>[normalize(item.name),item]));
  const realizedByPackage=new Map();
  d.attendances.forEach(att=>{
    if(!att.packageId||!statusIsRealized(att.status))return;
    if(!realizedByPackage.has(att.packageId))realizedByPackage.set(att.packageId,[]);
    realizedByPackage.get(att.packageId).push(att);
  });
  realizedByPackage.forEach(list=>list.sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))));
  const report = {
    repaired: 0,
    orphanClients: 0,
    orphanProtocols: 0,
    orphanProducts: 0,
    orphanDisposables: 0,
    negativeDisposableStocks: 0,
    zeroQtyDisposableLinks: 0,
    archivedDisposableLinks: 0,
    duplicateIds: 0,
    negativeStocks: 0,
    packagesRecalculated: 0,
    financeReconciled: 0,
    zeroQtyProductLinks: 0,
    protocolCostBelowProducts: 0,
    legacyPackagesUnmanaged: 0,
    packageOverbooked: 0,
    archivedProductLinks: 0,
    notes: []
  };
  const seen = new Set();
  Object.entries(d).forEach(([key, value]) => {
    if (!Array.isArray(value)) return;
    value.forEach(item => {
      if (!item?.id) return;
      const token = `${key}:${item.id}`;
      if (seen.has(token)) report.duplicateIds += 1;
      seen.add(token);
    });
  });

  ['appointments','packages','attendances','anamneses','consents','photos','finance'].forEach(key => {
    d[key].forEach(record => {
      if (!record.clientId && !record.clientName) return;
      const client = clientById.get(record.clientId) || clientByName.get(normalize(record.clientName));
      if (!client) { report.orphanClients += 1; return; }
      if (repair && (record.clientId !== client.id || record.clientName !== client.name || ('phone' in record && record.phone !== (client.phone || '')))) {
        record.clientId = client.id;
        record.clientName = client.name;
        if ('phone' in record) record.phone = client.phone || '';
        report.repaired += 1;
      }
    });
  });
  ['appointments','packages','attendances','consents','photos','finance'].forEach(key => {
    d[key].forEach(record => {
      if (!record.protocolId && !record.protocolName) return;
      const protocol = protocolById.get(record.protocolId) || protocolByName.get(normalize(record.protocolName));
      if (!protocol) { report.orphanProtocols += 1; return; }
      if (repair && (record.protocolId !== protocol.id || record.protocolName !== protocol.name)) {
        record.protocolId = protocol.id;
        record.protocolName = protocol.name;
        report.repaired += 1;
      }
    });
  });
  d.protocols.forEach(protocol => {
    protocol.products = Array.isArray(protocol.products) ? protocol.products : [];
    protocol.products.forEach(link => {
      const product = productById.get(link.productId) || productByName.get(normalize(link.productName));
      if (!product) { report.orphanProducts += 1; return; }
      if (product.archived) report.archivedProductLinks += 1;
      if (num(link.qty) <= 0) report.zeroQtyProductLinks += 1;
      if (repair && (link.productId !== product.id || link.productName !== product.name)) {
        link.productId = product.id;
        link.productName = product.name;
        link.unit = product.unit || '';
        link.unitCost = num(product.unitCost);
        if (num(link.qty) > 0) link.cost = num(link.qty) * num(product.unitCost);
        report.repaired += 1;
      }
    });
    protocol.disposables = Array.isArray(protocol.disposables) ? protocol.disposables : [];
    protocol.disposables.forEach(link => {
      const disposable = disposableById.get(link.disposableId) || disposableByName.get(normalize(link.disposableName));
      if (!disposable) { report.orphanDisposables += 1; return; }
      if (disposable.archived) report.archivedDisposableLinks += 1;
      if (num(link.qty) <= 0) report.zeroQtyDisposableLinks += 1;
      if (repair && (link.disposableId !== disposable.id || link.disposableName !== disposable.name)) {
        link.disposableId = disposable.id;
        link.disposableName = disposable.name;
        link.unit = disposable.unit || '';
        link.unitCost = num(disposable.unitCost);
        if (num(link.qty) > 0) link.cost = num(link.qty) * num(disposable.unitCost);
        report.repaired += 1;
      }
    });
    const linkedCost=protocol.products.reduce((sum,link)=>sum+num(link.cost),0)+protocol.disposables.reduce((sum,link)=>sum+num(link.cost),0);
    if(linkedCost>num(protocol.cost)+0.0001)report.protocolCostBelowProducts+=1;
  });
  d.products.forEach(product => {
    if (num(product.stock) < 0) {
      report.negativeStocks += 1;
      if (repair) { product.stock = 0; report.repaired += 1; }
    }
  });
  d.disposables.forEach(disposable => {
    if (num(disposable.stock) < 0) {
      report.negativeDisposableStocks += 1;
      if (repair) { disposable.stock = 0; report.repaired += 1; }
    }
  });
  d.packages.forEach(pkg => {
    if(pkg.financeManaged!==true)report.legacyPackagesUnmanaged+=1;
    const pkgRealized=realizedByPackage.get(pkg.id)||[];
    const actualUsed=Math.max(0,num(pkg.sessionsBaseline))+pkgRealized.length;
    if(actualUsed>Math.max(1,num(pkg.sessionsPurchased)))report.packageOverbooked+=1;
    const before = JSON.stringify([pkg.sessionsBaseline,pkg.sessionsDone,pkg.status,pkg.lastSession,pkg.nextReturn,pkg.valuePerSession]);
    if (repair) recalculatePackage(pkg,pkgRealized);
    const after = JSON.stringify([pkg.sessionsBaseline,pkg.sessionsDone,pkg.status,pkg.lastSession,pkg.nextReturn,pkg.valuePerSession]);
    if (before !== after) { report.packagesRecalculated += 1; report.repaired += 1; }
  });
  if (repair) {
    const before = JSON.stringify(d.finance.filter(item => item.sourceLocked || item.attendanceId || item.packageFinanceKind));
    syncAllAutoFinance();
    const after = JSON.stringify(d.finance.filter(item => item.sourceLocked || item.attendanceId || item.packageFinanceKind));
    if (before !== after) { report.financeReconciled += 1; report.repaired += 1; }
  }
  return report;
}

async function runIntegrityAudit({ repair = true, save = true } = {}) {
  const report = collectIntegrityReport({ repair });
  if (repair && save && report.repaired) {
    addAudit('Integridade da base verificada', `${report.repaired} ajuste(s) automático(s)`);
    await ClinicStorage.save(STATE);
  }
  return report;
}

function integrityReportHtml(report) {
  const rows = [
    ['Ajustes automáticos', report.repaired, report.repaired ? 'success' : ''],
    ['Vínculos de cliente sem origem', report.orphanClients, report.orphanClients ? 'danger' : 'success'],
    ['Vínculos de protocolo sem origem', report.orphanProtocols, report.orphanProtocols ? 'danger' : 'success'],
    ['Produtos de protocolo sem cadastro', report.orphanProducts, report.orphanProducts ? 'danger' : 'success'],
    ['Produtos vinculados sem quantidade', report.zeroQtyProductLinks, report.zeroQtyProductLinks ? 'warn' : 'success'],
    ['Descartáveis de protocolo sem cadastro', report.orphanDisposables, report.orphanDisposables ? 'danger' : 'success'],
    ['Descartáveis vinculados sem quantidade', report.zeroQtyDisposableLinks, report.zeroQtyDisposableLinks ? 'warn' : 'success'],
    ['Protocolos ligados a descartáveis arquivados', report.archivedDisposableLinks, report.archivedDisposableLinks ? 'warn' : 'success'],
    ['Estoques de descartáveis negativos', report.negativeDisposableStocks, report.negativeDisposableStocks ? 'danger' : 'success'],
    ['Protocolos com custo menor que insumos', report.protocolCostBelowProducts, report.protocolCostBelowProducts ? 'warn' : 'success'],
    ['Pacotes antigos sem financeiro automático', report.legacyPackagesUnmanaged, report.legacyPackagesUnmanaged ? 'warn' : 'success'],
    ['Pacotes com sessões acima do contratado', report.packageOverbooked, report.packageOverbooked ? 'danger' : 'success'],
    ['Protocolos ligados a produtos arquivados', report.archivedProductLinks, report.archivedProductLinks ? 'warn' : 'success'],
    ['IDs duplicados', report.duplicateIds, report.duplicateIds ? 'danger' : 'success'],
    ['Estoques negativos', report.negativeStocks, report.negativeStocks ? 'danger' : 'success'],
    ['Pacotes recalculados', report.packagesRecalculated, ''],
    ['Financeiro automático reconciliado', report.financeReconciled, '']
  ];
  return `<div class="integrity-report">
    <div class="integrity-summary">${icon(report.orphanClients||report.orphanProtocols||report.orphanProducts||report.duplicateIds||report.packageOverbooked||report.archivedProductLinks?'warn':'check',24)}<div><strong>Verificação concluída</strong><small>Cliente, protocolo, pacote, sessão, estoque e financeiro foram conferidos.</small></div></div>
    <div class="integrity-grid">${rows.map(([label,value,tone])=>`<div class="integrity-row ${tone}"><span>${esc(label)}</span><strong>${value}</strong></div>`).join('')}</div>
    <p class="muted">Registros clínicos principais não são apagados silenciosamente. Toda exclusão exige confirmação e trata os vínculos relacionados.</p>
  </div>`;
}

async function showIntegrityReport() {
  const report = await runIntegrityAudit({ repair: true, save: true });
  openModal({ title: 'Integridade do sistema', wide: true, content: integrityReportHtml(report) });
}

function dependencyCountsForClient(id) {
  const d = data();
  return {
    appointments:d.appointments.filter(x=>x.clientId===id).length,
    packages:d.packages.filter(x=>x.clientId===id).length,
    attendances:d.attendances.filter(x=>x.clientId===id).length,
    anamneses:d.anamneses.filter(x=>x.clientId===id).length,
    consents:d.consents.filter(x=>x.clientId===id).length,
    photos:d.photos.filter(x=>x.clientId===id).length,
    finance:d.finance.filter(x=>x.clientId===id).length
  };
}

function countTotal(object) {
  return Object.values(object).reduce((sum,value)=>sum+num(value),0);
}

async function deleteAppointmentRecord(id) {
  const item = data().appointments.find(x=>x.id===id);
  if (!item || !await confirmAction(`Excluir o agendamento de ${item.clientName || 'cliente'}?`)) return;
  data().appointments = data().appointments.filter(x=>x.id!==id);
  data().attendances.forEach(att=>{if(att.appointmentId===id)att.appointmentId='';});
  await persist('Agendamento excluído',{detail:`${item.clientName} · ${item.protocolName}`});
  closeModal(); renderView(); toast('Agendamento excluído.');
}

async function deleteAttendanceRecord(id) {
  const item = data().attendances.find(x=>x.id===id);
  if (!item || !await confirmAction(`Excluir este atendimento? O estoque, o pacote e o financeiro serão recalculados.`)) return;
  restoreAttendanceInventory(item);
  data().attendances = data().attendances.filter(x=>x.id!==id);
  removeAutoFinance(fin=>fin.attendanceId===id);
  if (item.packageId) recalculatePackage(item.packageId);
  if (item.appointmentId) {
    const appointment=data().appointments.find(x=>x.id===item.appointmentId);
    if(appointment)appointment.status=appointment.confirmed?'Confirmado':'Agendado';
  }
  await persist('Atendimento excluído',{detail:`${item.clientName} · ${item.protocolName}`});
  closeModal(); renderView(); toast('Atendimento excluído e vínculos recalculados.');
}

async function deletePackageRecord(id) {
  const pkg = data().packages.find(x=>x.id===id);
  if (!pkg) return;
  const sessions = data().attendances.filter(x=>x.packageId===id);
  const financeEntries = data().finance.filter(x=>x.packageId===id);
  if (sessions.length || financeEntries.length || num(pkg.receivedValue)>0) {
    if (!await confirmAction(`Este pacote possui histórico clínico ou financeiro. Para não apagar sessões e valores recebidos, ele será cancelado e preservado. O saldo pendente será encerrado. Continuar?`)) return;
    pkg.status='Cancelado';
    pkg.archived=true;
    syncFinanceForPackage(pkg);
    await persist('Pacote cancelado e preservado',{detail:`${pkg.clientName} · ${pkg.protocolName}`});
    closeModal(); renderView(); toast('Pacote cancelado; sessões e valores recebidos foram preservados.');
    return;
  }
  if (!await confirmAction('Excluir este pacote vazio?')) return;
  data().packages = data().packages.filter(x=>x.id!==id);
  await persist('Pacote excluído',{detail:`${pkg.clientName} · ${pkg.protocolName}`});
  closeModal(); renderView(); toast('Pacote excluído.');
}

async function deleteAnamnesisRecord(id) {
  const item=data().anamneses.find(x=>x.id===id);
  if(!item||!await confirmAction('Excluir definitivamente esta anamnese?'))return;
  data().anamneses=data().anamneses.filter(x=>x.id!==id);
  await persist('Anamnese excluída',{detail:item.clientName}); closeModal(); renderView(); toast('Anamnese excluída.');
}

async function deleteConsentRecord(id) {
  const item=data().consents.find(x=>x.id===id);
  if(!item||!await confirmAction('Excluir definitivamente este consentimento?'))return;
  data().consents=data().consents.filter(x=>x.id!==id);
  await persist('Consentimento excluído',{detail:`${item.clientName} · ${item.protocolName}`}); closeModal(); renderView(); toast('Consentimento excluído.');
}

async function deleteClientRecord(id) {
  const client=data().clients.find(x=>x.id===id); if(!client)return;
  const counts=dependencyCountsForClient(id),total=countTotal(counts);
  const detail=Object.entries(counts).filter(([,v])=>v).map(([k,v])=>`${v} ${k}`).join(', ');
  if(total){
    if(!await confirmAction(`${client.name} possui ${total} registro(s) vinculado(s) (${detail}). Para preservar o histórico e as fotos, ela será desativada em vez de excluída. Continuar?`))return;
    client.archived=true;
    await persist('Cliente desativada',{detail:`${client.name} · ${total} vínculo(s) preservados`}); closeModal(); renderView(); toast('Cliente desativada; histórico e fotos preservados.');
    return;
  }
  if(!await confirmAction(`Excluir a cliente ${client.name}? Ela não possui nenhum registro vinculado.`))return;
  data().clients=data().clients.filter(x=>x.id!==id);
  await persist('Cliente excluída',{detail:client.name}); closeModal(); renderView(); toast('Cliente excluída.');
}

async function deleteProtocolRecord(id) {
  const protocol=data().protocols.find(x=>x.id===id); if(!protocol)return;
  const d=data();
  const linked={
    appointments:d.appointments.filter(x=>x.protocolId===id).length,
    packages:d.packages.filter(x=>x.protocolId===id).length,
    attendances:d.attendances.filter(x=>x.protocolId===id).length,
    consents:d.consents.filter(x=>x.protocolId===id).length,
    photos:d.photos.filter(x=>x.protocolId===id).length
  };
  const total=countTotal(linked);
  if(total){
    if(!await confirmAction(`Este protocolo possui ${total} vínculo(s). Em vez de apagar o histórico, ele será arquivado e não aparecerá em novos cadastros. Continuar?`))return;
    protocol.archived=true;
    await persist('Protocolo arquivado',{detail:protocol.name}); closeModal(); renderView(); toast('Protocolo arquivado; histórico preservado.'); return;
  }
  if(!await confirmAction(`Excluir o protocolo ${protocol.name}?`))return;
  data().protocols=data().protocols.filter(x=>x.id!==id);
  await persist('Protocolo excluído',{detail:protocol.name}); closeModal(); renderView(); toast('Protocolo excluído.');
}

async function deleteProductRecord(id) {
  const product=data().products.find(x=>x.id===id); if(!product)return;
  const linkedProtocols=data().protocols.filter(p=>(p.products||[]).some(link=>link.productId===id)).length;
  const movements=data().attendances.filter(a=>(a.inventoryMovements||[]).some(move=>move.productId===id)).length;
  if(linkedProtocols||movements){
    if(!await confirmAction(`Este produto aparece em ${linkedProtocols} protocolo(s) e ${movements} histórico(s) de atendimento. Ele será arquivado para preservar o histórico. Continuar?`))return;
    product.archived=true;
    await persist('Produto arquivado',{detail:product.name}); closeModal(); renderView(); toast('Produto arquivado; histórico preservado.'); return;
  }
  if(!await confirmAction(`Excluir o produto ${product.name}?`))return;
  data().products=data().products.filter(x=>x.id!==id);
  await persist('Produto excluído',{detail:product.name}); closeModal(); renderView(); toast('Produto excluído.');
}

async function deleteDisposableRecord(id) {
  const disposable=data().disposables.find(x=>x.id===id); if(!disposable)return;
  const linkedProtocols=data().protocols.filter(p=>(p.disposables||[]).some(link=>link.disposableId===id)).length;
  const movements=data().attendances.filter(a=>(a.disposableMovements||[]).some(move=>move.disposableId===id)).length;
  if(linkedProtocols||movements){
    if(!await confirmAction(`Este descartável aparece em ${linkedProtocols} protocolo(s) e ${movements} histórico(s) de atendimento. Ele será arquivado para preservar o histórico. Continuar?`))return;
    disposable.archived=true;
    await persist('Descartável arquivado',{detail:disposable.name}); closeModal(); renderView(); toast('Descartável arquivado; histórico preservado.'); return;
  }
  if(!await confirmAction(`Excluir o descartável ${disposable.name}?`))return;
  data().disposables=data().disposables.filter(x=>x.id!==id);
  await persist('Descartável excluído',{detail:disposable.name}); closeModal(); renderView(); toast('Descartável excluído.');
}

async function toggleDisposableArchive(id) {
  const disposable=data().disposables.find(x=>x.id===id); if(!disposable)return;
  disposable.archived=!disposable.archived;
  await persist(disposable.archived?'Descartável arquivado':'Descartável reativado',{detail:disposable.name});
  renderView();toast(disposable.archived?'Descartável arquivado.':'Descartável reativado.');
}

async function toggleProtocolArchive(id) {
  const protocol=data().protocols.find(x=>x.id===id); if(!protocol)return;
  protocol.archived=!protocol.archived;
  await persist(protocol.archived?'Protocolo arquivado':'Protocolo reativado',{detail:protocol.name});
  renderView();toast(protocol.archived?'Protocolo arquivado.':'Protocolo reativado.');
}

async function toggleProductArchive(id) {
  const product=data().products.find(x=>x.id===id); if(!product)return;
  product.archived=!product.archived;
  await persist(product.archived?'Produto arquivado':'Produto reativado',{detail:product.name});
  renderView();toast(product.archived?'Produto arquivado.':'Produto reativado.');
}

async function deleteFinanceRecordSafe(id) {
  const entry=data().finance.find(x=>x.id===id); if(!entry)return;
  if(entry.sourceLocked || entry.attendanceId || entry.packageFinanceKind){
    toast('Este lançamento é automático. Edite ou exclua o atendimento/pacote de origem.','warn');
    return;
  }
  if(!await confirmAction('Excluir este lançamento financeiro?'))return;
  data().finance=data().finance.filter(x=>x.id!==id);
  await persist('Lançamento excluído',{detail:entry.description}); closeModal(); renderView(); toast('Lançamento excluído.');
}


async function deleteProfileRecord(id) {
  const profile=STATE.profiles.find(item=>item.id===id);
  if(!profile)return;
  if(STATE.profiles.length<=1){toast('O perfil principal não pode ser excluído porque é o único acesso do aplicativo.','warn');return;}
  const profileData=STATE.dataByProfile?.[id];
  const records=profileData?Object.values(profileData).filter(Array.isArray).reduce((sum,list)=>sum+list.length,0):0;
  if(!await confirmAction(`Excluir o perfil ${profile.name} e os ${records} registro(s) exclusivos dele? Um backup local será criado antes.`))return;
  await ClinicStorage.createLocalBackup(STATE,'antes-de-excluir-perfil');
  STATE.profiles=STATE.profiles.filter(item=>item.id!==id);
  if(STATE.dataByProfile)delete STATE.dataByProfile[id];
  if(STATE.activeProfileId===id)STATE.activeProfileId=STATE.profiles[0].id;
  await ClinicStorage.save(STATE);
  closeModal();renderShell();toast('Perfil excluído.');
}
