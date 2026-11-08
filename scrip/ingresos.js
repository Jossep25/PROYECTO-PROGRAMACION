(() => {
  const MAX_BYTES = 2 * 1024 * 1024;  
  const LIMITE_FILAS = 200;           
  const REQUERIDAS = ['orden', 'fecha', 'codigo', 'producto', 'cliente', 'tipo', 'cantidad'];
  const TEXTO_INICIAL = 'Ningún archivo seleccionado (formato .xlsx o .csv)';
  const normalizar = (t) =>
    (t ?? '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  function detectarSeparador(texto) {
    const lineas = texto.split(/\r?\n/).filter((l) => l.trim() !== '').slice(0, 5);
    const cuentas = { ';': 0, ',': 0, '\t': 0 };
    for (const linea of lineas) {
      for (const ch of linea) {
        if (ch in cuentas) cuentas[ch]++;
      }
    }
    return Object.entries(cuentas).sort((a, b) => b[1] - a[1])[0][0];
  }
  function parsearCSV(texto, sep) {
    const filas = [];
    let fila = [];
    let celda = '';
    let entreComillas = false;
    for (let i = 0; i < texto.length; i++) {
      const c = texto[i];
      if (entreComillas) {
        if (c === '"') {
          if (texto[i + 1] === '"') { celda += '"'; i++; }
          else entreComillas = false;
        } else {
          celda += c;
        }
      } else if (c === '"') {
        entreComillas = true;
      } else if (c === sep) {
        fila.push(celda);
        celda = '';
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && texto[i + 1] === '\n') i++;
        fila.push(celda);
        celda = '';
        filas.push(fila);
        fila = [];
      } else {
        celda += c;
      }
    }
    if (celda !== '' || fila.length) {
      fila.push(celda);
      filas.push(fila);
    }
    return filas;
  }

  const esFechaValida = (v) =>
    /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(v) || /^\d{4}-\d{2}-\d{2}$/.test(v);
  const decodificar = (t) =>
    t
      .replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (m, e) => {
        if (e[0] === '#') {
          const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
          return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
        }
        return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[e];
      })
      .replace(/_x([0-9A-Fa-f]{4})_/g, (m, h) => String.fromCharCode(parseInt(h, 16)));

  function atributos(texto) {
    const a = {};
    for (const m of (texto || '').matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
      a[m[1]] = decodificar(m[2] ?? m[3] ?? '');
    }
    return a;
  }
  function etiquetas(xml, nombre) {
    const re = new RegExp('<' + nombre + '\\b([^>]*?)(?:/>|>([\\s\\S]*?)</' + nombre + '>)', 'g');
    return [...(xml || '').matchAll(re)].map((m) => ({ attrs: atributos(m[1]), interior: m[2] ?? '' }));
  }

  const letrasAColumna = (letras) => {
    let n = 0;
    for (const ch of letras) n = n * 26 + (ch.charCodeAt(0) - 64);
    return n - 1;
  };
  const PALETA_INDEXADA = [
    '000000', 'FFFFFF', 'FF0000', '00FF00', '0000FF', 'FFFF00', 'FF00FF', '00FFFF',
    '000000', 'FFFFFF', 'FF0000', '00FF00', '0000FF', 'FFFF00', 'FF00FF', '00FFFF',
    '800000', '008000', '000080', '808000', '800080', '008080', 'C0C0C0', '808080',
    '9999FF', '993366', 'FFFFCC', 'CCFFFF', '660066', 'FF8080', '0066CC', 'CCCCFF',
    '000080', 'FF00FF', 'FFFF00', '00FFFF', '800080', '800000', '008080', '0000FF',
    '00CCFF', 'CCFFFF', 'CCFFCC', 'FFFF99', '99CCFF', 'FF99CC', 'CC99FF', 'FFCC99',
    '3366FF', '33CCCC', '99CC00', 'FFCC00', 'FF9900', 'FF6600', '666699', '969696',
    '003366', '339966', '003300', '333300', '993300', '993366', '333399', '333333'
  ];

  const TEMA_POR_DEFECTO = [
    'FFFFFF', '000000', 'E8E8E8', '0E2841', '156082', 'E97132',
    '196B24', '0F9ED5', 'A02B93', '4EA72E', '467886', '96607D'
  ];
  const NOMBRES_TEMA = ['lt1', 'dk1', 'lt2', 'dk2', 'accent1', 'accent2', 'accent3', 'accent4',
    'accent5', 'accent6', 'hlink', 'folHlink'];

  function leerTema(xml) {
    const esquema = (xml || '').match(/<a:clrScheme\b[\s\S]*?<\/a:clrScheme>/);
    return NOMBRES_TEMA.map((nombre, i) => {
      if (esquema) {
        const bloque = esquema[0].match(new RegExp('<a:' + nombre + '>([\\s\\S]*?)</a:' + nombre + '>'));
        const rgb = bloque && bloque[1].match(
          /(?:srgbClr\s+val|sysClr\b[^>]*?lastClr)\s*=\s*"([0-9A-Fa-f]{6})"/
        );
        if (rgb) return '#' + rgb[1].toLowerCase();
      }
      return '#' + TEMA_POR_DEFECTO[i].toLowerCase();
    });
  }
  function aplicarTinte(hex, tint) {
    if (!tint) return hex;
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    let s = 0;
    let l = (max + min) / 2;
    if (d !== 0) {
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    l = tint < 0 ? l * (1 + tint) : l * (1 - tint) + tint;
    l = Math.min(1, Math.max(0, l));

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const canal = (t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const rgb = s === 0 ? [l, l, l] : [canal(h + 1 / 3), canal(h), canal(h - 1 / 3)];
    return '#' + rgb.map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
  }
  function resolverColor(attrs, tema) {
    if (!attrs) return null;
    let hex = null;
    if (attrs.rgb && /^[0-9A-Fa-f]{8}$/.test(attrs.rgb)) {
      hex = '#' + attrs.rgb.slice(2).toLowerCase();
    } else if (attrs.rgb && /^[0-9A-Fa-f]{6}$/.test(attrs.rgb)) {
      hex = '#' + attrs.rgb.toLowerCase();
    } else if (attrs.theme !== undefined && tema[+attrs.theme]) {
      hex = aplicarTinte(tema[+attrs.theme], parseFloat(attrs.tint || '0'));
    } else if (attrs.indexed !== undefined && +attrs.indexed < PALETA_INDEXADA.length) {
      hex = '#' + PALETA_INDEXADA[+attrs.indexed].toLowerCase();
    }
    return !hex || hex === '#ffffff' ? null : hex;
  }

  const FECHAS_INTEGRADAS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32,
    33, 34, 35, 36, 45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58]);

  function esFormatoFecha(id, formatos) {
    if (FECHAS_INTEGRADAS.has(id)) return true;
    const codigo = formatos[id];
    if (!codigo) return false;
    const limpio = codigo.replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '').replace(/\\./g, '');
    return /[dmyhs]/i.test(limpio);
  }

  function leerEstilos(xml, tema) {
    const bloqueRellenos = ((xml || '').match(/<fills\b[\s\S]*?<\/fills>/) || [''])[0];
    const colorRelleno = etiquetas(bloqueRellenos, 'fill').map(({ interior }) => {
      const patron = etiquetas(interior, 'patternFill')[0];
      if (!patron || patron.attrs.patternType !== 'solid') return null;
      const fg = etiquetas(patron.interior, 'fgColor')[0];
      return fg ? resolverColor(fg.attrs, tema) : null;
    });

    const formatos = {};
    for (const { attrs } of etiquetas(xml, 'numFmt')) formatos[attrs.numFmtId] = attrs.formatCode || '';

    const bloqueXfs = ((xml || '').match(/<cellXfs\b[\s\S]*?<\/cellXfs>/) || [''])[0];
    const xfs = etiquetas(bloqueXfs, 'xf');
    return {
      color: xfs.map(({ attrs }) => colorRelleno[+attrs.fillId || 0] ?? null),
      fecha: xfs.map(({ attrs }) => esFormatoFecha(+attrs.numFmtId || 0, formatos))
    };
  }

  function leerCadenas(xml) {
    if (!xml) return [];
    return etiquetas(xml, 'si').map(({ interior }) => {
      const sinFonetica = interior.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
      return etiquetas(sinFonetica, 't').map((t) => decodificar(t.interior)).join('');
    });
  }
  function numeroAFecha(serial, es1904) {
    const base = es1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
    const f = new Date(base + Math.floor(serial) * 86400000);
    const dd = String(f.getUTCDate()).padStart(2, '0');
    const mm = String(f.getUTCMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${f.getUTCFullYear()}`;
  }
  function leerHoja(xml, cadenas, estilos, es1904) {
    const filas = [];
    for (const fila of etiquetas(xml, 'row')) {
      const celdas = [];
      const colores = [];
      for (const c of etiquetas(fila.interior, 'c')) {
        const letras = ((c.attrs.r || '').match(/^[A-Za-z]+/) || [''])[0].toUpperCase();
        if (!letras) continue;
        const col = letrasAColumna(letras);
        const estilo = +c.attrs.s || 0;
        const tipo = c.attrs.t || 'n';
        const v = etiquetas(c.interior, 'v')[0];

        let valor = '';
        if (tipo === 's') {
          valor = cadenas[+(v ? v.interior : NaN)] ?? '';
        } else if (tipo === 'inlineStr') {
          valor = etiquetas(c.interior, 't').map((t) => decodificar(t.interior)).join('');
        } else if (tipo === 'b') {
          valor = v && v.interior.trim() === '1' ? 'VERDADERO' : 'FALSO';
        } else if (v) {
          const texto = decodificar(v.interior.trim());
          valor = tipo === 'n' && estilos.fecha[estilo] && texto !== '' && Number.isFinite(+texto)
            ? numeroAFecha(+texto, es1904)
            : texto;
        }
        celdas[col] = valor.trim();
        colores[col] = estilos.color[estilo] ?? null;
      }
      const ancho = celdas.length;
      filas.push({
        celdas: Array.from({ length: ancho }, (_, i) => celdas[i] ?? ''),
        colores: Array.from({ length: ancho }, (_, i) => colores[i] ?? null)
      });
    }
    return filas;
  }
  async function leerXlsx(archivo) {
    if (typeof JSZip === 'undefined') {
      throw new Error('No se pudo cargar la librería para leer Excel (JSZip). Revisa tu conexión a internet o sube un .csv.');
    }
    let zip;
    try {
      zip = await JSZip.loadAsync(await archivo.arrayBuffer());
    } catch (e) {
      throw new Error('El archivo no parece un Excel válido (.xlsx). Si es un .xls antiguo, guárdalo como .xlsx.');
    }
    const texto = async (ruta) => {
      const f = zip.file(ruta);
      return f ? f.async('string') : '';
    };

    const libro = await texto('xl/workbook.xml');
    if (!libro) throw new Error('El archivo no parece un Excel válido (.xlsx).');
    const es1904 = /<workbookPr\b[^>]*date1904\s*=\s*"(1|true)"/i.test(libro);
    let rutaHoja = 'xl/worksheets/sheet1.xml';
    const primera = etiquetas(libro, 'sheet')[0];
    if (primera) {
      const rels = await texto('xl/_rels/workbook.xml.rels');
      const rel = etiquetas(rels, 'Relationship').find((r) => r.attrs.Id === primera.attrs['r:id']);
      if (rel && rel.attrs.Target) {
        rutaHoja = rel.attrs.Target.startsWith('/') ? rel.attrs.Target.slice(1) : 'xl/' + rel.attrs.Target;
      }
    }
    const hoja = await texto(rutaHoja);
    if (!hoja) throw new Error('No se encontró la hoja de datos dentro del Excel.');

    const tema = leerTema(await texto('xl/theme/theme1.xml'));
    const estilos = leerEstilos(await texto('xl/styles.xml'), tema);
    const cadenas = leerCadenas(await texto('xl/sharedStrings.xml'));
    return leerHoja(hoja, cadenas, estilos, es1904);
  }
  const form = document.getElementById('form-subida');
  const input = document.getElementById('archivo');
  const btnSubir = document.getElementById('btn-subir');
  const nombreArchivo = document.getElementById('nombre-archivo');
  const resumen = document.getElementById('resumen');
  const avisos = document.getElementById('avisos');
  const vista = document.getElementById('vista-previa');
  const tabla = document.getElementById('tabla-previa');
  const acciones = document.getElementById('acciones');
  const btnConfirmar = document.getElementById('btn-confirmar');
  const btnCancelar = document.getElementById('btn-cancelar');
  const csvTexto = document.getElementById('csv-texto');
  const coloresJson = document.getElementById('colores-json');
  if (!form || !input || !tabla) return;

  function limpiar() {
    input.value = '';
    csvTexto.value = '';
    csvTexto.disabled = true;
    coloresJson.value = '';
    coloresJson.disabled = true;
    nombreArchivo.textContent = TEXTO_INICIAL;
    resumen.hidden = true;
    resumen.textContent = '';
    avisos.hidden = true;
    avisos.replaceChildren();
    vista.hidden = true;
    tabla.querySelector('thead').replaceChildren();
    tabla.querySelector('tbody').replaceChildren();
    acciones.hidden = true;
    btnConfirmar.disabled = false;
    btnConfirmar.textContent = 'Confirmar y subir';
  }

  function mostrarAvisos(lista) {
    avisos.replaceChildren();
    lista.forEach(({ tipo, texto }) => {
      const d = document.createElement('div');
      d.className = 'aviso ' + tipo;
      d.textContent = texto;
      avisos.appendChild(d);
    });
    avisos.hidden = lista.length === 0;
  }

  function rechazar(texto) {
    limpiar();
    mostrarAvisos([{ tipo: 'error', texto }]);
  }

  btnSubir.addEventListener('click', () => input.click());
  btnCancelar.addEventListener('click', limpiar);
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) limpiar();
  });

  input.addEventListener('change', async () => {
    const archivo = input.files[0];
    if (!archivo) return;

    const nombre = archivo.name.toLowerCase();
    const esXlsx = nombre.endsWith('.xlsx');
    if (!esXlsx && !nombre.endsWith('.csv')) {
      rechazar('Solo se aceptan archivos .xlsx (Excel) o .csv. Si tienes un .xls antiguo, guárdalo como .xlsx.');
      return;
    }
    if (archivo.size > MAX_BYTES) {
      rechazar('El archivo pesa más de 2 MB. Revisa que sea la programación correcta.');
      return;
    }

    let filas;
    let nombreSep = '';
    try {
      if (esXlsx) {
        filas = await leerXlsx(archivo);
        nombreSep = 'Excel';
      } else {
        const buffer = await archivo.arrayBuffer();
        let texto = new TextDecoder('utf-8').decode(buffer);
        if (texto.includes('\uFFFD')) {
          texto = new TextDecoder('windows-1252').decode(buffer);
        }
        texto = texto.replace(/^\uFEFF/, '');
        const sep = detectarSeparador(texto);
        nombreSep = { ';': 'punto y coma', ',': 'coma', '\t': 'tabulación' }[sep];
        filas = parsearCSV(texto, sep).map((f) => ({ celdas: f.map((c) => c.trim()), colores: [] }));
      }
    } catch (err) {
      rechazar(err.message || 'No se pudo leer el archivo.');
      return;
    }

    filas = filas.filter((f) => f.celdas.some((c) => c !== ''));
    if (filas.length < 2) {
      rechazar('El archivo no tiene datos para mostrar.');
      return;
    }
    let iEnc = filas.findIndex((f) => f.celdas.some((c) => normalizar(c) === 'orden'));
    if (iEnc === -1) iEnc = 0;
    let encabezados = filas[iEnc].celdas;
    while (encabezados.length > 1 && encabezados[encabezados.length - 1] === '') {
      encabezados = encabezados.slice(0, -1);  
    }
    const datos = filas.slice(iEnc + 1);
    const normEnc = encabezados.map(normalizar);
    const colorDeFila = (r) => r.colores.slice(0, encabezados.length).find(Boolean) || null;

    const faltan = REQUERIDAS.filter((r) => !normEnc.some((h) => h.includes(r)));
    const iOrden = normEnc.findIndex((h) => h.includes('orden'));
    const iCantidad = normEnc.findIndex((h) => h.includes('cantidad'));
    const colsFecha = normEnc
      .map((h, i) => (h.includes('fecha') || h.includes('fehca') ? i : -1))
      .filter((i) => i >= 0);
    const thead = tabla.querySelector('thead');
    const trHead = document.createElement('tr');
    ['#', ...encabezados.map((h, i) => h || 'col ' + (i + 1))].forEach((h) => {
      const th = document.createElement('th');
      th.textContent = h;
      trHead.appendChild(th);
    });
    thead.replaceChildren(trHead);

    const tbody = tabla.querySelector('tbody');
    tbody.replaceChildren();
    let sinOrden = 0;
    let celdasDudosas = 0;
    let conColor = 0;

    datos.forEach((r, i) => {
      const celdas = encabezados.map((_, c) => r.celdas[c] ?? '');
      const color = colorDeFila(r);
      if (color) conColor++;
      const filaSinOrden = iOrden >= 0 && celdas[iOrden] === '';
      if (filaSinOrden) sinOrden++;

      const dudosas = celdas.map((v, c) => {
        if (v === '') return false;
        if (colsFecha.includes(c)) return !esFechaValida(v);
        if (c === iCantidad) return !/^[\d.,\s]+$/.test(v);
        return false;
      });
      celdasDudosas += dudosas.filter(Boolean).length;

      if (i < LIMITE_FILAS) {
        const tr = document.createElement('tr');
        if (filaSinOrden) tr.classList.add('fila-error');
        if (color) {
          tr.classList.add('resaltado');
          tr.style.setProperty('--resalte', color);
        }
        const tdNum = document.createElement('td');
        tdNum.className = 'col-num';
        tdNum.textContent = i + 1;
        tr.appendChild(tdNum);
        celdas.forEach((v, c) => {
          const td = document.createElement('td');
          td.textContent = v;
          if (dudosas[c]) td.className = 'celda-error';
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      }
    });
    if (esXlsx) {
      const celdaCSV = (v) => (/[;"\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v);
      const lineas = [encabezados, ...datos.map((r) => encabezados.map((_, c) => r.celdas[c] ?? ''))]
        .map((f) => f.map(celdaCSV).join(';'));
      csvTexto.value = lineas.join('\r\n');
      csvTexto.disabled = false;
      coloresJson.value = JSON.stringify(datos.map(colorDeFila));
      coloresJson.disabled = false;
      input.value = '';   
    } else {
      csvTexto.value = '';
      csvTexto.disabled = true;
      coloresJson.value = '';
      coloresJson.disabled = true;
    }

    nombreArchivo.textContent = archivo.name;
    resumen.textContent =
      `${archivo.name} · ${(archivo.size / 1024).toFixed(1)} KB · ` +
      `${datos.length} filas de datos · ${encabezados.length} columnas · formato: ${nombreSep}` +
      (esXlsx ? ` · ${conColor} fila(s) con color` : '');
    resumen.hidden = false;

    const lista = [];
    if (faltan.length) {
      lista.push({ tipo: 'error', texto: 'Faltan columnas obligatorias: ' + faltan.join(', ') + '.' });
    }
    if (sinOrden) {
      lista.push({ tipo: 'error', texto: `${sinOrden} fila(s) sin número de orden (marcadas en rojo).` });
    }
    if (celdasDudosas) {
      lista.push({
        tipo: 'advertencia',
        texto: `${celdasDudosas} celda(s) con fecha o cantidad dudosa (marcadas en amarillo). Revísalas antes de subir.`
      });
    }
    if (datos.length > LIMITE_FILAS) {
      lista.push({
        tipo: 'advertencia',
        texto: `Se muestran las primeras ${LIMITE_FILAS} filas de ${datos.length}. Al confirmar se subirán todas.`
      });
    }
    mostrarAvisos(lista);

    vista.hidden = false;
    acciones.hidden = false;
    btnConfirmar.disabled = faltan.length > 0 || sinOrden > 0 || datos.length === 0;
  });
  document.addEventListener('submit', (e) => {
    if (e.target !== form) return;
    e.stopPropagation();

    if (btnConfirmar.disabled) {  
      e.preventDefault();
      return;
    }
    btnConfirmar.disabled = true; 
    btnConfirmar.textContent = 'Subiendo...';
  }, true);
})();