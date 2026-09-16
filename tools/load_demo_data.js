/* Reads the two demo CSVs the same way the page does, for use outside the browser. */
const fs = require('fs');
const path = require('path');

function parseCsv(text) {
  const lines = text.replace(/^﻿/, '').trim().split(/\r?\n/);
  const head = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    const row = {};
    head.forEach((h, i) => { row[h] = cells[i]; });
    return row;
  });
}

function loadDemoData(repo) {
  const orders = parseCsv(
    fs.readFileSync(path.join(repo, 'data', 'orders_demo.csv'), 'utf8')
  ).map((r) => ({
    orderNo: r['受注伝票番号'],
    saleDate: +r['売上日'],
    memberId: r['会員ID'],
    regDate: +r['会員登録日'],
    code: r['商品コード'],
    name: r['商品名称'],
    qty: +r['注文数量'],
    amount: +r['商品売価計'],
    status: r['受注ステータス']
  }));

  const products = parseCsv(
    fs.readFileSync(path.join(repo, 'data', 'products_demo.csv'), 'utf8')
  ).map((r) => ({
    code: r['商品コード'],
    name: r['商品名称'],
    nameEn: r['商品名称_EN'],
    cost: r['原価'] === undefined || r['原価'] === '' ? null : +r['原価']
  }));

  return { orders, products };
}

module.exports = { parseCsv, loadDemoData };
