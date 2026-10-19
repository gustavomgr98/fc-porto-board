/* Exporta uma ficha da app para o modelo OFICIAL (modelo.docx), preenchendo-o
   sem alterar o layout. Depende de JSZip (jszip.min.js). Funciona offline. */
(function(){
  var W  = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  var XMLNS = "http://www.w3.org/XML/1998/namespace";

  function els(root, name){ return Array.prototype.slice.call(root.getElementsByTagNameNS(W, name)); }
  function kids(el, name){
    return Array.prototype.filter.call(el.childNodes, function(n){
      return n.nodeType === 1 && n.namespaceURI === W && n.localName === name;
    });
  }
  function ptext(p){ return els(p, "t").map(function(t){ return t.textContent; }).join(""); }
  function mk(doc, name){ return doc.createElementNS(W, "w:" + name); }

  function findP(doc, label){
    var all = els(doc, "p");
    for(var i = 0; i < all.length; i++){
      if(ptext(all[i]).trim() === label) return all[i];
    }
    return null;
  }
  function nextP(p){
    var n = p.nextSibling;
    while(n && !(n.nodeType === 1 && n.localName === "p")) n = n.nextSibling;
    return n;
  }
  function parseFrag(xml){
    var d = new DOMParser().parseFromString(
      '<root xmlns:w="' + W + '" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
      'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ' +
      'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
      'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' + xml + '</root>', "application/xml");
    return d.documentElement.firstChild;
  }
  var RPR_DEFAULT = '<w:rPr><w:rFonts w:ascii="Georgia" w:eastAsia="Georgia" w:hAnsi="Georgia" w:cs="Georgia"/>' +
                    '<w:color w:val="3A3630"/><w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr>';

  function addRuns(doc, p, text, rPr){
    String(text).split(/\r?\n/).forEach(function(ln, i){
      var r = mk(doc, "r");
      if(rPr) r.appendChild(rPr.cloneNode(true));
      if(i > 0) r.appendChild(mk(doc, "br"));
      var t = mk(doc, "t");
      t.setAttributeNS(XMLNS, "xml:space", "preserve");
      t.textContent = ln;
      r.appendChild(t);
      p.appendChild(r);
    });
  }

  // Substitui o texto de um parágrafo normal, mantendo a formatação do run existente.
  function setParaText(doc, p, text, opts){
    opts = opts || {};
    var rPr = null;
    kids(p, "r").forEach(function(r){
      if(!rPr){ var rp = kids(r, "rPr")[0]; if(rp) rPr = rp; }
    });
    if(!rPr) rPr = doc.importNode(parseFrag(RPR_DEFAULT), true);
    if(opts.bold || opts.size){
      rPr = rPr.cloneNode(true);
      if(opts.bold && !kids(rPr, "b").length){
        var b = mk(doc, "b"), bcs = mk(doc, "bCs");
        var after = kids(rPr, "rFonts")[0];
        rPr.insertBefore(bcs, after ? after.nextSibling : rPr.firstChild);
        rPr.insertBefore(b, bcs);
      }
      if(opts.size) ["sz", "szCs"].forEach(function(n){
        kids(rPr, n).forEach(function(x){ x.setAttributeNS(W, "w:val", String(opts.size)); });
      });
    }
    kids(p, "r").forEach(function(r){ p.removeChild(r); });
    if(opts.center){
      var pPr = kids(p, "pPr")[0];
      if(!pPr){ pPr = mk(doc, "pPr"); p.insertBefore(pPr, p.firstChild); }
      if(!kids(pPr, "jc").length){ var jc = mk(doc, "jc"); jc.setAttributeNS(W, "w:val", "center"); pPr.appendChild(jc); }
    }
    addRuns(doc, p, text, rPr);
  }

  // Preenche uma caixa com várias linhas pautadas (uma linha de texto por parágrafo).
  function fillBox(doc, firstP, text, opts){
    var tc = firstP.parentNode;
    var paras = kids(tc, "p");
    var lines = String(text).split(/\r?\n/).filter(function(l){ return l.trim() !== ""; });
    lines.forEach(function(ln, i){
      var p = paras[i];
      if(!p){
        var last = paras[paras.length - 1];
        p = last.cloneNode(true);
        last.parentNode.insertBefore(p, last.nextSibling);
        paras.push(p);
      }
      setParaText(doc, p, ln, opts || {bold: true, size: 20});
    });
  }

  function setLabelValue(doc, label, value){
    if(value === undefined || value === null || String(value).trim() === "") return;
    var lp = findP(doc, label);
    if(!lp) return;
    var vp = nextP(lp);
    if(vp) setParaText(doc, vp, value, {bold: true});
  }

  function setField(doc, name, text, dd, tamanho){
    if(text === undefined || text === null || String(text) === "") return;
    var ff = null;
    els(doc, "ffData").forEach(function(f){
      var n = kids(f, "name")[0];
      if(n && n.getAttributeNS(W, "val") === name) ff = f;
    });
    if(!ff) return;
    var rBegin = ff.parentNode.parentNode, p = rBegin.parentNode;
    var runs = kids(p, "r"), sep = null, end = null;
    for(var k = runs.indexOf(rBegin) + 1; k < runs.length; k++){
      var fc = kids(runs[k], "fldChar")[0];
      if(!fc) continue;
      var ty = fc.getAttributeNS(W, "fldCharType");
      if(ty === "separate" && !sep) sep = runs[k];
      else if(ty === "end"){ end = runs[k]; break; }
    }
    if(!sep || !end) return;
    var n = sep.nextSibling;
    while(n && n !== end){ var nx = n.nextSibling; p.removeChild(n); n = nx; }
    var rPr = kids(rBegin, "rPr")[0] || null;
    if(rPr && tamanho){
      rPr = rPr.cloneNode(true);
      ["sz", "szCs"].forEach(function(n){
        kids(rPr, n).forEach(function(x){ x.setAttributeNS(W, "w:val", String(tamanho)); });
      });
    }
    var tmp = mk(doc, "p");
    addRuns(doc, tmp, text, rPr);
    while(tmp.firstChild) p.insertBefore(tmp.firstChild, end);

    if(dd){
      var list = kids(ff, "ddList")[0];
      var entries = kids(list, "listEntry");
      var idx = -1;
      entries.forEach(function(e, i){ if(e.getAttributeNS(W, "val") === text) idx = i; });
      if(idx < 0){
        var ne = mk(doc, "listEntry"); ne.setAttributeNS(W, "w:val", text);
        list.appendChild(ne); idx = entries.length;
      }
      kids(list, "result").forEach(function(x){ list.removeChild(x); });
      var res = mk(doc, "result"); res.setAttributeNS(W, "w:val", String(idx));
      list.insertBefore(res, kids(list, "listEntry")[0]);
    }
  }

  function setRating(doc, label, value){
    var rows = els(doc, "tr");
    for(var i = 0; i < rows.length; i++){
      var cells = kids(rows[i], "tc");
      if(cells.length !== 6) continue;
      var txt = kids(cells[0], "p").map(ptext).join("").trim();
      if(txt === label){
        var cp = kids(cells[value], "p")[0];
        if(cp) setParaText(doc, cp, "X", {center: true});
        return;
      }
    }
  }

  function fmtData(iso){
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    return m ? (m[3] + "/" + m[2] + "/" + m[1]) : (iso || "");
  }
  function soLetras(s){ return String(s || "").normalize("NFD").replace(/[^A-Za-z]/g, "").toLowerCase(); }

  // Recorta a foto para ocupar a caixa toda (proporção wDxa:hDxa), com foco mais acima (rostos).
  function prepararFoto(dataUrl, wDxa, hDxa){
    return new Promise(function(resolve){
      if(!dataUrl){ resolve(null); return; }
      var img = new Image();
      img.onload = function(){
        var alvo = wDxa / hDxa, iw = img.naturalWidth, ih = img.naturalHeight;
        var sw = iw, sh = ih, sx = 0, sy = 0;
        if(iw / ih > alvo){ sw = Math.round(ih * alvo); sx = Math.round((iw - sw) / 2); }
        else { sh = Math.round(iw / alvo); sy = Math.round((ih - sh) * 0.22); }
        var ow = Math.min(sw, 1100), oh = Math.round(ow / alvo);
        var c = document.createElement("canvas"); c.width = ow; c.height = oh;
        var ctx = c.getContext("2d");
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, ow, oh);
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, ow, oh);
        resolve({ b64: c.toDataURL("image/jpeg", 0.85).split(",")[1], w: wDxa, h: hDxa });
      };
      img.onerror = function(){ resolve(null); };
      img.src = dataUrl;
    });
  }

  var docPrId = 100;
  function drawingPara(rid, name, wpx, hpx, maxW, maxH){
    var s = Math.min(maxW / wpx, maxH / hpx);
    var cx = Math.round(wpx * s * 635), cy = Math.round(hpx * s * 635);
    docPrId++;
    return '<w:p><w:pPr><w:spacing w:after="0"/><w:jc w:val="center"/></w:pPr><w:r><w:drawing>' +
      '<wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="' + cx + '" cy="' + cy + '"/>' +
      '<wp:docPr id="' + docPrId + '" name="' + name + '"/>' +
      '<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>' +
      '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
      '<pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="' + name + '.jpg"/><pic:cNvPicPr/></pic:nvPicPr>' +
      '<pic:blipFill><a:blip r:embed="' + rid + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
      '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm>' +
      '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>' +
      '</a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';
  }

  // Coloca a foto na célula (substitui o texto "(inserir imagem)").
  function colocarFoto(doc, label, foto, rid, nome, maxW, maxH){
    var lp = findP(doc, label);
    if(!lp || !foto) return null;
    var tc = lp.parentNode;
    kids(tc, "p").forEach(function(p){ tc.removeChild(p); });
    var node = doc.importNode(parseFrag(drawingPara(rid, nome, foto.w, foto.h, maxW, maxH)), true);
    tc.appendChild(node);
    return tc;
  }

  function nomePasta(s){
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }

  async function exportarFichaWord(f){
    if(typeof JSZip === "undefined") throw new Error("Biblioteca ZIP não carregada");
    var resp = await fetch("modelo.docx", {cache: "no-cache"});
    if(!resp.ok) throw new Error("Modelo oficial não encontrado");
    var zip = await JSZip.loadAsync(await resp.arrayBuffer());
    var xml = await zip.file("word/document.xml").async("string");
    var doc = new DOMParser().parseFromString(xml, "application/xml");
    if(doc.getElementsByTagName("parsererror").length) throw new Error("Modelo inválido");

    var chips = f.chips || {}, ratings = f.ratings || {};

    // Cabeçalho do jogo
    setLabelValue(doc, "JOGO", f.jogo_equipas);
    setLabelValue(doc, "RESULTADO", f.resultado);
    setLabelValue(doc, "JORNADA / COMPETIÇÃO", f.jornada);
    var dh = [fmtData(f.data_jogo), f.hora_jogo ? f.hora_jogo + "H" : ""].filter(Boolean).join(" - ");
    setLabelValue(doc, "DATA E HORA", dh);
    setLabelValue(doc, "ESCALÃO", f.escalao);
    if(/^(Natural|Sintético|Híbrido)$/.test(chips.terreno || "")) setLabelValue(doc, "TERRENO", chips.terreno);
    setLabelValue(doc, "GR TITULAR", f.gr_titular);
    setLabelValue(doc, "GR SUPLENTE", f.gr_suplente);
    setLabelValue(doc, "LOCAL DO JOGO", f.local_jogo);

    // Condições climatéricas (campos do formulário)
    if(f.temperatura !== undefined && String(f.temperatura).trim() !== "") setField(doc, "TemperaturaJogo", String(f.temperatura).trim() + "º");
    if(chips.periodo) setField(doc, "PeriodoJogo", chips.periodo.toUpperCase(), true);
    if(chips.tempo){
      var chave = soLetras(chips.tempo), alvo = null;
      els(doc, "ffData").forEach(function(ff){
        var n = kids(ff, "name")[0];
        if(n && n.getAttributeNS(W, "val") === "TempoJogo"){
          kids(kids(ff, "ddList")[0], "listEntry").forEach(function(e){
            var v = e.getAttributeNS(W, "val");
            if(soLetras(v) === chave) alvo = v;
          });
        }
      });
      setField(doc, "TempoJogo", alvo || chips.tempo.toUpperCase(), true);
    }

    // Textos
    if((f.aquecimento || "").trim()){
      var pa = findP(doc, "AQUECIMENTO / ATIVAÇÃO"); // cabeçalho; a caixa é a tabela seguinte
      if(pa){
        var tbl = pa; while(tbl && tbl.localName !== "tbl") tbl = tbl.parentNode;
        var n1 = tbl.nextSibling; while(n1 && !(n1.localName === "tbl")) n1 = n1.nextSibling;
        if(n1) fillBox(doc, kids(kids(kids(n1, "tr")[0], "tc")[0], "p")[0], f.aquecimento);
      }
    }
    var pp = findP(doc, "ASPETOS POSITIVOS"), pm = findP(doc, "ASPETOS A MELHORAR");
    function caixaDepois(p){
      var tbl = p; while(tbl && tbl.localName !== "tbl") tbl = tbl.parentNode;
      var tr = tbl.parentNode; while(tr && tr.localName !== "tr") tr = tr.parentNode;
      // linha seguinte da mesma tabela, ou (se for a última) a mesma tabela
      var rows = kids(tbl, "tr"), cur = p; while(cur && cur.localName !== "tr") cur = cur.parentNode;
      var nxt = rows[rows.indexOf(cur) + 1];
      return nxt ? kids(kids(nxt, "tc")[0], "p")[0] : null;
    }
    if(pp && (f.aspetos_positivos || "").trim()){ var c1 = caixaDepois(pp); if(c1) fillBox(doc, c1, f.aspetos_positivos); }
    if(pm && (f.aspetos_melhorar || "").trim()){ var c2 = caixaDepois(pm); if(c2) fillBox(doc, c2, f.aspetos_melhorar); }
    if((f.erros_corrigir || "").trim()){
      var pe = findP(doc, "ERROS TÉCNICO-TÁTICOS · A CORRIGIR NO TREINO SEMANAL");
      if(pe){
        var t2 = pe; while(t2 && t2.localName !== "tbl") t2 = t2.parentNode;
        var n2 = t2.nextSibling; while(n2 && n2.localName !== "tbl") n2 = n2.nextSibling;
        if(n2) fillBox(doc, kids(kids(kids(n2, "tr")[0], "tc")[0], "p")[0], f.erros_corrigir);
      }
    }

    // Avaliação 1–5 (X na coluna da nota)
    Object.keys(ratings).forEach(function(k){
      var v = ratings[k];
      if(!v || v < 1 || v > 5) return;
      var label = (window.RATING_LABELS || {})[k];
      if(label) setRating(doc, label, v);
    });

    // Avaliação final
    if(f.nota_final) setField(doc, "NotaFinalJogo", f.nota_final);
    if(chips.evolucao) setField(doc, "EvolucaoJogo", chips.evolucao.toUpperCase(), true);
    setField(doc, "TreinadorObs", f.treinador, false, 15);
    setField(doc, "DataObs", fmtData(f.data_observacao), false, 15);

    // Fotografias
    var rels = await zip.file("word/_rels/document.xml.rels").async("string");
    var novasRels = "";
    var AT_W = 2850, AT_H = 2930, ES_W = 2070, ES_H = 1215;   // interior das caixas do modelo (dxa)
    var fa = await prepararFoto((f.fotos || {}).atleta, AT_W, AT_H);
    var fe = await prepararFoto((f.fotos || {}).estadio, ES_W, ES_H);
    if(fa){
      zip.file("word/media/foto_atleta.jpg", fa.b64, {base64: true, createFolders: false});
      novasRels += '<Relationship Id="rIdFotoAtleta" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/foto_atleta.jpg"/>';
      colocarFoto(doc, "FOTOGRAFIA DA ATLETA", fa, "rIdFotoAtleta", "foto_atleta", AT_W, AT_H);
    }
    if(fe){
      zip.file("word/media/foto_estadio.jpg", fe.b64, {base64: true, createFolders: false});
      novasRels += '<Relationship Id="rIdFotoEstadio" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/foto_estadio.jpg"/>';
      colocarFoto(doc, "FOTOGRAFIA DO ESTÁDIO", fe, "rIdFotoEstadio", "foto_estadio", ES_W, ES_H);
    }
    var out = new XMLSerializer().serializeToString(doc);
    if(out.indexOf("<?xml") !== 0) out = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' + out;
    zip.file("word/document.xml", out, {createFolders: false});
    if(novasRels) zip.file("word/_rels/document.xml.rels", rels.replace("</Relationships>", novasRels + "</Relationships>"), {createFolders: false});

    // Documento deixa de estar protegido, para poderes editar tudo ao passar a limpo.
    var st = await zip.file("word/settings.xml").async("string");
    zip.file("word/settings.xml", st.replace(/<w:documentProtection[^>]*\/>/, ""), {createFolders: false});

    var blob = await zip.generateAsync({type: "blob", compression: "DEFLATE",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"});
    var partes = ["Ficha_GR", nomePasta(f.gr_nome), nomePasta(f.jornada), (f.data_jogo || "").replace(/-/g, "")].filter(Boolean);
    return {blob: blob, nome: partes.join("_") + ".docx"};
  }

  window.exportarFichaWord = exportarFichaWord;
})();
