/*
 * xlsx.js — writes a one-sheet .xlsx, with no library.
 *
 * The seasonal analyzer downstream does not take a CSV: it reads .xlsx, finds the sheet
 * whose header row carries the seven expected columns, and takes the PRODUCT NAME FROM THE
 * SHEET NAME. So a CSV export cannot actually complete the handoff this project claims —
 * the sheet name is part of the payload.
 *
 * An .xlsx is a zip of XML parts. Everything here is stored uncompressed (method 0), which
 * is a perfectly legal zip and removes any need for a deflate implementation; the files
 * involved are a few kilobytes. That keeps the page dependency-free, which is the point.
 */
(function (global) {
  'use strict';

  /* ---------- zip ------------------------------------------------------- */

  var CRC_TABLE = (function () {
    var table = new Int32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) {
        c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      }
      table[n] = c;
    }
    return table;
  })();

  function crc32(bytes) {
    var c = -1;
    for (var i = 0; i < bytes.length; i++) {
      c = (c >>> 8) ^ CRC_TABLE[(c ^ bytes[i]) & 0xFF];
    }
    return (c ^ -1) >>> 0;
  }

  function utf8(str) {
    return new TextEncoder().encode(str);
  }

  function pushU16(out, v) {
    out.push(v & 0xFF, (v >>> 8) & 0xFF);
  }

  function pushU32(out, v) {
    out.push(v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF);
  }

  function pushBytes(out, bytes) {
    for (var i = 0; i < bytes.length; i++) out.push(bytes[i]);
  }

  /* Zip wants an MS-DOS timestamp; the analyzer never reads it. */
  function dosTime(date) {
    var time = ((date.getHours() & 31) << 11) | ((date.getMinutes() & 63) << 5) |
      ((date.getSeconds() / 2) & 31);
    var day = (((date.getFullYear() - 1980) & 127) << 9) |
      (((date.getMonth() + 1) & 15) << 5) | (date.getDate() & 31);
    return { time: time, date: day };
  }

  function zip(files) {
    var stamp = dosTime(new Date());
    var out = [];
    var central = [];
    var offset = 0;

    files.forEach(function (file) {
      var nameBytes = utf8(file.name);
      var data = utf8(file.content);
      var sum = crc32(data);
      var localStart = offset;

      var local = [];
      pushU32(local, 0x04034B50);
      pushU16(local, 20);            /* version needed */
      pushU16(local, 0x0800);        /* UTF-8 names */
      pushU16(local, 0);             /* stored, not deflated */
      pushU16(local, stamp.time);
      pushU16(local, stamp.date);
      pushU32(local, sum);
      pushU32(local, data.length);
      pushU32(local, data.length);
      pushU16(local, nameBytes.length);
      pushU16(local, 0);
      pushBytes(local, nameBytes);
      pushBytes(local, data);
      pushBytes(out, local);
      offset += local.length;

      pushU32(central, 0x02014B50);
      pushU16(central, 20);          /* version made by */
      pushU16(central, 20);
      pushU16(central, 0x0800);
      pushU16(central, 0);
      pushU16(central, stamp.time);
      pushU16(central, stamp.date);
      pushU32(central, sum);
      pushU32(central, data.length);
      pushU32(central, data.length);
      pushU16(central, nameBytes.length);
      pushU16(central, 0);           /* extra */
      pushU16(central, 0);           /* comment */
      pushU16(central, 0);           /* disk */
      pushU16(central, 0);           /* internal attrs */
      pushU32(central, 0);           /* external attrs */
      pushU32(central, localStart);
      pushBytes(central, nameBytes);
    });

    var centralStart = offset;
    pushBytes(out, central);

    pushU32(out, 0x06054B50);
    pushU16(out, 0);
    pushU16(out, 0);
    pushU16(out, files.length);
    pushU16(out, files.length);
    pushU32(out, central.length);
    pushU32(out, centralStart);
    pushU16(out, 0);

    return new Uint8Array(out);
  }

  /* ---------- the spreadsheet parts ------------------------------------- */

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /*
   * Excel forbids : \ / ? * [ ] in a sheet name and caps it at 31 characters. The analyzer
   * reads the product name off this, so it is sanitised rather than rejected.
   */
  function safeSheetName(name) {
    var cleaned = String(name).replace(/[:\\\/?*\[\]]/g, ' ').trim();
    if (!cleaned) cleaned = 'Sheet1';
    return cleaned.slice(0, 31);
  }

  function colName(i) {
    var s = '';
    i += 1;
    while (i > 0) {
      var rem = (i - 1) % 26;
      s = String.fromCharCode(65 + rem) + s;
      i = Math.floor((i - 1) / 26);
    }
    return s;
  }

  /*
   * Text cells are written inline (t="inlineStr") rather than through a shared-string
   * table — fewer parts, and every reader accepts it.
   */
  function sheetXml(rows) {
    var body = rows.map(function (cells, r) {
      var tds = cells.map(function (value, c) {
        var ref = colName(c) + (r + 1);
        if (typeof value === 'number' && isFinite(value)) {
          return '<c r="' + ref + '"><v>' + value + '</v></c>';
        }
        return '<c r="' + ref + '" t="inlineStr"><is><t xml:space="preserve">' +
          esc(value) + '</t></is></c>';
      }).join('');
      return '<row r="' + (r + 1) + '">' + tds + '</row>';
    }).join('');

    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<sheetData>' + body + '</sheetData></worksheet>';
  }

  function build(sheetName, rows) {
    var name = safeSheetName(sheetName);
    return zip([
      {
        name: '[Content_Types].xml',
        content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
          '<Default Extension="xml" ContentType="application/xml"/>' +
          '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
          '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
          '</Types>'
      },
      {
        name: '_rels/.rels',
        content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
          '</Relationships>'
      },
      {
        name: 'xl/workbook.xml',
        content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
          'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
          '<sheets><sheet name="' + esc(name) + '" sheetId="1" r:id="rId1"/></sheets>' +
          '</workbook>'
      },
      {
        name: 'xl/_rels/workbook.xml.rels',
        content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
          '</Relationships>'
      },
      { name: 'xl/worksheets/sheet1.xml', content: sheetXml(rows) }
    ]);
  }

  global.MiniXlsx = { build: build, safeSheetName: safeSheetName, zip: zip };
})(typeof window !== 'undefined' ? window : globalThis);
